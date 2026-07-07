import UIKit
import AVFoundation
import React

@objc(DualCameraPipViewManager)
class DualCameraPipViewManager: RCTViewManager {
    override func view() -> UIView! {
        return DualCameraPipView()
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

class DualCameraPipView: UIView {
    private var displayLayer: AVSampleBufferDisplayLayer?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        self.backgroundColor = UIColor.black
        setupLayer()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        self.backgroundColor = UIColor.black
        setupLayer()
    }
    
    private func setupLayer() {
        let layer = AVSampleBufferDisplayLayer()
        layer.videoGravity = .resizeAspectFill
        layer.frame = self.bounds
        
        self.layer.insertSublayer(layer, at: 0)
        self.displayLayer = layer
        
        // Register this layer with the singleton so it receives frames
        DualCameraController.shared.pipLayer = layer
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        if let layer = displayLayer {
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            layer.frame = self.bounds
            CATransaction.commit()
        }
    }
    
    deinit {
        if DualCameraController.shared.pipLayer == displayLayer {
            DualCameraController.shared.pipLayer = nil
        }
    }
}
