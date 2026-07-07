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

/**
 * Gets the app version from package.json
 * @returns {string} The app version
 */
export const APP_VERSION = '0.0.1';
export const BUILD_NUMBER = '1';

export const getAppVersionString = () => {
  return `${APP_VERSION} (${BUILD_NUMBER})`;
};
