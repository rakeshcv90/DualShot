package com.cvinfotech.dualshotrecorder.dualcamera

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.SurfaceTexture
import android.hardware.camera2.*
import android.media.MediaRecorder
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.HandlerThread
import android.provider.MediaStore
import android.util.Log
import android.util.Size
import android.view.Surface
import android.view.TextureView
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import android.graphics.ImageFormat
import android.media.ImageReader
import android.view.WindowManager

/**
 * Singleton that manages the Camera2 session and renders to multiple surfaces.
 * This is the core of the DualShot feature - one camera, two preview outputs.
 */
object DualCameraController {
    private const val TAG = "DualCameraCtrl"
    private val sound = android.media.MediaActionSound()

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null
    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var currentCameraId: String? = null
    private var torchEnabled = false
    private var currentVideoPath: String? = null
    
    // User settings
    private var targetResolution = "1080p"
    private var targetFps = 30
    private var fileFormat = "MP4"

    // Multiple surfaces for dual preview
    private val previewSurfaces = mutableMapOf<String, Surface>()
    private var recorderSurface: Surface? = null
    
    private var imageReader: ImageReader? = null
    private var photoCallback: ((String?) -> Unit)? = null
    private var photoContext: Context? = null

    // Target preview size - updated dynamically
    private var previewSize = Size(1920, 1080)

