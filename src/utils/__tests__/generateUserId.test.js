jest.mock('../../storage/storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

import { storage } from '../../storage/storage';
import {
  generateRandomUserId,
  getOrCreateUserId,
  getAppVersionString,
  APP_VERSION,
  BUILD_NUMBER,
} from '../generateUserId';

describe('generateRandomUserId', () => {
  it('returns a string of length 14', () => {
    const id = generateRandomUserId();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(14);
  });

  it('only contains alphanumeric characters', () => {
    const id = generateRandomUserId();
    expect(id).toMatch(/^[A-Za-z0-9]{14}$/);
  });

  it('generates different ids across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateRandomUserId()));
    // Extremely unlikely to collide across 20 draws from a 62-char, 14-length space.
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('getAppVersionString', () => {
  it('formats as "<version> (<build>)"', () => {
    expect(getAppVersionString()).toBe(`${APP_VERSION} (${BUILD_NUMBER})`);
  });

  it('matches the expected pattern', () => {
    expect(getAppVersionString()).toMatch(/^\d+\.\d+\.\d+ \(\d+\)$/);
  });
});

describe('getOrCreateUserId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the existing id from storage without persisting a new one', () => {
    storage.getString.mockReturnValue('existing-id-123');

    const result = getOrCreateUserId();

    expect(result).toBe('existing-id-123');
    expect(storage.getString).toHaveBeenCalledWith('device_user_id');
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('creates and persists a new id when none exists', () => {
    storage.getString.mockReturnValue(undefined);

    const result = getOrCreateUserId();

    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[A-Za-z0-9]{14}$/);
    expect(storage.set).toHaveBeenCalledWith('device_user_id', result);
  });
});
