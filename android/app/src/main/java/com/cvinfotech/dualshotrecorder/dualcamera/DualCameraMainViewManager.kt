package com.cvinfotech.dualshotrecorder.dualcamera

import android.graphics.SurfaceTexture
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.content.Context
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Main camera preview - full screen TextureView.
 * Registers its surface with DualCameraController.
 */
class DualCameraMainViewManager : SimpleViewManager<TextureView>() {
    companion object {
        const val REACT_CLASS = "DualCameraMainView"
        private const val TAG = "DualMainView"
    }

    override fun getName() = REACT_CLASS

    override fun createViewInstance(context: ThemedReactContext): TextureView {
        val textureView = TextureView(context)

        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) {
                Log.d(TAG, "Main surface available: ${w}x${h}")

                // Register a surface provider instead of a one-time
                // Surface. Every time createCaptureSession() runs, this
                // provider is called to produce a fresh Surface with the
                // correct buffer size — so Camera2 always negotiates the
                // right output dimensions, even after the camera is
                // closed and reopened (gallery visit, app resume, etc.).
                DualCameraController.addSurfaceProvider("main") {
                    textureView.surfaceTexture?.let { currentSt ->
                        val bw = DualCameraController.getResolutionWidth()
                        val bh = DualCameraController.getResolutionHeight()
                        currentSt.setDefaultBufferSize(bw, bh)
                        Surface(currentSt)
                    }
                }
                // Lets DualCameraPipViewManager read live frames from this
                // view via getBitmap() when it isn't getting its own real
                // camera stream (front-camera recording — see
                // DualCameraController.shouldFakePipDuringRecording()).
                DualCameraController.registerMainTextureView(textureView)
                // Recomputes the transform whenever a capture session
                // actually finishes (re)configuring — covers the
                // close/reopen-on-resume path where this surface itself
                // never changes but the underlying stream does.
                DualCameraController.registerTransformRefresh("main") {
                    updateTransform(textureView, textureView.width, textureView.height)
                }
                updateTransform(textureView, w, h)
            }

            override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {
                updateTransform(textureView, w, h)
            }

            override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
                DualCameraController.removeSurfaceProvider("main")
                DualCameraController.unregisterTransformRefresh("main")
                DualCameraController.unregisterMainTextureView()
                return true
            }

            override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
        }

        return textureView
    }

    /**
     * Center-crop transform: fills the entire TextureView with the camera image,
     * cropping edges as needed, with zero black bars and zero distortion.
     *
     * How it works:
     * - Camera sensor outputs landscape buffer (e.g. 1920x1080)
     * - Camera2 internally rotates by sensorOrientation (90°) -> upright image is 1080x1920
     * - TextureView naively stretches this 1080x1920 into its view bounds (non-uniform)
     * - We apply a correction matrix to undo the non-uniform stretch and replace it
     *   with a uniform center-crop scale
     */
    private fun updateTransform(view: TextureView, viewWidth: Int, viewHeight: Int) {
        if (viewWidth <= 0 || viewHeight <= 0) return

        val bufferWidth = DualCameraController.getResolutionWidth().toFloat()
        val bufferHeight = DualCameraController.getResolutionHeight().toFloat()
        if (bufferWidth <= 0 || bufferHeight <= 0) return

        val sensorOrientation = DualCameraController.getSensorOrientation(view.context)
        val isRotated = (sensorOrientation == 90 || sensorOrientation == 270)

        // After Camera2's internal rotation, the effective image dimensions
        val imageWidth = if (isRotated) bufferHeight else bufferWidth
        val imageHeight = if (isRotated) bufferWidth else bufferHeight

        val vw = viewWidth.toFloat()
        val vh = viewHeight.toFloat()
        val centerX = vw / 2f
        val centerY = vh / 2f

        // TextureView internally applies non-uniform stretch:
        //   stretchX = viewWidth / imageWidth
        //   stretchY = viewHeight / imageHeight
        // For center-crop, we want uniform scale = max(stretchX, stretchY)
        // So the correction to apply on top is: max/stretchX and max/stretchY
        val stretchX = vw / imageWidth
        val stretchY = vh / imageHeight
        val cropScale = Math.max(stretchX, stretchY)

        val correctionX = cropScale / stretchX
        val correctionY = cropScale / stretchY

        val matrix = android.graphics.Matrix()
        matrix.setScale(correctionX, correctionY, centerX, centerY)

        // Mirror for front camera
        if (DualCameraController.isFrontCamera(view.context)) {
            matrix.postScale(-1f, 1f, centerX, centerY)
        }

        view.setTransform(matrix)
    }
}
