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
    },
    setFps: (state, action) => {
      state.fps = action.payload;
    },
    setFileFormat: (state, action) => {
      state.fileFormat = action.payload;
    },
    setThemeMode: (state, action) => {
      state.themeMode = action.payload;
    },
    setLanguage: (state, action) => {
      state.language = action.payload;
    },
  },
});

export const { setResolution, setFps, setFileFormat, setThemeMode, setLanguage } = settingsSlice.actions;
export default settingsSlice.reducer;
