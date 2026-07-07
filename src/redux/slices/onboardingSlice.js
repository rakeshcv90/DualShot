import { createSlice } from '@reduxjs/toolkit';
import { storage } from '../../storage/storage';

// Try to load initial state from MMKV
const getPersistedState = () => {
  try {
    const savedState = storage.getString('onboarding_state');
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (e) {
    console.error('Failed to load onboarding state:', e);
  }
  return {
    selectedQ1: null,
    selectedQ2: [],
    isIntroDone: false,
    isOnboardingDone: false,
  };
};

const initialState = getPersistedState();

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    setSelectedQ1: (state, action) => {
      state.selectedQ1 = action.payload;
    },
    setSelectedQ2: (state, action) => {
      state.selectedQ2 = action.payload;
    },
    setIntroDone: (state, action) => {
      state.isIntroDone = action.payload;
    },
    setOnboardingDone: (state, action) => {
      state.isOnboardingDone = action.payload;
    },
    resetOnboarding: (state) => {
      state.selectedQ1 = null;
      state.selectedQ2 = [];
      state.isIntroDone = false;
      state.isOnboardingDone = false;
    },
  },
});

export const { setSelectedQ1, setSelectedQ2, setIntroDone, setOnboardingDone, resetOnboarding } = onboardingSlice.actions;
export default onboardingSlice.reducer;
