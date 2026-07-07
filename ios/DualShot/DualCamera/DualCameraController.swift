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
    
    // User settings
    private var targetResolution = "1080p"
    private var targetFps = 30
    private var fileFormat = "MP4"
    
    override private init() {
        super.init()
    }
    
    @objc var currentSession: AVCaptureSession? {
        return captureSession
    }
    
    public var pipLayer: AVSampleBufferDisplayLayer?
    
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
    
    private func applyFpsSettings() {
        guard let device = currentDevice else { return }
        do {
            try device.lockForConfiguration()
            
            var finalFps = Double(targetFps)
            var foundRange = false
            
            for range in device.activeFormat.videoSupportedFrameRateRanges {
                if finalFps >= range.minFrameRate && finalFps <= range.maxFrameRate {
                    foundRange = true
                    break
                }
            }
            
            if !foundRange {
                // Clamp to the highest supported FPS in the current format
                if let maxRange = device.activeFormat.videoSupportedFrameRateRanges.max(by: { $0.maxFrameRate < $1.maxFrameRate }) {
                    finalFps = maxRange.maxFrameRate
                    print("iOS: Requested \(targetFps) fps not supported for this device/format. Clamping to \(finalFps) fps")
                }
            }
            
            let duration = CMTime(value: 1, timescale: CMTimeScale(finalFps))
            device.activeVideoMinFrameDuration = duration
            device.activeVideoMaxFrameDuration = duration
            device.unlockForConfiguration()
        } catch {
            print("Failed to set FPS: \(error)")
        }
    }
    
    @objc func openCamera(facing: String) {
        if captureSession != nil {
            captureSession?.stopRunning()
            captureSession = nil
        }
        
        let session = AVCaptureSession()
        
        // Apply resolution preset
        if targetResolution == "4K" {
            if session.canSetSessionPreset(.hd4K3840x2160) {
                session.sessionPreset = .hd4K3840x2160
            } else {
                session.sessionPreset = .hd1920x1080
            }
        } else {
            session.sessionPreset = .hd1920x1080
        }
        
        let position: AVCaptureDevice.Position = facing == "front" ? .front : .back
        
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) else {
            print("Failed to get camera device")
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
                    self.applyFpsSettings()
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
            
            captureSession = session
            
            DispatchQueue.main.async {
                self.pipLayer?.flushAndRemoveImage()
            }
            
            DispatchQueue.global(qos: .userInitiated).async {
                session.startRunning()
            }
            
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: NSNotification.Name("DualCameraSessionReady"), object: session)
            }
            
        } catch {
            print("Failed to setup camera input: \(error)")
        }
    }
    
    @objc func switchCamera(facing: String) {
        guard let session = captureSession else {
            openCamera(facing: facing)
            return
        }
        
        DispatchQueue.global(qos: .userInitiated).async {
            session.beginConfiguration()
            
            for input in session.inputs {
                if let deviceInput = input as? AVCaptureDeviceInput, deviceInput.device.hasMediaType(.video) {
                    session.removeInput(deviceInput)
                }
            }
            
            let position: AVCaptureDevice.Position = facing == "front" ? .front : .back
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) else {
                session.commitConfiguration()
                return
            }
            
            self.currentDevice = device
            
            do {
                let input = try AVCaptureDeviceInput(device: device)
                if session.canAddInput(input) {
                    session.addInput(input)
                    
                    // Re-apply orientation and mirroring for outputs
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
                    
                    self.applyFpsSettings()
                }
            } catch {
                print("Failed to switch camera input: \(error)")
            }
            
            session.commitConfiguration()
        }
    }
    
    @objc func closeCamera() {
        captureSession?.stopRunning()
        captureSession = nil
        videoOutput = nil
        photoOutput = nil
        currentDevice = nil
    }
    
    @objc func setTorch(enabled: Bool) {
        guard let device = currentDevice, device.hasTorch else { return }
        do {
            try device.lockForConfiguration()
            device.torchMode = enabled ? .on : .off
            device.unlockForConfiguration()
        } catch {
            print("Failed to set torch: \(error)")
        }
    }
    
    @objc func startRecording(completion: @escaping (String?) -> Void) {
        guard let output = videoOutput, !output.isRecording else {
            completion(nil)
            return
        }
        
        let paths = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
        let fileUrl = paths[0].appendingPathComponent("DualShot_\(Date().timeIntervalSince1970).mp4")
        
        let delegate = RecordingDelegate(completion: completion)
        
        // We must hold a strong reference to the delegate until recording finishes
        // For simplicity, we just use a static reference or similar in a real app,
        // but here we can just use an associated object or singleton property
        self.recordingDelegate = delegate
        
        output.startRecording(to: fileUrl, recordingDelegate: delegate)
    }
    
    @objc func stopRecording(completion: @escaping (String?) -> Void) {
        guard let output = videoOutput, output.isRecording else {
            completion(nil)
            return
        }
        
        if let delegate = self.recordingDelegate {
            delegate.completion = completion
        }
        
        output.stopRecording()
    }
    
    // Store strong reference to delegate
    private var recordingDelegate: RecordingDelegate?
    private var photoCaptureDelegate: PhotoCaptureDelegate?
    
    @objc func takePhoto(completion: @escaping (String?) -> Void) {
        guard let output = photoOutput else {
            completion(nil)
            return
        }
        
        let settings = AVCapturePhotoSettings()
        
        AudioServicesPlaySystemSound(1108)
        
        if let device = currentDevice, device.hasTorch, device.torchMode == .on {
            settings.flashMode = .on
        } else {
            settings.flashMode = .off
        }
        
        let delegate = PhotoCaptureDelegate(completion: completion)
        self.photoCaptureDelegate = delegate
        
        output.capturePhoto(with: settings, delegate: delegate)
    }
}

class RecordingDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
    var completion: ((String?) -> Void)?
    private var startCompletion: ((String?) -> Void)?
    
    init(completion: @escaping (String?) -> Void) {
        self.startCompletion = completion
        super.init()
    }
    
    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        startCompletion?(fileURL.path)
        startCompletion = nil
    }
    
    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        if error == nil {
            completion?(outputFileURL.path)
        } else {
            completion?(nil)
        }
        completion = nil
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
        
        let paths = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
        let fileUrl = paths[0].appendingPathComponent("DualShot_\(Date().timeIntervalSince1970).jpg")
        
        do {
            try data.write(to: fileUrl)
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
        if let pipLayer = self.pipLayer {
            if pipLayer.status == .failed {
                pipLayer.flushAndRemoveImage()
            }
            if pipLayer.isReadyForMoreMediaData {
                pipLayer.enqueue(sampleBuffer)
            }
        }
    }
}
