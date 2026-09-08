jest.mock('../../storage/storage', () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
    getBoolean: jest.fn(),
    getNumber: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
  },
}));

import settingsReducer, {
  setResolution,
  setFps,
  setFileFormat,
  setThemeMode,
  setLanguage,
} from '../settingsSlice';

const defaultState = {
  resolution: '1080p',
  fps: 30,
  fileFormat: 'MP4',
  themeMode: 'system',
  language: 'en',
};

describe('settingsSlice', () => {
  it('returns the default initial state', () => {
    expect(settingsReducer(undefined, { type: '@@INIT' })).toEqual(defaultState);
  });

  it('handles setResolution', () => {
    const state = settingsReducer(defaultState, setResolution('4k'));
    expect(state.resolution).toBe('4k');
    // other fields unaffected
    expect(state.fps).toBe(defaultState.fps);
    expect(state.fileFormat).toBe(defaultState.fileFormat);
    expect(state.themeMode).toBe(defaultState.themeMode);
    expect(state.language).toBe(defaultState.language);
  });

  it('handles setFps', () => {
    const state = settingsReducer(defaultState, setFps(60));
    expect(state.fps).toBe(60);
    expect(state.resolution).toBe(defaultState.resolution);
  });

  it('handles setFileFormat', () => {
    const state = settingsReducer(defaultState, setFileFormat('MOV'));
    expect(state.fileFormat).toBe('MOV');
    expect(state.resolution).toBe(defaultState.resolution);
  });

  it('handles setThemeMode', () => {
    const state = settingsReducer(defaultState, setThemeMode('dark'));
    expect(state.themeMode).toBe('dark');
    expect(state.resolution).toBe(defaultState.resolution);
  });

  it('handles setLanguage', () => {
    const state = settingsReducer(defaultState, setLanguage('fr'));
    expect(state.language).toBe('fr');
    expect(state.resolution).toBe(defaultState.resolution);
  });

  it('produces action creators with the expected type strings', () => {
    expect(setResolution('720p')).toEqual({
      type: 'settings/setResolution',
      payload: '720p',
    });
    expect(setFps(24)).toEqual({
      type: 'settings/setFps',
      payload: 24,
    });
    expect(setFileFormat('MKV')).toEqual({
      type: 'settings/setFileFormat',
      payload: 'MKV',
    });
    expect(setThemeMode('light')).toEqual({
      type: 'settings/setThemeMode',
      payload: 'light',
    });
    expect(setLanguage('es')).toEqual({
      type: 'settings/setLanguage',
      payload: 'es',
    });
  });
});
