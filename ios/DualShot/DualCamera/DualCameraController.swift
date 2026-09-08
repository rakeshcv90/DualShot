import AVFoundation
import UIKit
import AudioToolbox

@objc class DualCameraController: NSObject {
    @objc static let shared = DualCameraController()
    
    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureMovieFileOutput?
    private var photoOutput: AVCapturePhotoOutput?
    private var currentDevice: AVCaptureDevice?
    private var isRecording = false
    
    // Thread-safe queue for PIP layer operations
    private let pipQueue = DispatchQueue(label: "com.dualshot.pipQueue")
    
    // Serial queue for all session operations to prevent race conditions
    // Crash report showed: Thread 0 called stopRunning() while Thread 9 was mid-configuration
    // IMPORTANT: captureSession/currentDevice/videoOutput/photoOutput must ONLY be read or
    // written from work already running on this queue (i.e. inside a sessionQueue.async
    // block). Touching them from any other thread reintroduces the exact race that caused
    // "switchCamera() on background thread + openCamera() on main thread = SIGABRT" — see
    // HomeScreen.js.
    private let sessionQueue = DispatchQueue(label: "com.dualshot.sessionQueue")

    // Runtime error / interruption observers for the current captureSession, so failures
    // (e.g. an unsupported format/fps combo) surface as logs instead of a silent black screen.
    private var sessionObservers: [NSObjectProtocol] = []

    // User settings
    private var targetResolution = "1080p"
    private var targetFps = 30
    private var fileFormat = "MP4"
    
    override private init() {
        super.init()
    }
    
    @objc var currentSession: AVCaptureSession? {
        // Called from the main thread by the view managers; captureSession itself is only
        // ever mutated on sessionQueue, so hop onto it to read a consistent value.
        sessionQueue.sync { captureSession }
    }

    private func removeSessionObservers() {
        let center = NotificationCenter.default
        sessionObservers.forEach { center.removeObserver($0) }
        sessionObservers.removeAll()
    }

    private func registerSessionObservers(for session: AVCaptureSession) {
        let center = NotificationCenter.default

        let runtimeError = center.addObserver(forName: .AVCaptureSessionRuntimeError, object: session, queue: nil) { [weak self] notification in
            guard let self = self else { return }
            let error = notification.userInfo?[AVCaptureSessionErrorKey] as? NSError
            print("iOS: AVCaptureSession runtime error: \(error?.localizedDescription ?? "unknown") (code \(error?.code ?? -1))")

            if error?.code == AVError.mediaServicesWereReset.rawValue {
                self.sessionQueue.async {
                    session.startRunning()
                }
            }
        }

        let interrupted = center.addObserver(forName: .AVCaptureSessionWasInterrupted, object: session, queue: nil) { notification in
            let reasonValue = notification.userInfo?[AVCaptureSessionInterruptionReasonKey] as? Int
            let reason = reasonValue.flatMap(AVCaptureSession.InterruptionReason.init)
            print("iOS: AVCaptureSession interrupted, reason: \(String(describing: reason))")
        }

        let interruptionEnded = center.addObserver(forName: .AVCaptureSessionInterruptionEnded, object: session, queue: nil) { [weak self] _ in
            guard let self = self else { return }
            print("iOS: AVCaptureSession interruption ended")
            self.sessionQueue.async {
                if !session.isRunning {
                    session.startRunning()
                }
            }
        }

        sessionObservers = [runtimeError, interrupted, interruptionEnded]
    }
    
    // PIP layer with thread-safe access
    private var _pipLayer: AVSampleBufferDisplayLayer?
    public var pipLayer: AVSampleBufferDisplayLayer? {
        get {
            pipQueue.sync { _pipLayer }
        }
        set {
            pipQueue.sync { _pipLayer = newValue }
        }
    }
    
