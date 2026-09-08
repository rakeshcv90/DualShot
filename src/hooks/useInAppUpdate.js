import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import SpInAppUpdates, {
  IAUUpdateKind,
  IAUInstallStatus,
} from 'sp-react-native-in-app-updates';

export const useInAppUpdate = () => {
  const inAppUpdates = useRef(new SpInAppUpdates());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    // Disabled on iOS for now — checkForUpdate() below calls
    // checkNeedsUpdate({ appleId: '6736737373', ... }), a placeholder App
    // Store Connect app ID that was never replaced with the real one. Since
    // that lookup can never succeed, this network call just hangs for a
    // long, variable amount of time on every cold launch before giving up
    // — found to be the dominant cause of a 20-50s delay before the camera
    // view appeared. Re-enable once a real Apple App ID is set above.
    if (Platform.OS === 'ios') {
      return;
    }
    checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      const result = await inAppUpdates.current.checkNeedsUpdate(
        Platform.select({
          ios: {
            appleId: '6736737373', // Update with your actual Apple App ID from App Store Connect
            country: 'in', // Adjust country code based on your region
          },
          android: undefined,
        }),
      );

      console.log('Update Check Result:', result);

      if (result.shouldUpdate) {
        setUpdateAvailable(true);
        setUpdateInfo(result);
        startUpdate();
      }
    } catch (error) {
      if (error?.message?.includes('-10')) {
        console.log('In-app update: App not owned (expected in dev builds)');
      } else {
        console.log('In-app update check error:', error);
      }
    }
  };

  const startUpdate = async () => {
    try {
      const updateOptions = Platform.select({
        ios: {
          title: 'Update Available',
          message:
            'A new version of DualShot is available. Please update for the best experience.',
          buttonUpgradeText: 'Update Now',
          buttonCancelText: 'Later',
        },
        android: {
          updateType: IAUUpdateKind.IMMEDIATE,
        },
      });

      await inAppUpdates.current.startUpdate(updateOptions);
    } catch (error) {
      if (error?.message?.includes('-10')) {
        console.log('In-app update: App not owned (expected in dev builds)');
      } else {
        console.error('Error starting update:', error);
      }
    }
  };

  const manualCheckForUpdate = async () => {
    try {
      await checkForUpdate();
    } catch (error) {
      console.error('Manual update check error:', error);
    }
  };

  return {
    updateAvailable,
    updateInfo,
    checkForUpdate: manualCheckForUpdate,
    startUpdate,
    inAppUpdates,
  };
};
