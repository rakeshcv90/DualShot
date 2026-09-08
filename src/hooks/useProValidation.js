import { useEffect, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { getAvailablePurchases } from 'react-native-iap';
import { setIsPro, setActivePlan } from '../redux/slices/userSlice';
import { storage } from '../storage/storage';
import { ensureIAPConnection } from '../utils/iapConnection';
import { ALL_SUBSCRIPTION_SKUS } from '../utils/iapSkus';

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
      await ensureIAPConnection();
      const purchases = await getAvailablePurchases();

      // Only trust records for this app's own subscription SKUs — a stale,
      // unrelated, or unacknowledged entry from Play Billing/StoreKit's own
      // cache shouldn't be able to grant Pro access.
      const validPurchases = (purchases || []).filter(p =>
        ALL_SUBSCRIPTION_SKUS.includes(p.productId),
      );

      console.log('[ProValidation] Available purchases:', purchases?.length || 0, '- valid:', validPurchases.length);

      if (validPurchases.length > 0) {
        // User has active subscription(s)
        const latestPurchase = validPurchases[0];
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
    } catch (error) {
      console.log('[ProValidation] Validation failed:', error?.message || error);
      // On error, don't change anything — keep whatever state we had before.
      // This prevents network issues from accidentally removing Pro access.
    }
  }, [dispatch]);

  useEffect(() => {
    // Disabled on iOS for now — the ensureIAPConnection()/
    // getAvailablePurchases() StoreKit call here was found to meaningfully
    // slow down cold-launch startup (it competes with camera hardware init
    // in the same narrow startup window; a similar IAP call in
    // PaywallModal caused a ~9s hang on this same test setup). The
    // subscription gate itself is already disabled elsewhere (see
    // HomeScreen.js's "SUBSCRIPTION GATE DISABLED FOR NOW" comments), so
    // this isn't user-facing yet — re-enable for the Pro version launch.
    if (Platform.OS === 'ios') {
      return;
    }

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