    @objc func updateSettings(_ config: [String: Any]) {
        if let res = config["resolution"] as? String {
            targetResolution = res
        }
        if let fps = config["fps"] as? Int {
            targetFps = fps
        }
        if let format = config["fileFormat"] as? String {
            fileFormat = format
        }
        print("iOS: Updated settings: \(targetResolution), \(targetFps) fps")
    }
    
    private func applyFpsSettings(on session: AVCaptureSession) {
        guard let device = currentDevice else { return }
        do {
            try device.lockForConfiguration()
            defer { device.unlockForConfiguration() }

            let desiredFps = Double(targetFps)
            var bestFps = desiredFps

            // If the format AVFoundation already negotiated for the current session preset
            // covers the requested fps, leave it alone — do NOT search/swap formats in this
            // case. iPad camera hardware (esp. front cameras with Center Stage) exposes several
            // formats that report the same width/height as the active one but aren't actually
            // interchangeable with the outputs already attached to the session; blindly picking
            // "the first matching format" from device.formats can land on one of those and
            // break the pipeline (black preview) even though the active format was already fine.
            let activeSupportsDesiredFps = device.activeFormat.videoSupportedFrameRateRanges.contains {
                desiredFps >= $0.minFrameRate && desiredFps <= $0.maxFrameRate
            }

            if !activeSupportsDesiredFps {
                // The active format doesn't cover the requested fps at all (common on iPad,
                // where the format a plain session preset like .hd1920x1080 picks often caps
                // out at 30fps while iPhone's equivalent format goes to 60fps). Only now search
                // device.formats for an alternate one at the same resolution that does.
                let targetDimensions = CMVideoFormatDescriptionGetDimensions(device.activeFormat.formatDescription)
                var bestFormat: AVCaptureDevice.Format?

                for format in device.formats {
                    let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
                    guard dimensions.width == targetDimensions.width, dimensions.height == targetDimensions.height else { continue }
                    guard format.videoSupportedFrameRateRanges.contains(where: { desiredFps >= $0.minFrameRate && desiredFps <= $0.maxFrameRate }) else { continue }
                    bestFormat = format
                    break
                }

                if let bestFormat = bestFormat {
                    // A manual activeFormat override only sticks if the session's preset is
                    // .inputPriority — otherwise the session silently reasserts the preset's own
                    // format right back, and the frame duration set below gets validated against
                    // the OLD format's range and throws (uncaught NSInvalidArgumentException).
                    if session.sessionPreset != .inputPriority {
                        session.sessionPreset = .inputPriority
                    }
                    device.activeFormat = bestFormat
                } else if let maxRange = device.activeFormat.videoSupportedFrameRateRanges.max(by: { $0.maxFrameRate < $1.maxFrameRate }) {
                    // No format at this resolution supports the requested fps — clamp to the
                    // highest fps the current format actually supports rather than setting an
                    // out-of-range frame duration (AVFoundation raises an uncaught exception for that).
                    bestFps = maxRange.maxFrameRate
                    print("iOS: \(targetFps) fps not supported at this resolution on this device. Clamping to \(bestFps) fps")
                } else {
                    print("iOS: No supported frame rate ranges found for current format; leaving frame duration unchanged")
                    return
                }
            }

            let duration = CMTime(value: 1, timescale: CMTimeScale(bestFps))
            device.activeVideoMinFrameDuration = duration
            device.activeVideoMaxFrameDuration = duration
        } catch {
            print("Failed to set FPS: \(error)")
        }
    }
    
