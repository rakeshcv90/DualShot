import React, { useEffect, useRef } from 'react';
import {
  requireNativeComponent,
  NativeModules,
  StyleSheet,
  Platform,
} from 'react-native';

// Native views
const NativeMainView = requireNativeComponent('DualCameraMainView');
const NativePipView = requireNativeComponent('DualCameraPipView');

// Native module
const { DualCameraModule } = NativeModules;

/**
 * Main camera preview - full screen.
 * Uses native Camera2 API to render the camera feed.
 */
export const DualCameraMainView = ({ style, ...props }) => {
  return <NativeMainView style={[styles.fill, style]} {...props} />;
};

/**
 * PIP camera preview - small landscape.
 * Shows the SAME camera feed as the main view (Camera2 multi-surface).
 */
export const DualCameraPipView = ({ style, ...props }) => {
  return <NativePipView style={[styles.fill, style]} {...props} />;
};

/**
 * Hook to control the native dual camera.
 */
export const useDualCamera = () => {
  const openCamera = (facing = 'back', config = {}) => {
    // Pass config like { resolution: '4K', fps: 60 } to native
    DualCameraModule.openCamera(facing, config);
  };

  const closeCamera = () => {
    DualCameraModule.closeCamera();
  };

  const setTorch = (enabled) => {
    DualCameraModule.setTorch(enabled);
  };

  const switchCamera = (facing) => {
    DualCameraModule.switchCamera(facing);
  };

  const startRecording = async (config = {}) => {
    // Pass config like { fileFormat: 'MP4' } to native
    return await DualCameraModule.startRecording(config);
  };

  const stopRecording = async () => {
    return await DualCameraModule.stopRecording();
  };

  const takePhoto = async () => {
    return await DualCameraModule.takePhoto();
  };

  const savePhotoToGallery = async (filePath) => {
    if (Platform.OS === 'android') {
      return await DualCameraModule.savePhotoToGallery(filePath);
    }
    // On iOS we can still use CameraRoll
    const { CameraRoll } = require('@react-native-camera-roll/camera-roll');
    return await CameraRoll.save(`file://${filePath}`, { type: 'photo', album: 'DualShot' });
  };

  return {
    openCamera,
    closeCamera,
    setTorch,
    switchCamera,
    startRecording,
    stopRecording,
    takePhoto,
    savePhotoToGallery,
  };
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
