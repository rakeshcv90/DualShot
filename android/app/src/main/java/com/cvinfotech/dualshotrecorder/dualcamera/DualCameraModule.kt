package com.cvinfotech.dualshotrecorder.dualcamera

import android.app.Activity
import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.io.FileInputStream

/**
 * React Native bridge module for camera controls:
 * open/close camera, start/stop recording, toggle torch, switch camera
 */
@ReactModule(name = DualCameraModule.NAME)
class DualCameraModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "DualCameraModule"
    }

    override fun getName() = NAME

    private fun getActivity(): Activity? {
        return reactContext.currentActivity
    }

    @ReactMethod
    fun openCamera(facing: String, config: ReadableMap?) {
        val activity = getActivity() ?: return
        
        val res = config?.getString("resolution")
        val fps = if (config?.hasKey("fps") == true) config.getInt("fps") else null
        val format = config?.getString("fileFormat")
        
        activity.runOnUiThread {
            DualCameraController.updateSettings(activity, res, fps, format)
            DualCameraController.openCamera(activity, facing)
        }
    }

    @ReactMethod
    fun closeCamera() {
        val activity = getActivity() ?: return
        activity.runOnUiThread {
            DualCameraController.closeCamera()
        }
    }

    @ReactMethod
    fun setTorch(enabled: Boolean) {
        DualCameraController.setTorch(enabled)
    }

    @ReactMethod
    fun switchCamera(facing: String) {
        val activity = getActivity() ?: return
        activity.runOnUiThread {
            DualCameraController.closeCamera()
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                DualCameraController.openCamera(activity, facing)
            }, 300)
        }
    }

    @ReactMethod
    fun startRecording(config: ReadableMap?, promise: Promise) {
        val activity = getActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }

        val res = config?.getString("resolution")
        val fps = if (config?.hasKey("fps") == true) config.getInt("fps") else null
        val format = config?.getString("fileFormat")

        activity.runOnUiThread {
            DualCameraController.updateSettings(activity, res, fps, format)
            DualCameraController.startRecording(activity) { path ->
                if (path != null) {
                    promise.resolve(path)
                } else {
                    promise.reject("RECORDING_ERROR", "Failed to start recording")
                }
            }
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        val activity = getActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }
        activity.runOnUiThread {
            DualCameraController.stopRecording { path ->
                if (path != null) {
                    promise.resolve(path)
                } else {
                    promise.reject("RECORDING_ERROR", "Failed to stop recording")
                }
            }
        }
    }
    
    @ReactMethod
    fun takePhoto(promise: Promise) {
        val activity = getActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }
        activity.runOnUiThread {
            DualCameraController.takePhoto(activity) { path ->
                if (path != null) {
                    promise.resolve(path)
                } else {
                    promise.reject("PHOTO_ERROR", "Failed to take photo")
                }
            }
        }
    }

    @ReactMethod
    fun savePhotoToGallery(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: $filePath")
                return
            }
            
            val ctx = reactContext
            val timestamp = System.currentTimeMillis()
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, "DualShot_${timestamp}.jpg")
                    put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                    put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/DualShot")
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
                val uri = ctx.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                if (uri != null) {
                    ctx.contentResolver.openOutputStream(uri)?.use { os ->
                        FileInputStream(file).use { fis ->
                            fis.copyTo(os)
                        }
                    }
                    values.clear()
                    values.put(MediaStore.Images.Media.IS_PENDING, 0)
                    ctx.contentResolver.update(uri, values, null, null)
                    promise.resolve(uri.toString())
                } else {
                    promise.reject("SAVE_ERROR", "Failed to create MediaStore entry")
                }
            } else {
                val picturesDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "DualShot")
                if (!picturesDir.exists()) picturesDir.mkdirs()
                val destFile = File(picturesDir, "DualShot_${timestamp}.jpg")
                file.copyTo(destFile, overwrite = true)
                android.media.MediaScannerConnection.scanFile(ctx, arrayOf(destFile.absolutePath), arrayOf("image/jpeg"), null)
                promise.resolve(destFile.absolutePath)
            }
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", "Failed to save photo: ${e.message}", e)
        }
    }
}