    /// Applies the best compatible session preset for the given camera position.
    /// iPad front cameras typically don't support 4K, so we must downgrade gracefully.
    private func applyBestPreset(for session: AVCaptureSession, position: AVCaptureDevice.Position) {
        // Confirmed on device: 4K combined with the movie file output + photo output +
        // video data output all attached simultaneously exceeds what iPad camera hardware
        // can sustain here — it either never delivers frames to the preview (black screen)
        // or, when hot-swapping the input on an already-running session, faults the capture
        // hardware outright (FigCaptureSourceRemote assert, session interruption, OS kill).
        // iPhone handles this same combination fine, so only iPad is capped to 1080p.
        let isIPad = UIDevice.current.userInterfaceIdiom == .pad

        if targetResolution == "4K" && position != .front && !isIPad {
            // Only attempt 4K for back camera
            if session.canSetSessionPreset(.hd4K3840x2160) {
                session.sessionPreset = .hd4K3840x2160
                print("iOS: Applied 4K preset for back camera")
                return
            }
        }
        
        // For front camera, or if 4K is not available, use 1080p
        if session.canSetSessionPreset(.hd1920x1080) {
            session.sessionPreset = .hd1920x1080
            print("iOS: Applied 1080p preset for \(position == .front ? "front" : "back") camera")
        } else if session.canSetSessionPreset(.hd1280x720) {
            // Ultimate fallback for very constrained devices
            session.sessionPreset = .hd1280x720
            print("iOS: Fell back to 720p preset")
        }
    }
    