    fun updateSettings(context: Context, resolution: String?, fps: Int?, format: String?) {
        resolution?.let { targetResolution = it }
        fps?.let { targetFps = it }
        format?.let { fileFormat = it }
        
        Log.d(TAG, "Updated settings: $targetResolution, $targetFps fps, format: $fileFormat")
        
        // Find best preview size instead of hardcoding
        try {
            val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val id = currentCameraId ?: manager.cameraIdList[0]
            val chars = manager.getCameraCharacteristics(id)
            val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val sizes = map?.getOutputSizes(SurfaceTexture::class.java)
            if (sizes != null && sizes.isNotEmpty()) {
                // Sort by area and find the best match for our target
                val targetArea = if (targetResolution == "4K") 3840 * 2160 else 1920 * 1080
                previewSize = sizes.minByOrNull { Math.abs(it.width * it.height - targetArea) } ?: sizes[0]
                Log.d(TAG, "Selected preview size: ${previewSize.width}x${previewSize.height}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error selecting preview size", e)
            previewSize = Size(1920, 1080)
        }
        
        // Re-setup ImageReader if needed (for taking photos)
        imageReader?.close()
        imageReader = null
    }

    fun addPreviewSurface(id: String, surface: Surface) {
        previewSurfaces[id] = surface
        Log.d(TAG, "Added surface: $id, total: ${previewSurfaces.size}")
        // Restart session if camera is already open
        if (cameraDevice != null) {
            createCaptureSession()
        }
    }

    fun getCurrentCameraId(): String? {
        return currentCameraId
    }

    fun getResolutionWidth(): Int {
        return previewSize.width
    }

    fun getResolutionHeight(): Int {
        return previewSize.height
    }

    fun getPortraitWidth(): Int {
        return if (targetResolution == "4K") 2160 else 1080
    }

    fun getPortraitHeight(): Int {
        // We use 16:9 for everything now to ensure consistency
        return if (targetResolution == "4K") 3840 else 1920
    }

    fun getSensorOrientation(context: Context): Int {
        return try {
            val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val id = currentCameraId ?: manager.cameraIdList[0]
            val chars = manager.getCameraCharacteristics(id)
            val orientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90
            Log.d(TAG, "Sensor orientation for camera $id: $orientation")
            orientation
        } catch (e: Exception) {
            Log.e(TAG, "Error getting sensor orientation", e)
            90
        }
    }

    fun isFrontCamera(context: Context): Boolean {
        return try {
            val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val id = currentCameraId ?: manager.cameraIdList[0]
            val chars = manager.getCameraCharacteristics(id)
            chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        } catch (e: Exception) {
            false
        }
    }

    fun getCurrentAspectRatio(context: Context): Float {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val id = currentCameraId ?: return 0.75f // Default 4:3
        try {
            val characteristics = manager.getCameraCharacteristics(id)
            val map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val sizes = map?.getOutputSizes(SurfaceTexture::class.java)
            if (sizes != null && sizes.isNotEmpty()) {
                // Find the aspect ratio of the largest supported size
                val largest = sizes[0]
                return largest.width.toFloat() / largest.height.toFloat()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting aspect ratio", e)
        }
        return 0.75f
    }

    fun removePreviewSurface(id: String) {
        previewSurfaces.remove(id)
        Log.d(TAG, "Removed surface: $id, total: ${previewSurfaces.size}")
    }

    fun openCamera(context: Context, facing: String) {
        startBackgroundThread()
        setupImageReader(context)

        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = getCameraId(manager, facing) ?: return

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Camera permission not granted")
            return
        }

        currentCameraId = cameraId

        try {
            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    Log.d(TAG, "Camera opened: $cameraId")
                    cameraDevice = camera
                    createCaptureSession()
                }

                override fun onDisconnected(camera: CameraDevice) {
                    Log.d(TAG, "Camera disconnected")
                    camera.close()
                    cameraDevice = null
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    Log.e(TAG, "Camera error: $error")
                    camera.close()
                    cameraDevice = null
                }
            }, backgroundHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open camera", e)
        }
    }

    fun closeCamera() {
        try {
            captureSession?.close()
            captureSession = null
            cameraDevice?.close()
            cameraDevice = null
            mediaRecorder?.release()
            mediaRecorder = null
            imageReader?.close()
            imageReader = null
            stopBackgroundThread()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing camera", e)
        }
    }

    fun setTorch(enabled: Boolean) {
        torchEnabled = enabled
        // Update the capture request
        if (captureSession != null && cameraDevice != null) {
            createCaptureSession()
        }
    }

    fun startRecording(context: Context, callback: (String?) -> Unit) {
        if (isRecording || cameraDevice == null) {
            callback(null)
            return
        }

        try {
            // Setup MediaRecorder
            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val videoFile = File(context.cacheDir, "DualShot_$timestamp.mp4")
            currentVideoPath = videoFile.absolutePath

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val chars = manager.getCameraCharacteristics(currentCameraId!!)
            val sensorOrientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90

            mediaRecorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                setOutputFormat(if (fileFormat == "MOV") MediaRecorder.OutputFormat.MPEG_4 else MediaRecorder.OutputFormat.MPEG_4) 
                setOutputFile(videoFile.absolutePath)
                
                val (w, h) = if (targetResolution == "4K") Pair(3840, 2160) else Pair(1920, 1080)
                val bitRate = if (targetResolution == "4K") 50000000 else 20000000 // 50Mbps for 4K
                
                setVideoEncodingBitRate(bitRate)
                setVideoFrameRate(targetFps)
                setVideoSize(w, h)
                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                
                // Calculate correct orientation hint
                val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                val deviceRotation = when (windowManager.defaultDisplay.rotation) {
                    Surface.ROTATION_0 -> 0
                    Surface.ROTATION_90 -> 90
                    Surface.ROTATION_180 -> 180
                    Surface.ROTATION_270 -> 270
                    else -> 0
                }
                val isFront = chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
                val finalOrientation = if (isFront) {
                    (sensorOrientation + deviceRotation) % 360
                } else {
                    (sensorOrientation - deviceRotation + 360) % 360
                }
                
                setOrientationHint(finalOrientation)
                prepare()
            }

            recorderSurface = mediaRecorder?.surface
            isRecording = true

            // Recreate session with recorder surface
            createCaptureSession()

            mediaRecorder?.start()
            Log.d(TAG, "Recording started: ${videoFile.absolutePath}")
            callback(videoFile.absolutePath)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording", e)
            isRecording = false
            callback(null)
        }
    }

    fun stopRecording(callback: (String?) -> Unit) {
        if (!isRecording) {
            callback(null)
            return
        }

        try {
            mediaRecorder?.stop()
            mediaRecorder?.reset()
            mediaRecorder?.release()
            mediaRecorder = null
            recorderSurface = null
            isRecording = false

            Log.d(TAG, "Recording stopped: $currentVideoPath")
            callback(currentVideoPath)

            // Recreate session without recorder
            createCaptureSession()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop recording", e)
            isRecording = false
            callback(currentVideoPath)
        }
    }

    fun takePhoto(context: Context, callback: (String?) -> Unit) {
        if (cameraDevice == null || captureSession == null) {
            callback(null)
            return
        }
        
        photoCallback = callback
        photoContext = context
        
        sound.play(android.media.MediaActionSound.SHUTTER_CLICK)
        
        try {
            val captureBuilder = cameraDevice!!.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
            
            imageReader?.surface?.let {
                captureBuilder.addTarget(it)
            }
            
            captureBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
            captureBuilder.set(CaptureRequest.FLASH_MODE, if (torchEnabled) CaptureRequest.FLASH_MODE_TORCH else CaptureRequest.FLASH_MODE_OFF)
            
            val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val chars = manager.getCameraCharacteristics(currentCameraId!!)
            val sensorOrientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90
            
            val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val deviceRotation = when (windowManager.defaultDisplay.rotation) {
                Surface.ROTATION_0 -> 0
                Surface.ROTATION_90 -> 90
                Surface.ROTATION_180 -> 180
                Surface.ROTATION_270 -> 270
                else -> 0
            }
            val isFront = chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
            val finalOrientation = if (isFront) {
                (sensorOrientation + deviceRotation) % 360
            } else {
                (sensorOrientation - deviceRotation + 360) % 360
            }
            
            captureBuilder.set(CaptureRequest.JPEG_ORIENTATION, finalOrientation)
            
            captureSession?.capture(captureBuilder.build(), null, backgroundHandler)
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to capture photo", e)
            photoCallback?.invoke(null)
            photoCallback = null
            photoContext = null
        }
    }
    
    private fun setupImageReader(context: Context) {
        if (imageReader == null) {
            val (w, h) = if (targetResolution == "4K") Pair(3840, 2160) else Pair(1920, 1080)
            imageReader = ImageReader.newInstance(w, h, ImageFormat.JPEG, 2)
            imageReader?.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                val ctx = photoContext ?: return@setOnImageAvailableListener
                
                try {
                    val buffer = image.planes[0].buffer
                    val bytes = ByteArray(buffer.remaining())
                    buffer.get(bytes)
                    
                    val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
                    
                    // Always save a cache copy for JS-side cropping
                    val cacheFile = File(ctx.externalCacheDir ?: ctx.cacheDir, "DualShot_$timestamp.jpg")
                    FileOutputStream(cacheFile).use { it.write(bytes) }
                    
                    // Save to gallery via MediaStore (proper MIME type)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val values = ContentValues().apply {
                            put(MediaStore.Images.Media.DISPLAY_NAME, "DualShot_$timestamp.jpg")
                            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/DualShot")
                            put(MediaStore.Images.Media.IS_PENDING, 1)
                        }
                        val uri = ctx.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                        if (uri != null) {
                            ctx.contentResolver.openOutputStream(uri)?.use { os ->
                                os.write(bytes)
                            }
                            values.clear()
                            values.put(MediaStore.Images.Media.IS_PENDING, 0)
                            ctx.contentResolver.update(uri, values, null, null)
                        }
                    } else {
                        val picturesDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "DualShot")
                        if (!picturesDir.exists()) picturesDir.mkdirs()
                        val galleryFile = File(picturesDir, "DualShot_$timestamp.jpg")
                        FileOutputStream(galleryFile).use { it.write(bytes) }
                        android.media.MediaScannerConnection.scanFile(ctx, arrayOf(galleryFile.absolutePath), arrayOf("image/jpeg"), null)
                    }
                    
                    // Return cache path for JS cropping
                    photoCallback?.invoke(cacheFile.absolutePath)
                } catch (e: Exception) {
                    Log.e(TAG, "Error saving photo", e)
                    photoCallback?.invoke(null)
                } finally {
                    image.close()
                    photoCallback = null
                    photoContext = null
                }
            }, backgroundHandler)
        }
    }

    private fun createCaptureSession() {
        val camera = cameraDevice ?: return
        val surfaces = mutableListOf<Surface>()

        // Add all preview surfaces
        previewSurfaces.values.forEach { surfaces.add(it) }

        // Add recorder surface if recording
        recorderSurface?.let { surfaces.add(it) }
        
        // Add image reader surface
        imageReader?.surface?.let { surfaces.add(it) }

        if (surfaces.isEmpty()) {
            Log.w(TAG, "No surfaces available")
            return
        }

        try {
            captureSession?.close()

            camera.createCaptureSession(
                surfaces,
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        captureSession = session
                        Log.d(TAG, "Session configured with ${surfaces.size} surfaces")

                        try {
                            val builder = camera.createCaptureRequest(
                                if (isRecording) CameraDevice.TEMPLATE_RECORD
                                else CameraDevice.TEMPLATE_PREVIEW
                            )

                            // Add preview and record surfaces as targets (DO NOT add imageReader surface to repeating request)
                            surfaces.forEach { surface ->
                                if (imageReader == null || surface != imageReader?.surface) {
                                    builder.addTarget(surface)
                                }
                            }

                            // Auto focus
                            builder.set(
                                CaptureRequest.CONTROL_AF_MODE,
                                CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO
                            )

                            // Torch
                            builder.set(
                                CaptureRequest.FLASH_MODE,
                                if (torchEnabled) CaptureRequest.FLASH_MODE_TORCH
                                else CaptureRequest.FLASH_MODE_OFF
                            )

                            session.setRepeatingRequest(
                                builder.build(),
                                null,
                                backgroundHandler
                            )
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to create capture request", e)
                        }
                    }

                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        Log.e(TAG, "Session configuration failed")
                    }
                },
                backgroundHandler
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create capture session", e)
        }
    }

    private fun getCameraId(manager: CameraManager, facing: String): String? {
        val targetFacing = if (facing == "front")
            CameraCharacteristics.LENS_FACING_FRONT
        else
            CameraCharacteristics.LENS_FACING_BACK

        for (id in manager.cameraIdList) {
            val chars = manager.getCameraCharacteristics(id)
            if (chars.get(CameraCharacteristics.LENS_FACING) == targetFacing) {
                return id
            }
        }
        return manager.cameraIdList.firstOrNull()
    }

    private fun startBackgroundThread() {
        if (backgroundThread == null) {
            backgroundThread = HandlerThread("DualCameraThread").also { it.start() }
            backgroundHandler = Handler(backgroundThread!!.looper)
        }
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join()
            backgroundThread = null
            backgroundHandler = null
        } catch (e: InterruptedException) {
            Log.e(TAG, "Error stopping background thread", e)
        }
    }
}
