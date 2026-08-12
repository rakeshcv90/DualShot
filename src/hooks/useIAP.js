import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { setIsPro, setActivePlan } from '../redux/slices/userSlice';
import { storage } from '../storage/storage';
import {
  requestPurchase,
  fetchProducts as fetchIAPProducts,
  purchaseUpdatedListener,
  purchaseErrorListener,
  initConnection,
  endConnection,
  finishTransaction,
  getAvailablePurchases,
} from 'react-native-iap';

// Define your SKUs (Product IDs)
// These must match exactly with your App Store Connect or Google Play Console listings
const SKU_IOS_SUBSCRIPTIONS = [
  'com.dualshot.pro.monthly',
  'com.dualshot.pro.yearly',
];
const SKU_ANDROID_SUBSCRIPTIONS = ['b_monthly', 'a_yearly'];

export const useIAP = () => {
  const dispatch = useDispatch();
  const [connected, setConnected] = useState(false);

  const [subscriptions, setSubscriptions] = useState([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [userPurchases, setUserPurchases] = useState([]);
  const [error, setError] = useState(null);

  const purchaseUpdateSubscription = useRef(null);
  const purchaseErrorSubscription = useRef(null);

  // Initialize IAP connection
  useEffect(() => {
    const init = async () => {
      try {
        await initConnection();
        setConnected(true);
        console.log('IAP Connection Initialized');

        // Fetch subscriptions
        await loadSubscriptions();
      } catch (err) {
        console.log('IAP Init Error:', err);
        setError(err?.message);
      }
    };

    init();

    // Setup purchase listeners
    setupPurchaseListeners();

    return () => {
      cleanupListeners();
    };
  }, []);

  const setupPurchaseListeners = () => {
    // Listen for successful purchases
    purchaseUpdateSubscription.current = purchaseUpdatedListener(
      async purchase => {
        console.log('Purchase Updated:', purchase);
        setIsPurchasing(false);

        try {
          // Handle the purchase
          if (purchase.transactionReceipt || purchase.purchaseToken) {
            // Both iOS and Android use finishTransaction in v15
            await finishTransaction({ purchase, isConsumable: false });

            // Update user purchases
            setUserPurchases(prev => [...prev, purchase.productId]);

            // Mark user as PRO in local storage and Redux
            storage.set('isPro', true);
            dispatch(setIsPro(true));
            dispatch(setActivePlan(purchase.productId));

            setError(null);
          }
        } catch (err) {
          console.log('Error handling purchase:', err);
          setError(err?.message);
        }
      },
    );

    // Listen for purchase errors
    purchaseErrorSubscription.current = purchaseErrorListener(error => {
      const errorString = String(error?.message || error);
      const isCancelled =
        error?.code === 'E_USER_CANCELLED' ||
        errorString.includes('user-canceled') ||
        errorString.includes('user-cancelled');

      if (isCancelled) {
        console.log('Purchase cancelled by user');
        setError('USER_CANCELLED');
      } else {
        console.log('Purchase Error:', error);
        setError(error?.message || 'Purchase failed');
      }
      setIsPurchasing(false);
    });
  };

  const cleanupListeners = () => {
    if (purchaseUpdateSubscription.current) {
      purchaseUpdateSubscription.current.remove();
    }
    if (purchaseErrorSubscription.current) {
      purchaseErrorSubscription.current.remove();
    }
  };

  const loadSubscriptions = async () => {
    try {
      // Fetch subscriptions
      const subs = await fetchIAPProducts({
        skus:
          Platform.OS === 'ios'
            ? SKU_IOS_SUBSCRIPTIONS
            : SKU_ANDROID_SUBSCRIPTIONS,
        type: 'subs',
      });
      setSubscriptions(subs);
      console.log('Subscriptions fetched:', subs);
    } catch (err) {
      console.log('Error fetching products:', err);
      setError(err?.message);
    }
  };

  const requestBuySubscription = async subscriptionSku => {
    try {
      setIsPurchasing(true);
      setError(null);

      await requestPurchase({
        request: {
          apple: { sku: subscriptionSku },
          google: { skus: [subscriptionSku] },
        },
        type: 'subs',
      });
    } catch (err) {
      console.log('Subscription Request Error:', err);
      setError(err?.message);
      setIsPurchasing(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setIsPurchasing(true);
      setError(null);

      const purchases = await getAvailablePurchases();
      console.log('Purchases fetched:', purchases);
      if (purchases && purchases.length > 0) {
        // Extract product IDs from the available purchases
        const productIds = purchases.map(purchase => purchase.productId);

        // Update user purchases
        setUserPurchases(prev => {
          const newPurchases = [...new Set([...prev, ...productIds])];
          return newPurchases;
        });

        // Mark user as PRO in local storage and Redux
        storage.set('isPro', true);
        dispatch(setIsPro(true));

        // Save the first active product ID (if multiple, grab the first valid one)
        dispatch(setActivePlan(productIds[0]));

        setIsPurchasing(false);
        return { success: true, count: purchases.length };
      } else {
        // No active subscriptions found - explicitly remove PRO access
        storage.set('isPro', false);
        dispatch(setIsPro(false));
        dispatch(setActivePlan(null));
        setUserPurchases([]);

        setIsPurchasing(false);
        return { success: true, count: 0 };
      }
    } catch (err) {
      console.log('Error restoring purchases:', err);
      setError(err?.message);
      setIsPurchasing(false);
      return { success: false, error: err };
    }
  };

  const checkSubscriptionStatus = subscriptionSku => {
    return userPurchases.includes(subscriptionSku);
  };

  const disconnect = async () => {
    try {
      if (connected) {
        await endConnection();
        setConnected(false);
      }
    } catch (err) {
      console.log('Error disconnecting IAP:', err);
    }
  };

  return {
    connected,
    subscriptions,
    isPurchasing,
    userPurchases,
    error,
    requestBuySubscription,
    checkSubscriptionStatus,
    fetchProducts: loadSubscriptions,
    disconnect,
    restorePurchases,
  };
};
