import { createSlice } from '@reduxjs/toolkit';
import { storage } from '../../storage/storage';

const getPersistedSettings = () => {
  const defaults = {
    resolution: '1080p',
    fps: 30,
    fileFormat: 'MP4',
    themeMode: 'system',
    language: 'en',
  };

  try {
    const saved = storage.getString('settings_state');
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return defaults;
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState: getPersistedSettings(),
  reducers: {
    setResolution: (state, action) => {
      state.resolution = action.payload;
      storage.set('settings_state', JSON.stringify(state));
    },
    setFps: (state, action) => {
      state.fps = action.payload;
      storage.set('settings_state', JSON.stringify(state));
    },
    setFileFormat: (state, action) => {
      state.fileFormat = action.payload;
      storage.set('settings_state', JSON.stringify(state));
    },
    setThemeMode: (state, action) => {
      state.themeMode = action.payload;
      storage.set('settings_state', JSON.stringify(state));
    },
    setLanguage: (state, action) => {
      state.language = action.payload;
      storage.set('settings_state', JSON.stringify(state));
    },
  },
});

export const { setResolution, setFps, setFileFormat, setThemeMode, setLanguage } = settingsSlice.actions;
export default settingsSlice.reducer;
