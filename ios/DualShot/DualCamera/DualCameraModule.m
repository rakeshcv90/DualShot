#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DualCameraModule, NSObject)

RCT_EXTERN_METHOD(openCamera:(NSString *)facing config:(NSDictionary *)config)
RCT_EXTERN_METHOD(closeCamera)
RCT_EXTERN_METHOD(setTorch:(BOOL)enabled)
RCT_EXTERN_METHOD(switchCamera:(NSString *)facing)

RCT_EXTERN_METHOD(startRecording:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(takePhoto:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
