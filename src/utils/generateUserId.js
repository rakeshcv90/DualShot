import { storage } from '../storage/storage';

/**
 * Generates a random user ID with format like "3Kf4zDnT9xL2mQ"
 * @returns {string} A random alphanumeric user ID
 */
export const generateRandomUserId = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let userId = '';
  for (let i = 0; i < 14; i++) {
    userId += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return userId;
};

const USER_ID_STORAGE_KEY = 'device_user_id';

/**
 * Returns this install's stable support/device identifier, generating and
 * persisting one the first time it's requested. Unlike generateRandomUserId()
 * alone, this stays the same across app restarts and Settings visits, so it's
 * actually useful for support triage.
 */
export const getOrCreateUserId = () => {
  const existing = storage.getString(USER_ID_STORAGE_KEY);
  if (existing) return existing;

  const id = generateRandomUserId();
  storage.set(USER_ID_STORAGE_KEY, id);
  return id;
};

/**
 * Gets the app version from package.json
 * @returns {string} The app version
 */
export const APP_VERSION = '0.0.1';
export const BUILD_NUMBER = '1';

export const getAppVersionString = () => {
  return `${APP_VERSION} (${BUILD_NUMBER})`;
};
