import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Provider } from 'react-redux';
import { store } from './src/redux/store';
import { useInAppUpdate } from './src/hooks/useInAppUpdate';
import { useProValidation } from './src/hooks/useProValidation';

const AppContent = () => {
  // Check for updates on app start
  useInAppUpdate();
  // Validate Pro subscription in the background
  useProValidation();

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
