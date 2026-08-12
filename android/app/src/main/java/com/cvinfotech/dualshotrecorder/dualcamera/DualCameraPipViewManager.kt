package com.cvinfotech.dualshotrecorder.dualcamera

import android.graphics.SurfaceTexture
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
    }

    override fun getName() = REACT_CLASS

    override fun createViewInstance(context: ThemedReactContext): TextureView {
        val textureView = TextureView(context)

        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) {
                Log.d(TAG, "PIP surface available: ${w}x${h}")
                val bw = DualCameraController.getResolutionWidth()
                val bh = DualCameraController.getResolutionHeight()
                st.setDefaultBufferSize(bw, bh)
                
                val surface = Surface(st)
                DualCameraController.addPreviewSurface("pip", surface)
                updateTransform(textureView, w, h)
            }

            override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {
                updateTransform(textureView, w, h)
            }

            override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
                DualCameraController.removePreviewSurface("pip")
                return true
            }

            override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
        }

        return textureView
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