    @objc func openCamera(facing: String, completion: ((Bool) -> Void)? = nil) {
        sessionQueue.async { [self] in
            if captureSession != nil {
                captureSession?.stopRunning()
                removeSessionObservers()
                captureSession = nil
            }

            let session = AVCaptureSession()

            // Bracket the whole setup like switchCamera() already does. Without this,
            // the session's connections (in particular the one the preview layer creates
            // for itself once AVCaptureVideoPreviewLayer(session:) is attached) can end up
            // not actually delivering frames on iPad even though startRunning() succeeds —
            // confirmed by the fact that a subsequent switchCamera() (which does use
            // begin/commitConfiguration) reliably "wakes up" the same session.
            session.beginConfiguration()

            // Apply resolution preset based on camera position
            let position: AVCaptureDevice.Position = facing == "front" ? .front : .back
            applyBestPreset(for: session, position: position)
            
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) else {
                print("Failed to get camera device")
                DispatchQueue.main.async { completion?(false) }
                return
            }

            currentDevice = device
            
            do {
                let input = try AVCaptureDeviceInput(device: device)
                if session.canAddInput(input) {
                    session.addInput(input)
                }
                
                let audioDevice = AVCaptureDevice.default(for: .audio)
                if let audioDevice = audioDevice {
                    let audioInput = try AVCaptureDeviceInput(device: audioDevice)
                    if session.canAddInput(audioInput) {
                        session.addInput(audioInput)
                    }
                }
                
                let output = AVCaptureMovieFileOutput()
                if session.canAddOutput(output) {
                    session.addOutput(output)
                    videoOutput = output
                    if let connection = output.connection(with: .video) {
                        if connection.isVideoOrientationSupported {
                            connection.videoOrientation = .portrait
                        }
                        // Apply target FPS safely
                        self.applyFpsSettings(on: session)
                        if connection.isVideoMirroringSupported && position == .front {
                            connection.isVideoMirrored = true
                        }
                    }
                }
                
                let pOutput = AVCapturePhotoOutput()
                if session.canAddOutput(pOutput) {
                    session.addOutput(pOutput)
                    photoOutput = pOutput
                    if let connection = pOutput.connection(with: .video) {
                        if connection.isVideoOrientationSupported {
                            connection.videoOrientation = .portrait
                        }
                        if connection.isVideoMirroringSupported && position == .front {
                            connection.isVideoMirrored = true
                        }
                    }
                }
                
                let dataOutput = AVCaptureVideoDataOutput()
                dataOutput.alwaysDiscardsLateVideoFrames = true
                dataOutput.setSampleBufferDelegate(self, queue: DispatchQueue(label: "videoQueue"))
                if session.canAddOutput(dataOutput) {
                    session.addOutput(dataOutput)
                    if let connection = dataOutput.connection(with: .video) {
                        if connection.isVideoOrientationSupported {
                            connection.videoOrientation = .portrait
                        }
                        if connection.isVideoMirroringSupported && position == .front {
                            connection.isVideoMirrored = true
                        }
                    }
                }
                
                session.commitConfiguration()

                captureSession = session
                registerSessionObservers(for: session)

                pipQueue.sync {
                    _pipLayer?.flushAndRemoveImage()
                }

                session.startRunning()

                DispatchQueue.main.async {
                    NotificationCenter.default.post(name: NSNotification.Name("DualCameraSessionReady"), object: session)
                    completion?(true)
                }

            } catch {
                print("Failed to setup camera input: \(error)")
                DispatchQueue.main.async { completion?(false) }
            }
        }
    }

    @objc func switchCamera(facing: String, completion: ((Bool) -> Void)? = nil) {
        // Flush PIP layer before switching to prevent stale frames from old camera
        pipQueue.sync {
            _pipLayer?.flushAndRemoveImage()
        }

        sessionQueue.async { [self] in
            // Read captureSession on sessionQueue itself, not on the caller's thread — reading
            // it earlier (outside this queue) raced against openCamera()'s teardown of the same
            // property from sessionQueue and was the cause of the prior iPad SIGABRT.
            guard let session = captureSession else {
                openCamera(facing: facing, completion: completion)
                return
            }

            session.beginConfiguration()
            
            // Remove existing video input
            for input in session.inputs {
                if let deviceInput = input as? AVCaptureDeviceInput, deviceInput.device.hasMediaType(.video) {
                    session.removeInput(deviceInput)
                }
            }
            
            let position: AVCaptureDevice.Position = facing == "front" ? .front : .back
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) else {
                print("iOS: Failed to get \(facing) camera device")
                session.commitConfiguration()
                DispatchQueue.main.async { completion?(false) }
                return
            }
            
            // Re-apply a compatible session preset for the new camera device
            // This is critical: iPad front cameras do NOT support 4K, so if we were
            // running at 4K on the back camera, we must downgrade before adding the
            // front camera input — otherwise AVCaptureSession crashes.
            self.applyBestPreset(for: session, position: position)
            
            self.currentDevice = device

            var success = false
            do {
                let input = try AVCaptureDeviceInput(device: device)
                if session.canAddInput(input) {
                    session.addInput(input)

                    // Re-apply orientation and mirroring for all outputs
                    for output in session.outputs {
                        if let connection = output.connection(with: .video) {
                            if connection.isVideoOrientationSupported {
                                connection.videoOrientation = .portrait
                            }
                            if connection.isVideoMirroringSupported && position == .front {
                                connection.isVideoMirrored = true
                            } else if connection.isVideoMirroringSupported {
                                connection.isVideoMirrored = false
                            }
                        }
                    }

                    self.applyFpsSettings(on: session)
                    success = true
                } else {
                    // canAddInput failed — this can happen if the preset is still
                    // incompatible. Fall back to the safest preset and retry.
                    print("iOS: canAddInput failed for \(facing) camera, falling back to .hd1280x720")
                    if session.canSetSessionPreset(.hd1280x720) {
                        session.sessionPreset = .hd1280x720
                    }
                    if session.canAddInput(input) {
                        session.addInput(input)
                        for output in session.outputs {
                            if let connection = output.connection(with: .video) {
                                if connection.isVideoOrientationSupported {
                                    connection.videoOrientation = .portrait
                                }
                                if connection.isVideoMirroringSupported && position == .front {
                                    connection.isVideoMirrored = true
                                } else if connection.isVideoMirroringSupported {
                                    connection.isVideoMirrored = false
                                }
                            }
                        }
                        self.applyFpsSettings(on: session)
                        success = true
                    } else {
                        print("iOS: CRITICAL — cannot add \(facing) camera input even at 720p")
                    }
                }
            } catch {
                print("iOS: Failed to switch camera input: \(error)")
            }

            session.commitConfiguration()
            DispatchQueue.main.async { completion?(success) }
        }
    }
    
    @objc func closeCamera(completion: (() -> Void)? = nil) {
        sessionQueue.async { [self] in
            // AVCaptureSession.stopRunning() is synchronous (unlike Camera2's
            // async close()/onClosed() on Android) — by the time this line
            // returns the session is genuinely fully stopped, so completion
            // can fire right here with no separate "wait for real close"
            // signal needed.
            captureSession?.stopRunning()
            removeSessionObservers()
            captureSession = nil
            videoOutput = nil
            photoOutput = nil
            currentDevice = nil
            DispatchQueue.main.async { completion?() }
        }
    }

    /**
     * Close-then-reopen the camera entirely on the native side. Mirrors
     * Android's DualCameraModule.reopenCamera() — used when the app resumes
     * from background (gallery visit, task switch) where the old session
     * needs a clean restart.
     */
    @objc func reopenCamera(facing: String, completion: ((Bool) -> Void)? = nil) {
        closeCamera { [self] in
            openCamera(facing: facing, completion: completion)
        }
    }

    @objc func setTorch(enabled: Bool) {
        sessionQueue.async { [self] in
            guard let device = currentDevice, device.hasTorch else { return }
            do {
                try device.lockForConfiguration()
                device.torchMode = enabled ? .on : .off
                device.unlockForConfiguration()
            } catch {
                print("Failed to set torch: \(error)")
            }
        }
    }

    @objc func startRecording(completion: @escaping (String?) -> Void) {
        sessionQueue.async { [self] in
            guard let output = videoOutput, !output.isRecording else {
                completion(nil)
                return
            }

            let paths = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
            // AVCaptureMovieFileOutput always writes QuickTime (.mov) content —
            // that's the only container it can produce, regardless of what the
            // user picked. The extension here reflects that raw capture
            // truthfully; if "MP4" was requested, RecordingDelegate converts
            // this .mov into a genuine .mp4 once recording finishes.
            let fileUrl = paths[0].appendingPathComponent("DualShot_\(Date().timeIntervalSince1970).mov")

            let delegate = RecordingDelegate(completion: completion, requestedFileFormat: self.fileFormat)

            // We must hold a strong reference to the delegate until recording finishes
            // For simplicity, we just use a static reference or similar in a real app,
            // but here we can just use an associated object or singleton property
            self.recordingDelegate = delegate

            output.startRecording(to: fileUrl, recordingDelegate: delegate)
        }
    }

    @objc func stopRecording(completion: @escaping (String?) -> Void) {
        sessionQueue.async { [self] in
            guard let output = videoOutput, output.isRecording else {
                completion(nil)
                return
            }

            if let delegate = self.recordingDelegate {
                delegate.completion = completion
            }

            output.stopRecording()
        }
    }
    
    // Store strong reference to delegate
    private var recordingDelegate: RecordingDelegate?
    private var photoCaptureDelegate: PhotoCaptureDelegate?
    
    @objc func takePhoto(completion: @escaping (String?) -> Void) {
        // Read device orientation on main thread to ensure accuracy
        DispatchQueue.main.async {
            UIDevice.current.beginGeneratingDeviceOrientationNotifications()
            let deviceOrientation = UIDevice.current.orientation
            UIDevice.current.endGeneratingDeviceOrientationNotifications()
            
            self.sessionQueue.async { [weak self] in
                guard let self = self, let output = self.photoOutput else {
                    completion(nil)
                    return
                }

                // Update the connection orientation to match physical device orientation
                if let connection = output.connection(with: .video), connection.isVideoOrientationSupported {
                    switch deviceOrientation {
                    case .portraitUpsideDown:
                        connection.videoOrientation = .portraitUpsideDown
                    case .landscapeLeft:
                        connection.videoOrientation = .landscapeRight
                    case .landscapeRight:
                        connection.videoOrientation = .landscapeLeft
                    default:
                        // Default to portrait if unknown or face up/down
                        connection.videoOrientation = .portrait
                    }
                }

                let settings = AVCapturePhotoSettings()

                AudioServicesPlaySystemSound(1108)

                if let device = self.currentDevice, device.hasTorch, device.torchMode == .on {
                    settings.flashMode = .on
                } else {
                    settings.flashMode = .off
                }

                let delegate = PhotoCaptureDelegate(completion: completion)
                self.photoCaptureDelegate = delegate

                output.capturePhoto(with: settings, delegate: delegate)
            }
        }
    }
}

class RecordingDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
    var completion: ((String?) -> Void)?
    private var startCompletion: ((String?) -> Void)?
    private let requestedFileFormat: String

    init(completion: @escaping (String?) -> Void, requestedFileFormat: String) {
        self.startCompletion = completion
        self.requestedFileFormat = requestedFileFormat
        super.init()
    }

    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        startCompletion?(fileURL.path)
        startCompletion = nil
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        guard error == nil else {
            completion?(nil)
            completion = nil
            return
        }

        // The raw file is always QuickTime (.mov) — see startRecording(). Only
        // convert when the user actually asked for MP4; MOV needs no work.
        guard requestedFileFormat == "MP4" else {
            completion?(outputFileURL.path)
            completion = nil
            return
        }

        RecordingDelegate.exportToMP4(sourceURL: outputFileURL) { [weak self] finalPath in
            self?.completion?(finalPath)
            self?.completion = nil
        }
    }

    /// Converts a QuickTime (.mov) recording into a genuine MP4 container via
    /// AVAssetExportSession — Apple's own AVFoundation API for exactly this,
    /// no third-party dependency. Falls back to the original .mov path (still
    /// playable almost everywhere) if the export session can't be created or
    /// the export itself fails, so a conversion hiccup never loses the
    /// recording outright.
    private static func exportToMP4(sourceURL: URL, completion: @escaping (String?) -> Void) {
        let outputURL = sourceURL.deletingPathExtension().appendingPathExtension("mp4")
        try? FileManager.default.removeItem(at: outputURL)

        let asset = AVURLAsset(url: sourceURL)
        guard let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
            print("MP4 export: could not create export session, keeping .mov")
            completion(sourceURL.path)
            return
        }
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4

        exportSession.exportAsynchronously {
            switch exportSession.status {
            case .completed:
                try? FileManager.default.removeItem(at: sourceURL)
                completion(outputURL.path)
            default:
                print("MP4 export failed: \(exportSession.error?.localizedDescription ?? "unknown"), keeping .mov")
                completion(sourceURL.path)
            }
        }
    }
}

