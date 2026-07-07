import Foundation
import React

@objc(DualCameraModule)
class DualCameraModule: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    @objc func openCamera(_ facing: String, config: [String: Any]?) {
        DispatchQueue.main.async {
            if let config = config {
                DualCameraController.shared.updateSettings(config)
            }
            DualCameraController.shared.openCamera(facing: facing)
        }
    }
    
    @objc func closeCamera() {
        DispatchQueue.main.async {
            DualCameraController.shared.closeCamera()
        }
    }
    
    @objc func setTorch(_ enabled: Bool) {
        DualCameraController.shared.setTorch(enabled: enabled)
    }
    
    @objc func switchCamera(_ facing: String) {
        DualCameraController.shared.switchCamera(facing: facing)
    }
    
    @objc func startRecording(_ config: [String: Any]?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if let config = config {
                DualCameraController.shared.updateSettings(config)
            }
            DualCameraController.shared.startRecording { path in
                if let path = path {
                    resolve(path)
                } else {
                    reject("RECORDING_ERROR", "Failed to start recording", nil)
                }
            }
        }
    }
    
    @objc func stopRecording(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            DualCameraController.shared.stopRecording { path in
                if let path = path {
                    resolve(path)
                } else {
                    reject("RECORDING_ERROR", "Failed to stop recording", nil)
                }
            }
        }
    }
    
    @objc func takePhoto(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            DualCameraController.shared.takePhoto { path in
                if let path = path {
                    resolve(path)
                } else {
                    reject("PHOTO_ERROR", "Failed to take photo", nil)
                }
            }
        }
    }
}
