package com.cvinfotech.dualshotrecorder.dualcamera

import android.graphics.SurfaceTexture
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.content.Context
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * PIP preview - small landscape TextureView.
 * Registers its surface with DualCameraController so both views
 * receive the same camera feed simultaneously.
 */
class DualCameraPipViewManager : SimpleViewManager<TextureView>() {
    companion object {
        const val REACT_CLASS = "DualCameraPipView"
        private const val TAG = "DualPipView"

        // ~6fps — this is a deliberately stepped fallback, not a smooth
        // stream (see startFakePipLoop below), so there's no point spending
        // more CPU/GC pressure on it than that.
        private const val FAKE_PIP_INTERVAL_MS = 160L
    }

    private val fakePipHandler = Handler(Looper.getMainLooper())
    private var fakePipRunnable: Runnable? = null

    override fun getName() = REACT_CLASS

    override fun createViewInstance(context: ThemedReactContext): TextureView {
        val textureView = TextureView(context)

        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) {
                Log.d(TAG, "PIP surface available: ${w}x${h}")

                // Same surface-provider pattern as the main view —
                // see DualCameraMainViewManager for the full rationale.
                // Note this provider simply isn't called by
                // createCaptureSession() while shouldFakePipDuringRecording()
                // is true (recording on a camera whose hardware can't
                // sustain a 3rd stream) — see startFakePipLoop below for
                // what covers this view during that window instead.
                DualCameraController.addSurfaceProvider("pip") {
                    textureView.surfaceTexture?.let { currentSt ->
                        val bw = DualCameraController.getResolutionWidth()
                        val bh = DualCameraController.getResolutionHeight()
                        currentSt.setDefaultBufferSize(bw, bh)
                        Surface(currentSt)
                    }
                }
                DualCameraController.registerTransformRefresh("pip") {
                    updateTransform(textureView, textureView.width, textureView.height)
                    if (DualCameraController.shouldFakePipDuringRecording()) {
                        startFakePipLoop(textureView)
                    } else {
                        stopFakePipLoop()
                    }
                }
                updateTransform(textureView, w, h)
            }

            override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {
                updateTransform(textureView, w, h)
            }

