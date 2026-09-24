jest.mock('react-native-mmkv', () => {
  return {
    MMKV: jest.fn(() => ({
      set: jest.fn(),
      getString: jest.fn(),
      getNumber: jest.fn(),
      getBoolean: jest.fn(),
      contains: jest.fn(),
      delete: jest.fn(),
      getAllKeys: jest.fn(),
      clearAll: jest.fn(),
      recrypt: jest.fn(),
      addOnValueChangedListener: jest.fn(),
    })),
    createMMKV: jest.fn(() => ({
      set: jest.fn(),
      getString: jest.fn(),
      getNumber: jest.fn(),
      getBoolean: jest.fn(),
      contains: jest.fn(),
      delete: jest.fn(),
      getAllKeys: jest.fn(),
      clearAll: jest.fn(),
      recrypt: jest.fn(),
      addOnValueChangedListener: jest.fn(),
    })),
  };
});

jest.mock('react-native-permissions', () => require('react-native-permissions/mock'));

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    getPhotos: jest.fn(),
    save: jest.fn(),
    deletePhotos: jest.fn(),
  },
}));

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createNativeModule: jest.fn(),
  },
}));

jest.mock('react-native-media-toolkit', () => ({
  MediaToolkit: jest.fn(),
}));

jest.mock('react-native-nitro-image', () => ({
  loadImage: jest.fn(),
}));

jest.mock('@wokcito/ffmpeg-kit-react-native', () => ({
  FFmpegKit: {
    execute: jest.fn(),
  },
  ReturnCode: {
    isSuccess: jest.fn(),
  }
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(),
}));

jest.mock('react-native-fbsdk-next', () => ({
  AppEventsLogger: {
    logEvent: jest.fn(),
  },
  LoginManager: {
    logInWithPermissions: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
}));

jest.mock('react-native-device-info', () => require('react-native-device-info/jest/react-native-device-info-mock'));

jest.mock('sp-react-native-in-app-updates', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      checkNeedsUpdate: jest.fn(),
      startUpdate: jest.fn(),
      addStatusUpdateListener: jest.fn(),
      removeStatusUpdateListener: jest.fn(),
    })),
    IAUUpdateKind: {
      FLEXIBLE: 0,
      IMMEDIATE: 1,
    },
    IAUInstallStatus: {
      PENDING: 1,
      DOWNLOADING: 2,
      INSTALLING: 3,
      INSTALLED: 4,
      FAILED: 5,
      CANCELED: 6,
      DOWNLOADED: 11,
    },
  };
});





