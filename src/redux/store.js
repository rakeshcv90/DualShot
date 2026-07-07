import { configureStore } from '@reduxjs/toolkit';
import onboardingReducer from './slices/onboardingSlice';
import settingsReducer from './slices/settingsSlice';
import { storage } from '../storage/storage';

// Load saved state
const loadState = () => {
  try {
    const onboarding = storage.getString('onboarding_state');
    const settings = storage.getString('settings_state');
    
    const state = {};
    if (onboarding) state.onboarding = JSON.parse(onboarding);
    if (settings) state.settings = JSON.parse(settings);
    
    return Object.keys(state).length > 0 ? state : undefined;
  } catch (error) {
    console.log('Failed to load state:', error);
  }
  return undefined;
};

// Save state middleware
const persistenceMiddleware = store => next => action => {
  const result = next(action);

  if (action.type.startsWith('onboarding/')) {
    const state = store.getState();
    storage.set('onboarding_state', JSON.stringify(state.onboarding));
  }
  
  if (action.type.startsWith('settings/')) {
    const state = store.getState();
    storage.set('settings_state', JSON.stringify(state.settings));
  }

  return result;
};

export const store = configureStore({
  reducer: {
    onboarding: onboardingReducer,
    settings: settingsReducer,
  },
  preloadedState: loadState(),
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(persistenceMiddleware),
});
