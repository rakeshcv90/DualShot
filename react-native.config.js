module.exports = {
  dependencies: {
    // Android-only in this app: the JS layer only calls FFmpegKit when
    // Platform.OS === 'android' (see remuxToMov() in HomeScreen.js — iOS's
    // native capture output is already QuickTime, so it never needs this).
    // The iOS side of this package points at arthenica/ffmpeg-kit GitHub
    // release binaries that no longer exist (404), so autolinking it for
    // iOS breaks `pod install` for a platform that never uses it. Skipping
    // it here leaves Android linking untouched.
    '@wokcito/ffmpeg-kit-react-native': {
      platforms: {
        ios: null,
      },
    },
    'react-native-fbsdk-next': {
      platforms: {
        ios: null, // Disable on iOS because it breaks RN 0.85 C++ Fabric (Sealable missing)
      },
    },
  },
};
