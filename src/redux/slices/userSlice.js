import { createSlice } from '@reduxjs/toolkit';
import { storage } from '../../storage/storage';

const getPersistedUser = () => {
  const defaults = {
    isPro: false,
    activePlanId: null,
  };

  try {
    const saved = storage.getString('user_state');
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
    // Check if there was an old MMKV 'isPro' direct boolean set
    const legacyIsPro = storage.getBoolean('isPro');
    if (legacyIsPro === true) {
      return { ...defaults, isPro: true };
    }
  } catch (e) {}
  return defaults;
};

const userSlice = createSlice({
  name: 'user',
  initialState: getPersistedUser(),
  reducers: {
    setIsPro: (state, action) => {
      state.isPro = action.payload;
    },
    setActivePlan: (state, action) => {
      state.activePlanId = action.payload;
    },
  },
});

export const { setIsPro, setActivePlan } = userSlice.actions;
export default userSlice.reducer;