class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    var completion: ((String?) -> Void)?
    
    init(completion: @escaping (String?) -> Void) {
        self.completion = completion
        super.init()
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard let data = photo.fileDataRepresentation(), error == nil else {
            completion?(nil)
            completion = nil
            return
        }
        
        var finalData = data
        // Fix orientation for React Native which often ignores EXIF orientation flags
        if let image = UIImage(data: data), image.imageOrientation != .up {
            UIGraphicsBeginImageContextWithOptions(image.size, false, image.scale)
            image.draw(in: CGRect(origin: .zero, size: image.size))
            if let normalizedImage = UIGraphicsGetImageFromCurrentImageContext(),
               let jpegData = normalizedImage.jpegData(compressionQuality: 0.9) {
                finalData = jpegData
            }
            UIGraphicsEndImageContext()
        }
        
        let paths = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
        let fileUrl = paths[0].appendingPathComponent("DualShot_\(Date().timeIntervalSince1970).jpg")
        
        do {
            try finalData.write(to: fileUrl)
            completion?(fileUrl.path)
        } catch {
            print("Error saving photo: \(error)")
            completion?(nil)
        }
        completion = nil
    }
}

extension DualCameraController: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        // Thread-safe access to the PIP layer via dedicated queue
        pipQueue.sync {
            guard let pipLayer = self._pipLayer else { return }
            if pipLayer.status == .failed {
                pipLayer.flushAndRemoveImage()
                return
            }
            if pipLayer.isReadyForMoreMediaData {
                pipLayer.enqueue(sampleBuffer)
            }
        }
    }
}
