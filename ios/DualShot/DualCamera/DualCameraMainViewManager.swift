import UIKit
import AVFoundation
import React

@objc(DualCameraMainViewManager)
class DualCameraMainViewManager: RCTViewManager {
    override func view() -> UIView! {
        return DualCameraView()
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

class DualCameraView: UIView {
    private var previewLayer: AVCaptureVideoPreviewLayer?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupObserver()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupObserver()
    }
    
    private func setupObserver() {
        NotificationCenter.default.addObserver(self, selector: #selector(sessionReady(_:)), name: NSNotification.Name("DualCameraSessionReady"), object: nil)
        
        if let session = DualCameraController.shared.currentSession {
            attachSession(session)
        }
    }
    
    @objc private func sessionReady(_ notification: Notification) {
        guard let session = notification.object as? AVCaptureSession else { return }
        attachSession(session)
    }
    
    private func attachSession(_ session: AVCaptureSession) {
        DispatchQueue.main.async {
            self.previewLayer?.removeFromSuperlayer()
            
            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = self.bounds
            self.layer.addSublayer(layer)
            self.previewLayer = layer
        }
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        if let layer = previewLayer {
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            layer.frame = self.bounds
            CATransaction.commit()
        }
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
