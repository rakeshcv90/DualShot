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
                val bw = DualCameraController.getResolutionWidth()
                val bh = DualCameraController.getResolutionHeight()
                st.setDefaultBufferSize(bw, bh)
                
                val surface = Surface(st)
                DualCameraController.addPreviewSurface("main", surface)
                updateTransform(textureView, w, h)
            }

            override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {
                updateTransform(textureView, w, h)
            }

            override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
                DualCameraController.removePreviewSurface("main")
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
