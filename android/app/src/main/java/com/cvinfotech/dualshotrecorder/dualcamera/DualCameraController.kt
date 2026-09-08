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
    private var cameraManager: CameraManager? = null
    private var captureSession: CameraCaptureSession? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null
    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var currentCameraId: String? = null
    private var torchEnabled = false
    private var currentVideoPath: String? = null

    // Confirmed via device logs: createCaptureSession() gets called once per
    // surface as the main/pip preview surfaces (and the photo ImageReader)
    // each register in quick succession — every call is async, so an
    // earlier call's onConfigured can fire after a later call has already
    // superseded and closed it, throwing "Session has been closed; further
    // changes are illegal" on setRepeatingRequest. This generation counter
    // lets onConfigured recognize when it's stale and bail out instead of
    // touching an already-superseded session.
    private var sessionGeneration = 0

    // User settings
    private var targetResolution = "1080p"
    private var targetFps = 30
    private var fileFormat = "MP4"

    // Surface providers for dual preview — each provider refreshes the
    // SurfaceTexture's buffer size and returns a fresh Surface every time
    // createCaptureSession() is called, so the Camera2 session always
    // negotiates the correct output dimensions (no stale buffer state).
    private val surfaceProviders = mutableMapOf<String, () -> Surface?>()
    private var recorderSurface: Surface? = null

    // Lets each preview TextureView (main/pip) recompute its own crop
    // transform once a capture session actually finishes configuring —
    // see createCaptureSession()'s onConfigured below. Recomputing here
    // (rather than relying solely on the TextureView's own surface/layout
    // change callbacks) covers session-rebuild paths — e.g. closing and
    // reopening the camera when the app returns from background — where the
    // view's own surface never changes but the underlying stream does.
    private val transformRefreshCallbacks = mutableMapOf<String, () -> Unit>()

    fun registerTransformRefresh(id: String, callback: () -> Unit) {
        transformRefreshCallbacks[id] = callback
    }

    fun unregisterTransformRefresh(id: String) {
        transformRefreshCallbacks.remove(id)
    }
    
    // Every open/switch/start-recording call that needs to know when the
    // next session finishes configuring appends here instead of overwriting
    // a single slot. A single slot silently dropped whichever caller
    // registered first whenever two of these calls overlapped — e.g.
    // switching the camera and then immediately hitting record — leaving
    // that caller's promise/callback (and whatever JS was awaiting it) stuck
    // forever with no error.
    private val sessionReadyCallbacks = mutableListOf<(Boolean) -> Unit>()

    private fun fireSessionReady(success: Boolean) {
        val callbacks = sessionReadyCallbacks.toList()
        sessionReadyCallbacks.clear()
        callbacks.forEach { it(success) }
    }

    // Set only while closeCamera() is waiting for the device to actually
    // finish releasing (see onClosed() below) before letting a subsequent
    // openCamera() proceed.
    private var pendingCloseCallback: (() -> Unit)? = null
    private var closeGeneration = 0

    private var imageReader: ImageReader? = null
    private var photoCallback: ((String?) -> Unit)? = null
    private var photoContext: Context? = null

    // Target preview size - updated dynamically
    private var previewSize = Size(1920, 1080)

    fun updateSettings(context: Context, resolution: String?, fps: Int?, format: String?, forCameraId: String? = null) {
        val oldResolution = targetResolution
        resolution?.let { targetResolution = it }
        fps?.let { targetFps = it }
        format?.let { fileFormat = it }
        
        Log.d(TAG, "Updated settings: $targetResolution, $targetFps fps, format: $fileFormat")
        
        // Find best preview size that is supported by BOTH SurfaceTexture
        // (preview) AND MediaRecorder (recording). The front camera HAL on
        // devices like OPPO CPH2661 rejects mismatched stream sizes with a
        // fatal CAMERA_ERROR(4). By choosing from the intersection, the
        // recording size always matches the preview size.
        //
        // When forCameraId is supplied (e.g. during switchCamera before
        // openCamera), query THAT camera's capabilities instead of the
        // currently-open one — the current one is about to be closed.
        try {
            val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val id = forCameraId ?: currentCameraId ?: manager.cameraIdList[0]
            val chars = manager.getCameraCharacteristics(id)
            val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val textureSizes = map?.getOutputSizes(SurfaceTexture::class.java)
            val recorderSizes = map?.getOutputSizes(MediaRecorder::class.java)
            
            // Build the intersection of texture and recorder supported sizes
            val recorderSizeSet = recorderSizes?.map { Pair(it.width, it.height) }?.toSet() ?: emptySet()
            val commonSizes = textureSizes?.filter { recorderSizeSet.contains(Pair(it.width, it.height)) }
            // Fallback to texture-only sizes if intersection is empty (shouldn't happen)
            val sizes = if (!commonSizes.isNullOrEmpty()) commonSizes.toTypedArray() else textureSizes
            
            Log.d(TAG, "Camera $id: ${textureSizes?.size ?: 0} texture sizes, ${recorderSizes?.size ?: 0} recorder sizes, ${commonSizes?.size ?: 0} common sizes")
            
            if (sizes != null && sizes.isNotEmpty()) {
                val targetArea = if (targetResolution == "4K") 3840 * 2160 else 1920 * 1080

                // DO NOT target the device's screen aspect ratio (e.g. 20:9).
                // Selecting proprietary resolutions like 1608x720 perfectly matches
                // the screen, but when fed to the hardware video encoder (MediaRecorder),
                // it silently crashes/freezes the entire camera pipeline on some devices
                // (like OPPO CPH2661), resulting in a frozen preview and timeout crash.
                // We must force a standard video aspect ratio like 16:9 (1.777) so we
                // get 1920x1080 or 1280x720.
                val targetAspect = 16.0f / 9.0f

                val candidates = sizes.filter { it.width * it.height in (targetArea / 2)..(targetArea * 2) }
                previewSize = (if (candidates.isNotEmpty()) candidates.toList() else sizes.toList())
                    .minByOrNull { size ->
                        val sizeAspect = Math.max(size.width, size.height).toFloat() /
                            Math.min(size.width, size.height).toFloat()
                        // Find the size closest to 16:9. If tie, prefer the one closer to targetArea
                        val aspectDiff = Math.abs(sizeAspect - targetAspect)
                        aspectDiff * 10000 + Math.abs((size.width * size.height) - targetArea) / 1000f
                    } ?: sizes[0]
                Log.d(TAG, "Selected preview size: ${previewSize.width}x${previewSize.height} (targeting 16:9)")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error selecting preview size", e)
            previewSize = Size(1920, 1080)
        }
        
        // Recreate ImageReader when resolution changes OR when the camera
        // is being switched (forCameraId != null). Front and back cameras
        // have different supported JPEG sizes, so the old ImageReader's
        // dimensions can be invalid for the new camera.
        if (oldResolution != targetResolution || forCameraId != null) {
            imageReader?.close()
            imageReader = null
        }
    }

    fun addSurfaceProvider(id: String, provider: () -> Surface?) {
        surfaceProviders[id] = provider
        Log.d(TAG, "Added surface provider: $id, total: ${surfaceProviders.size}")
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

    fun removeSurfaceProvider(id: String) {
        surfaceProviders.remove(id)
        Log.d(TAG, "Removed surface provider: $id, total: ${surfaceProviders.size}")
    }

    // LEGACY/LIMITED-level cameras (common for the front camera even when
    // the back camera is FULL/LEVEL_3) can't reliably sustain 3 simultaneous
    // streams. createCaptureSession() already accounts for this by dropping
    // the photo ImageReader while recording, but that alone still leaves
    // main preview + pip preview + recorder = 3 streams, so recording never
    // configures on constrained hardware regardless. Used to drop the pip
    // stream too, in that specific situation only.
    private fun isConstrainedHardwareLevel(): Boolean {
        return try {
            val id = currentCameraId ?: return false
            val chars = cameraManager?.getCameraCharacteristics(id) ?: return false
            when (chars.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL)) {
                CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY,
                CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED -> true
                else -> false
            }
        } catch (e: Exception) {
            false
        }
    }

    // Confirmed on-device: even after dropping pip specifically for
    // "constrained" hardware levels, front-camera recording still stalled
    // the whole pipeline — meaning the declared hardware level isn't a
    // reliable signal here (this device's front camera can still be a
    // significantly weaker ISP/sensor than the back camera despite
    // reporting a capable hardware level). Sustaining a live preview-class
    // stream (pip) alongside a continuous video-encoder stream is
    // apparently too much for it regardless. So: drop pip during recording
    // on the front camera unconditionally — pip is a purely cosmetic live
    // duplicate of the same feed anyway, and the actual second "view" in
    // the final output already comes from cropping the recorded footage
    // afterward (see processVideo() in HomeScreen.js), not from this stream.
    private fun isCurrentCameraFront(): Boolean {
        return try {
            val id = currentCameraId ?: return false
            val chars = cameraManager?.getCameraCharacteristics(id) ?: return false
            chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        } catch (e: Exception) {
            false
        }
    }

    // Exposed so DualCameraPipViewManager knows when it isn't receiving a
    // real camera stream and should fall back to periodically copying a
    // snapshot of the main view instead — mirrors the same condition
    // createCaptureSession() uses to decide whether to drop pip's surface.
    fun shouldFakePipDuringRecording(): Boolean {
        return recorderSurface != null && (isConstrainedHardwareLevel() || isCurrentCameraFront())
    }

    // Weak so this never keeps the main preview's TextureView (and
    // everything it holds) alive past its own lifecycle — this is purely a
    // read-only reference pip uses to copy frames from, not an owner.
    private var mainTextureViewRef: java.lang.ref.WeakReference<TextureView>? = null

    fun registerMainTextureView(view: TextureView) {
        mainTextureViewRef = java.lang.ref.WeakReference(view)
    }

    fun unregisterMainTextureView() {
        mainTextureViewRef = null
    }

    fun getMainTextureView(): TextureView? = mainTextureViewRef?.get()

    fun openCamera(context: Context, facing: String, onReady: ((Boolean) -> Unit)? = null) {
        onReady?.let { sessionReadyCallbacks.add(it) }
        startBackgroundThread()
        setupImageReader(context)

        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        cameraManager = manager
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
                    // The OS calls this when another app takes over
                    // camera-relevant priority — e.g. launching the gallery
                    // app — independent of our own JS-driven close/reopen
                    // logic. Previously this only cleared cameraDevice,
                    // leaving captureSession pointing at a session built on
                    // the now-closed device. Any reopen afterward (or
                    // setTorch's captureSession != null check) was then
                    // reasoning about inconsistent state — the device gone
                    // but the "there's an active session" bookkeeping still
                    // says otherwise.
                    Log.d(TAG, "Camera disconnected")
                    camera.close()
                    captureSession = null
                    cameraDevice = null
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    Log.e(TAG, "Camera error: $error")
                    camera.close()
                    captureSession = null
                    cameraDevice = null
                    // Camera error 4 = CAMERA_ERROR (fatal): the device is
                    // dead and must be reopened. Clean up any in-progress
                    // recording so the session can be rebuilt cleanly.
                    if (isRecording) {
                        try { mediaRecorder?.reset() } catch (_: Exception) {}
                        try { mediaRecorder?.release() } catch (_: Exception) {}
                        mediaRecorder = null
                        recorderSurface = null
                        isRecording = false
                    }
                    // Fire any pending session-ready callbacks so promises
                    // don't hang forever.
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        fireSessionReady(false)
                    }
                }

                override fun onClosed(camera: CameraDevice) {
                    // Fires once the camera HAL has actually finished
                    // releasing this device — the only reliable signal for
                    // that. Switching cameras used to just wait a fixed
                    // 300ms and hope the old camera was done releasing by
                    // then before opening the new one; on a device where the
                    // HAL takes longer than that (varies by OEM, and is
                    // usually slower right after recording), the new
                    // openCamera() call can silently stall with no
                    // onOpened/onError ever firing — the preview freezes and
                    // recording never starts, with no error anywhere.
                    Log.d(TAG, "Camera closed: $cameraId")
                    finishClose(closeGeneration)
                }
            }, backgroundHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open camera", e)
        }
    }

    private var closeHandled = false

    // Whichever of onClosed()'s real signal or the safety timeout in
    // closeCamera() runs first wins for a given close; the other is a
    // no-op, guarded by generation (a newer closeCamera() call in the
    // meantime) and closeHandled (both firing for the same close).
    private fun finishClose(generation: Int) {
        if (generation != closeGeneration || closeHandled) return
        closeHandled = true
        // DO NOT stop the background thread here — it's needed immediately
        // by the subsequent openCamera() call (switchCamera, reopenCamera,
        // AppState resume all close-then-open). Stopping it here caused
        // thread.join() to block the UI thread and nulled backgroundHandler
        // before openCamera could use it, freezing the app.
        val callback = pendingCloseCallback
        pendingCloseCallback = null
        callback?.invoke()
    }

    /**
     * Closes the current camera device. [onDone] fires once the device has
     * actually finished releasing (via onClosed() above), so callers that
     * need to open a different/new camera right after — switching cameras
     * in particular — can wait for the real signal instead of guessing at a
     * fixed delay. Falls back to a timeout in case some OEM camera HAL ever
     * skips onClosed() entirely, so this can never hang forever.
     */
    fun closeCamera(onDone: (() -> Unit)? = null) {
        val myGeneration = ++closeGeneration
        closeHandled = false
        pendingCloseCallback = onDone
        try {
            captureSession?.close()
            captureSession = null
            mediaRecorder?.release()
            mediaRecorder = null
            imageReader?.close()
            imageReader = null

            val device = cameraDevice
            cameraDevice = null
            if (device != null) {
                device.close() // onClosed() above completes teardown
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    finishClose(myGeneration)
                }, 500)
            } else {
                finishClose(myGeneration)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error closing camera", e)
            finishClose(myGeneration)
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
            val ext = if (fileFormat == "MOV") "mov" else "mp4"
            val videoFile = File(context.cacheDir, "DualShot_$timestamp.$ext")
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
                
                val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                val supportedSizes = map?.getOutputSizes(MediaRecorder::class.java) ?: emptyArray()
                
                // Use the same resolution as the preview stream. The front
                // camera HAL on this device (OPPO CPH2661) rejects mismatched
                // stream configurations — e.g. preview at 1608x720 + recorder
                // at 1920x1080 causes CAMERA_ERROR(4) with "Function not
                // implemented (-38)". Using the preview size for both streams
                // guarantees the HAL accepts the configuration.
                var w = previewSize.width
                var h = previewSize.height
                
                // Verify the preview size is also valid for MediaRecorder.
                // If not (rare), find the closest supported MediaRecorder
                // size with matching aspect ratio.
                val previewSizeSupported = supportedSizes.any { it.width == w && it.height == h }
                if (!previewSizeSupported && supportedSizes.isNotEmpty()) {
                    Log.w(TAG, "Preview size ${w}x${h} not in MediaRecorder supported sizes, finding closest match")
                    val previewAspect = w.toFloat() / h.toFloat()
                    val best = supportedSizes
                        .filter { Math.abs(it.width.toFloat() / it.height.toFloat() - previewAspect) < 0.1f }
                        .maxByOrNull { it.width * it.height }
                        ?: supportedSizes.maxByOrNull { it.width * it.height }
                    if (best != null) {
                        w = best.width
                        h = best.height
                    }
                }
                Log.d(TAG, "Recording at ${w}x${h} (preview: ${previewSize.width}x${previewSize.height})")

                val bitRate = if (w >= 3840) 50000000 else 20000000 // 50Mbps for 4K

                
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

            // Delay starting the recorder until the new session is fully configured.
            // Starting it immediately before the camera accepts the new surface
            // causes the pipeline to hang and produces 0-byte corrupted files.
            sessionReadyCallbacks.add { success ->
                if (success) {
                    try {
                        mediaRecorder?.start()
                        Log.d(TAG, "Recording started: ${videoFile.absolutePath}")
                        callback(videoFile.absolutePath)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to start media recorder after session configured", e)
                        try { mediaRecorder?.reset() } catch (_: Exception) {}
                        try { mediaRecorder?.release() } catch (_: Exception) {}
                        mediaRecorder = null
                        recorderSurface = null
                        isRecording = false
                        callback(null)
                    }
                } else {
                    Log.e(TAG, "Session configuration failed, cannot start recording")
                    // Clean up MediaRecorder so the camera can be reopened
                    // without the dead recorder surface poisoning the next
                    // createCaptureSession() call.
                    try { mediaRecorder?.reset() } catch (_: Exception) {}
                    try { mediaRecorder?.release() } catch (_: Exception) {}
                    mediaRecorder = null
                    recorderSurface = null
                    isRecording = false
                    callback(null)
                }
            }

            // Recreate session with recorder surface
            createCaptureSession()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to prepare recording", e)
            isRecording = false
            callback(null)
        }
    }

    fun stopRecording(callback: (String?) -> Unit) {
        if (!isRecording) {
            callback(null)
            return
        }

        // Stop the camera from actively writing frames to the MediaRecorder
        // surface BEFORE we destroy the recorder. If we destroy the surface
        // while the camera HAL is still pushing frames to it, the HAL hangs
        // on some devices (like OPPO) during the subsequent session creation
        // with "Error waiting to drain: Connection timed out (-110)" (Camera Error 4).
        try {
            captureSession?.stopRepeating()
            captureSession?.abortCaptures()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to stop repeating requests before stopping recorder", e)
        }

        // MediaRecorder.stop() throws when the recorder never actually
        // received any encoded frames (e.g. the capture session stalled and
        // never delivered camera frames to it) — exactly the failure mode
        // that leaves a technically-existing but useless output file (just
        // an MP4 header, no video data). A bare exists()+length()>0 check
        // below can't tell that file apart from a real recording, and
        // handing it to the caller anyway is what let a broken video reach
        // CameraRoll.save() and crash there instead of failing cleanly here.
        var stopFailed = false
        try {
            mediaRecorder?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop recording natively (often happens if stopped too quickly, or if no frames were ever recorded)", e)
            stopFailed = true
        } finally {
            try {
                mediaRecorder?.reset()
                mediaRecorder?.release()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to release media recorder", e)
            }
            mediaRecorder = null
            recorderSurface = null
            isRecording = false

            Log.d(TAG, "Recording stopped: $currentVideoPath")

            // Recreate session without recorder
            createCaptureSession()

            // A header-only broken MP4 is typically well under 1KB; any real
            // recording of even a fraction of a second is far larger. This
            // is a coarse floor, not a validity parse, but it's enough to
            // catch the "stop() failed, empty video" case above.
            val minValidVideoBytes = 10_000L
            val file = File(currentVideoPath)
            val fileSize = if (file.exists()) file.length() else -1L
            if (!stopFailed && fileSize > minValidVideoBytes) {
                callback(currentVideoPath)
            } else {
                Log.e(TAG, "Recording file is invalid, empty, or missing (stopFailed=$stopFailed, size=$fileSize)")
                file.delete()
                callback(null)
            }
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
            // Use previewSize for the ImageReader so it matches the camera's
            // actual supported sizes. Hardcoded 1920x1080 fails on front
            // cameras that max out at smaller resolutions (e.g. 1608x720).
            val w = previewSize.width
            val h = previewSize.height
            imageReader = ImageReader.newInstance(w, h, ImageFormat.JPEG, 2)
            Log.d(TAG, "ImageReader created at ${w}x${h}")
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

        // Get fresh surfaces from providers — each call refreshes the
        // SurfaceTexture buffer size and creates a new Surface wrapper,
        // so Camera2 always negotiates the correct output dimensions.
        //
        // While recording, main preview + pip preview + recorder is already
        // 3 streams before the photo stream below is even considered — too
        // many for a LEGACY/LIMITED-level camera, and also too many for this
        // device's front camera specifically regardless of its declared
        // hardware level (see isCurrentCameraFront() above). Confirmed on
        // device: this is a real stream-count/HAL limit, not just the
        // MediaRecorder start-ordering bug fixed elsewhere in this function
        // — recording still fails with pip included even with that fix in
        // place. Drop pip in either case; main preview and recording still
        // work, pip just doesn't update its own stream while recording on
        // that camera.
        val dropPipForHardwareLimits = recorderSurface != null &&
            (isConstrainedHardwareLevel() || isCurrentCameraFront())
        surfaceProviders.forEach { (id, provider) ->
            if (id == "pip" && dropPipForHardwareLimits) return@forEach
            provider()?.let { surfaces.add(it) }
        }

        // Add recorder surface if recording
        recorderSurface?.let { surfaces.add(it) }

        // Add image reader surface ONLY if we are NOT recording video.
        // Many Android front cameras (LIMITED/LEGACY hardware level) do not support
        // 3 simultaneous streams (Preview + Video + Photo). Attempting to configure
        // all 3 causes a fatal hardware crash (Camera Error 4).
        if (recorderSurface == null) {
            imageReader?.surface?.let { surfaces.add(it) }
        }

        if (surfaces.isEmpty()) {
            Log.w(TAG, "No surfaces available")
            return
        }

        val mySessionGeneration = ++sessionGeneration

        try {
            try {
                captureSession?.stopRepeating()
                captureSession?.abortCaptures()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to stop repeating requests before closing session", e)
            }
            captureSession?.close()

            camera.createCaptureSession(
                surfaces,
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        if (mySessionGeneration != sessionGeneration) {
                            // A newer createCaptureSession() call already
                            // superseded this one — e.g. the pip surface
                            // registered right after main did, triggering
                            // another call before this one finished
                            // configuring. Using this session now would
                            // throw "Session has been closed"; just release
                            // it and let the newer session's own onConfigured
                            // take over.
                            Log.d(TAG, "Discarding stale session (generation $mySessionGeneration, current $sessionGeneration)")
                            session.close()
                            return
                        }

                        captureSession = session
                        Log.d(TAG, "Session configured with ${surfaces.size} surfaces")

                        try {
                            // Use TEMPLATE_PREVIEW even while recording.
                            // Some devices (like OPPO) aggressively apply a
                            // cropped FOV (for EIS or encoder pipelines) when
                            // TEMPLATE_RECORD is used, causing a sudden zoom-in.
                            // Using TEMPLATE_PREVIEW for the recorder surface
                            // maintains the exact same uncropped FOV.
                            val builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)

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

                            // Apply Target FPS — query the camera's supported
                            // ranges and pick the closest valid one. Many front
                            // cameras don't support an exact [30,30] range (they
                            // support [15,30] or [7,30]), and blindly setting an
                            // unsupported range causes setRepeatingRequest to
                            // throw, which previously hung the promise forever.
                            val fpsRange = try {
                                val id = currentCameraId
                                val mgr = cameraManager
                                if (id != null && mgr != null) {
                                    val chars = mgr.getCameraCharacteristics(id)
                                    val ranges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
                                    // Prefer the range whose upper bound matches targetFps and
                                    // whose span is as narrow as possible (closest to fixed-fps).
                                    ranges?.filter { it.upper >= targetFps }
                                        ?.minByOrNull { it.upper - it.lower + Math.abs(it.upper - targetFps) * 10 }
                                        ?: ranges?.maxByOrNull { it.upper }
                                        ?: android.util.Range(targetFps, targetFps)
                                } else {
                                    android.util.Range(targetFps, targetFps)
                                }
                            } catch (e: Exception) {
                                android.util.Range(targetFps, targetFps)
                            }
                            builder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, fpsRange)
                            Log.d(TAG, "Using FPS range: $fpsRange (target: $targetFps)")

                            // Torch
                            builder.set(
                                CaptureRequest.FLASH_MODE,
                                if (torchEnabled) CaptureRequest.FLASH_MODE_TORCH
                                else CaptureRequest.FLASH_MODE_OFF
                            )

                            // Disable electronic video stabilization (EIS)
                            // to maintain consistent field of view between
                            // preview and recording. TEMPLATE_RECORD enables
                            // EIS by default on most devices, which crops the
                            // sensor output to leave room for stabilization
                            // corrections — appearing as a sudden zoom-in
                            // when recording starts.
                            builder.set(
                                CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
                                CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF
                            )

                            // CRITICAL FIX: The MediaRecorder MUST be started BEFORE
                            // setRepeatingRequest is called. If the camera HAL sends
                            // frames to the MediaRecorder surface before start() is
                            // called, the encoder gets corrupted, silently drops all
                            // frames, and throws a RuntimeException when stop() is called,
                            // resulting in a 0-byte video.
                            // fireSessionReady(true) synchronously executes the
                            // mediaRecorder.start() logic queued in startRecording.
                            fireSessionReady(true)

                            session.setRepeatingRequest(
                                builder.build(),
                                null,
                                backgroundHandler
                            )

                            // Recompute each preview's crop transform now
                            // that this session is actually live — must run
                            // on the UI thread (TextureView.setTransform
                            // requirement).
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                transformRefreshCallbacks.values.forEach { it() }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to create capture request", e)
                            // CRITICAL: must fire the session-ready callbacks
                            // even on failure — otherwise startRecording's
                            // callback is never invoked, its promise never
                            // resolves, and the JS-side await hangs forever,
                            // making the app appear frozen.
                            isRecording = false
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                fireSessionReady(false)
                            }
                        }
                    }

                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        Log.e(TAG, "Failed to configure capture session")
                        isRecording = false
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            fireSessionReady(false)
                        }
                    }
                },
                backgroundHandler
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create capture session", e)
            isRecording = false
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                fireSessionReady(false)
            }
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
