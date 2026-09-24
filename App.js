import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Provider } from 'react-redux';
import { store } from './src/redux/store';
import { useInAppUpdate } from './src/hooks/useInAppUpdate';
import { useProValidation } from './src/hooks/useProValidation';

import { Settings, AppEventsLogger } from 'react-native-fbsdk-next';
const AppContent = () => {
  // Check for updates on app start
  useInAppUpdate();
  // Validate Pro subscription in the background
  useProValidation();

  useEffect(() => {
    if (Platform.OS === 'android') {
      Settings.setAppID('2019040852016387');
      Settings.initializeSDK();
      Settings.setAdvertiserTrackingEnabled(true);
      AppEventsLogger.logEvent('fb_mobile_activate_app');
    }
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </Provider>
  );
};

export default App;
