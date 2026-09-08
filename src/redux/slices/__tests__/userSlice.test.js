/**
 * @jest-environment node
 *
 * Tests for src/redux/slices/userSlice.js
 *
 * userSlice computes its initial state at *module load time* by reading
 * MMKV storage (see getPersistedUser). To exercise every branch of that
 * logic we reset the module registry between cases, configure the mocked
 * storage return values, and only then re-require the slice so its
 * top-level `getPersistedUser()` call runs against the configured mock.
 *
 * The default `@react-native/jest-preset` test environment sets
 * `customExportConditions = ['require', 'react-native']`, which makes
 * `immer` (a transitive dependency of `@reduxjs/toolkit`, used by
 * userSlice.js) resolve to its untranspiled ESM build and crash on
 * `export {`. Forcing the plain `node` environment for this file avoids
 * that resolution branch; it has no effect on the reducer logic under
 * test, which is plain JS with no React Native APIs.
 */

jest.mock('../../../storage/storage', () => ({
  storage: {
    getString: jest.fn(),
    getBoolean: jest.fn(),
    getNumber: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
  },
}));

const DEFAULT_STATE = { isPro: false, activePlanId: null };

// Requires a fresh copy of the slice (and its storage dependency) with the
// mocked storage configured via `configureStorage` *before* the slice's
// module-level `getPersistedUser()` executes.
const loadSlice = configureStorage => {
  jest.resetModules();
  const { storage } = require('../../../storage/storage');
  if (configureStorage) {
    configureStorage(storage);
  }
  const userSliceModule = require('../userSlice');
  return {
    storage,
    reducer: userSliceModule.default,
    setIsPro: userSliceModule.setIsPro,
    setActivePlan: userSliceModule.setActivePlan,
  };
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('userSlice initial state (getPersistedUser)', () => {
  test('defaults to { isPro: false, activePlanId: null } when nothing is persisted', () => {
    const { reducer } = loadSlice(storage => {
      storage.getString.mockReturnValue(undefined);
      storage.getBoolean.mockReturnValue(undefined);
    });

    expect(reducer(undefined, { type: '@@INIT' })).toEqual(DEFAULT_STATE);
  });

  test('hydrates from a saved "user_state" JSON blob, merged onto defaults', () => {
    const { reducer, storage } = loadSlice(storage => {
      storage.getString.mockImplementation(key =>
        key === 'user_state'
          ? JSON.stringify({ isPro: true, activePlanId: 'yearly_plan' })
          : undefined,
      );
    });

    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      isPro: true,
      activePlanId: 'yearly_plan',
    });
    // Once a saved blob is found, the legacy-key fallback must be skipped.
    expect(storage.getBoolean).not.toHaveBeenCalled();
  });

  test('a partial saved blob is merged onto the defaults, not used verbatim', () => {
    const { reducer } = loadSlice(storage => {
      storage.getString.mockReturnValue(JSON.stringify({ isPro: true }));
    });

    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      isPro: true,
      activePlanId: null,
    });
  });

  test('legacy fallback: a bare boolean "isPro" key of true is honored when no user_state is saved', () => {
    const { reducer, storage } = loadSlice(storage => {
      storage.getString.mockReturnValue(undefined);
      storage.getBoolean.mockImplementation(key => (key === 'isPro' ? true : undefined));
    });

    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      isPro: true,
      activePlanId: null,
    });
    expect(storage.getBoolean).toHaveBeenCalledWith('isPro');
  });

  test('legacy fallback is ignored when the legacy "isPro" key is false', () => {
    const { reducer } = loadSlice(storage => {
      storage.getString.mockReturnValue(undefined);
      storage.getBoolean.mockReturnValue(false);
    });

    expect(reducer(undefined, { type: '@@INIT' })).toEqual(DEFAULT_STATE);
  });

  test('legacy fallback is ignored when the legacy "isPro" key is absent (undefined)', () => {
    const { reducer } = loadSlice(storage => {
      storage.getString.mockReturnValue(undefined);
      storage.getBoolean.mockReturnValue(undefined);
    });

    expect(reducer(undefined, { type: '@@INIT' })).toEqual(DEFAULT_STATE);
  });

  test('falls back to defaults when storage.getString throws', () => {
    const { reducer, storage } = loadSlice(storage => {
      storage.getString.mockImplementation(() => {
        throw new Error('boom');
      });
    });

    expect(reducer(undefined, { type: '@@INIT' })).toEqual(DEFAULT_STATE);
    // The throw happens before the legacy check is reached.
    expect(storage.getBoolean).not.toHaveBeenCalled();
  });

  test('falls back to defaults when the saved blob is malformed JSON', () => {
    const { reducer, storage } = loadSlice(storage => {
      storage.getString.mockReturnValue('{not valid json');
    });

    expect(reducer(undefined, { type: '@@INIT' })).toEqual(DEFAULT_STATE);
    expect(storage.getBoolean).not.toHaveBeenCalled();
  });
});

describe('userSlice action creators and reducer transitions', () => {
  let reducer;
  let setIsPro;
  let setActivePlan;

  beforeEach(() => {
    ({ reducer, setIsPro, setActivePlan } = loadSlice(storage => {
      storage.getString.mockReturnValue(undefined);
      storage.getBoolean.mockReturnValue(undefined);
    }));
  });

  test('setIsPro creates a well-formed action', () => {
    expect(setIsPro(true)).toEqual({ type: 'user/setIsPro', payload: true });
  });

  test('setActivePlan creates a well-formed action', () => {
    expect(setActivePlan('monthly_plan')).toEqual({
      type: 'user/setActivePlan',
      payload: 'monthly_plan',
    });
  });

  test('setIsPro(true) sets isPro without touching activePlanId', () => {
    const prevState = { isPro: false, activePlanId: 'yearly_plan' };
    expect(reducer(prevState, setIsPro(true))).toEqual({
      isPro: true,
      activePlanId: 'yearly_plan',
    });
  });

  test('setIsPro(false) clears isPro', () => {
    const prevState = { isPro: true, activePlanId: 'yearly_plan' };
    expect(reducer(prevState, setIsPro(false))).toEqual({
      isPro: false,
      activePlanId: 'yearly_plan',
    });
  });

  test('setActivePlan sets activePlanId without touching isPro', () => {
    const prevState = { isPro: true, activePlanId: null };
    expect(reducer(prevState, setActivePlan('yearly_plan'))).toEqual({
      isPro: true,
      activePlanId: 'yearly_plan',
    });
  });

  test('setActivePlan(null) clears the active plan', () => {
    const prevState = { isPro: true, activePlanId: 'yearly_plan' };
    expect(reducer(prevState, setActivePlan(null))).toEqual({
      isPro: true,
      activePlanId: null,
    });
  });

  test('does not mutate the previous state object', () => {
    const prevState = { isPro: false, activePlanId: null };
    const nextState = reducer(prevState, setIsPro(true));

    expect(nextState).not.toBe(prevState);
    expect(prevState).toEqual({ isPro: false, activePlanId: null });
  });

  test('an unknown action returns the state unchanged', () => {
    const prevState = { isPro: true, activePlanId: 'yearly_plan' };
    expect(reducer(prevState, { type: 'some/other-action' })).toEqual(prevState);
  });
});
