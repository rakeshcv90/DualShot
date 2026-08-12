import { useEffect, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { getAvailablePurchases, initConnection, endConnection } from 'react-native-iap';
import { setIsPro, setActivePlan } from '../redux/slices/userSlice';
import { storage } from '../storage/storage';

/**
 * Validates the user's subscription status against the Play Store / App Store
 * every time the app launches and every time the app comes back to the foreground.
 *
 * - If an active purchase is found → marks the user as Pro
 * - If NO active purchase is found → removes Pro status
 * - Always syncs the result to both Redux and MMKV local storage
 */
export const useProValidation = () => {
  const dispatch = useDispatch();

  const validateSubscription = useCallback(async () => {
    try {
      console.log('[ProValidation] Checking subscription status...');
      await initConnection();
      const purchases = await getAvailablePurchases();

      console.log('[ProValidation] Available purchases:', purchases?.length || 0);

      if (purchases && purchases.length > 0) {
        // User has active subscription(s)
        const latestPurchase = purchases[0];
        console.log('[ProValidation] Active subscription found:', latestPurchase.productId);

        storage.set('isPro', true);
        dispatch(setIsPro(true));
        dispatch(setActivePlan(latestPurchase.productId));
      } else {
        // No active subscription — user is NOT Pro
        console.log('[ProValidation] No active subscription found — removing Pro status');

        storage.set('isPro', false);
        dispatch(setIsPro(false));
        dispatch(setActivePlan(null));
      }

      await endConnection();
    } catch (error) {
      console.log('[ProValidation] Validation failed:', error?.message || error);
      // On error, don't change anything — keep whatever state we had before.
      // This prevents network issues from accidentally removing Pro access.
    }
  }, [dispatch]);

  useEffect(() => {
    // Check on first app launch
    validateSubscription();

    // Also check every time the app comes back to the foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[ProValidation] App became active — re-validating...');
        validateSubscription();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [validateSubscription]);
};
