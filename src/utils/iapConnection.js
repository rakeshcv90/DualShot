import { initConnection } from 'react-native-iap';

/**
 * react-native-iap supports a single active native connection. useIAP and
 * useProValidation both need one, and either can mount/run before the
 * other, so this memoizes the initConnection() call: whoever calls first
 * triggers it, everyone else awaits the same promise. Never call
 * endConnection() from either hook — tearing the connection down while
 * another consumer still expects it open silently breaks purchase events.
 */
let connectionPromise = null;

export const ensureIAPConnection = () => {
  if (!connectionPromise) {
    connectionPromise = initConnection().catch(err => {
      connectionPromise = null;
      throw err;
    });
  }
  return connectionPromise;
};
