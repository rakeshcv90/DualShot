package com.cvinfotech.dualshotrecorder.dualcamera

import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.content.Context
import android.view.WindowManager
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
                // Set native landscape resolution (1920x1080)
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

    private fun updateTransform(view: TextureView, viewWidth: Int, viewHeight: Int) {
        if (viewWidth <= 0 || viewHeight <= 0) return

        val matrix = android.graphics.Matrix()
        val bufferW = DualCameraController.getResolutionWidth().toFloat()
        val bufferH = DualCameraController.getResolutionHeight().toFloat()
        val sensorOrientation = DualCameraController.getSensorOrientation(view.context)
        val isFront = DualCameraController.isFrontCamera(view.context)
        
        if (bufferW <= 0 || bufferH <= 0) return

        val vw = viewWidth.toFloat()
        val vh = viewHeight.toFloat()
        val centerX = vw / 2f
        val centerY = vh / 2f
        
        // TextureView internally applies SurfaceTexture.getTransformMatrix() which
        // already handles sensor rotation. We only need aspect-fill scaling.
        // The default stretch maps buffer -> view. We need to correct aspect ratio.
        
        // After internal rotation, effective buffer dimensions in view space:
        val isRotated = (sensorOrientation == 90 || sensorOrientation == 270)
        val effectiveW = if (isRotated) bufferH else bufferW
        val effectiveH = if (isRotated) bufferW else bufferH
        
        // Aspect Fill: scale so the image fills the entire view (crop edges)
        val scaleX = vw / effectiveW
        val scaleY = vh / effectiveH
        val fillScale = Math.max(scaleX, scaleY)
        
        // Apply: undo default stretch, then apply uniform fill scale
        val sx = fillScale * effectiveW / vw
        val sy = fillScale * effectiveH / vh
        matrix.setScale(sx, sy, centerX, centerY)

        // Mirror for front camera
        if (isFront) {
            matrix.postScale(-1f, 1f, centerX, centerY)
        }
        
        Log.d("DualMainView", "NoRotate: view=${viewWidth}x${viewHeight}, eff=${effectiveW}x${effectiveH}, sx=$sx, sy=$sy")
        
        view.setTransform(matrix)
    }



}