            override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
                stopFakePipLoop()
                DualCameraController.removeSurfaceProvider("pip")
                DualCameraController.unregisterTransformRefresh("pip")
                return true
            }

            override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
        }

        return textureView
    }

    /**
     * Fallback for when this view isn't getting a real camera stream (its
     * surface provider above is skipped by createCaptureSession() while
     * recording on hardware that can't sustain a 3rd concurrent stream —
     * see DualCameraController.shouldFakePipDuringRecording()). Rather than
     * leave pip frozen on its last frame for the whole recording, this
     * periodically copies whatever the main view is currently showing (via
     * TextureView.getBitmap(), which reads back its already-rendered
     * content — no camera involved) and draws it directly onto this view's
     * own SurfaceTexture via lockCanvas()/unlockCanvasAndPost(). That's the
     * same pair TextureView itself uses internally for non-camera (CPU
     * Canvas) drawing, so it's safe to use here precisely because nothing
     * else is targeting this SurfaceTexture for the same window (the real
     * provider above is what's skipped).
     *
     * This deliberately does NOT try to reproduce pip's usual independent
     * mirroring — it just shows a small copy of whatever main currently
     * looks like (already mirrored the same way main is), which during this
     * window is visually reasonable since both would be showing the same
     * single live camera anyway. Intentionally stepped (~6fps, not 30) to
     * keep this cheap; it stops the moment the real stream resumes (the
     * transformRefresh callback above re-checks every session change,
     * including recording stop).
     */
    private fun startFakePipLoop(pipView: TextureView) {
        if (fakePipRunnable != null) return // already running
        // updateTransform() left a Matrix on this view sized to crop/mirror
        // a full camera buffer (e.g. 1920x1080) into the view's bounds. The
        // bitmap drawn below is already exactly pipView's own size — no
        // cropping needed — so that stale matrix would instead scale/shift
        // this correctly-sized content out of the visible area, leaving
        // nothing but the view's black background on screen. Reset to
        // identity for the duration; the real updateTransform() call that
        // fires when recording stops restores the proper one.
        pipView.setTransform(null)
        // The SurfaceTexture's buffer is still sized for a full camera
        // frame from the last time this view had a real stream (its
        // provider above calls setDefaultBufferSize with the camera's
        // resolution, e.g. 1920x1080) — lockCanvas() below returns a canvas
        // matching THAT buffer size, not the view's own on-screen pixel
        // size. Drawing a small view-sized bitmap onto a canvas that much
        // bigger only fills a corner of it, leaving the rest black. Resize
        // the buffer to match the view's actual bounds so the two agree;
        // the provider resets this back to full camera resolution itself
        // the next time it's actually called (recording stop).
        val pw = pipView.width.coerceAtLeast(1)
        val ph = pipView.height.coerceAtLeast(1)
        pipView.surfaceTexture?.setDefaultBufferSize(pw, ph)
        val runnable = object : Runnable {
            override fun run() {
                if (!DualCameraController.shouldFakePipDuringRecording()) {
                    fakePipRunnable = null
                    return // real stream is back; let it take over untouched
                }
                val mainView = DualCameraController.getMainTextureView()
                val pipW = pipView.width
                val pipH = pipView.height
                if (mainView != null && mainView.isAvailable && pipView.isAvailable && pipW > 0 && pipH > 0) {
                    try {
                        val bitmap = mainView.getBitmap(pipW, pipH)
                        val canvas = if (bitmap != null) pipView.lockCanvas() else null
                        if (canvas != null && bitmap != null) {
                            try {
                                canvas.drawBitmap(bitmap, 0f, 0f, null)
                            } finally {
                                pipView.unlockCanvasAndPost(canvas)
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Fake pip snapshot failed", e)
                    }
                }
                fakePipHandler.postDelayed(this, FAKE_PIP_INTERVAL_MS)
            }
        }
        fakePipRunnable = runnable
        fakePipHandler.post(runnable)
    }

    private fun stopFakePipLoop() {
        fakePipRunnable?.let { fakePipHandler.removeCallbacks(it) }
        fakePipRunnable = null
    }

    /**
     * Same center-crop logic as the main view.
     */
    private fun updateTransform(view: TextureView, viewWidth: Int, viewHeight: Int) {
        if (viewWidth <= 0 || viewHeight <= 0) return

        val bufferWidth = DualCameraController.getResolutionWidth().toFloat()
        val bufferHeight = DualCameraController.getResolutionHeight().toFloat()
        if (bufferWidth <= 0 || bufferHeight <= 0) return

        val sensorOrientation = DualCameraController.getSensorOrientation(view.context)
        val isRotated = (sensorOrientation == 90 || sensorOrientation == 270)

        val imageWidth = if (isRotated) bufferHeight else bufferWidth
        val imageHeight = if (isRotated) bufferWidth else bufferHeight

        val vw = viewWidth.toFloat()
        val vh = viewHeight.toFloat()
        val centerX = vw / 2f
        val centerY = vh / 2f

        val stretchX = vw / imageWidth
        val stretchY = vh / imageHeight
        val cropScale = Math.max(stretchX, stretchY)

        val correctionX = cropScale / stretchX
        val correctionY = cropScale / stretchY

        val matrix = android.graphics.Matrix()
        matrix.setScale(correctionX, correctionY, centerX, centerY)

        // PIP shows the OTHER camera, so mirror if it's the front camera
        val isFrontPip = !DualCameraController.isFrontCamera(view.context)
        if (isFrontPip) {
            matrix.postScale(-1f, 1f, centerX, centerY)
        }

        view.setTransform(matrix)
    }
}
