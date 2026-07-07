import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  requestSubscription,
  requestPurchase,
  getSubscriptions,
  getProducts,
  purchaseUpdatedListener,
  purchaseErrorListener,
  initConnection,
  endConnection,
  consumePurchase,
  acknowledgePurchase,
  flushFailedPurchasesCachedAsPendingAndroid,
} from 'react-native-iap';

// Define your SKUs (Product IDs)
// These must match exactly with your App Store Connect or Google Play Console listings
const SKU_IOS_SUBSCRIPTIONS = ['com.dualshot.pro.monthly', 'com.dualshot.pro.yearly'];
const SKU_ANDROID_SUBSCRIPTIONS = [
  'com.dualshot.pro.monthly',
  'com.dualshot.pro.yearly',
];
const SKU_IOS_PRODUCTS = ['com.dualshot.credits.100'];
const SKU_ANDROID_PRODUCTS = ['com.dualshot.credits.100'];

const ALL_SKUS = Platform.select({
  ios: [...SKU_IOS_SUBSCRIPTIONS, ...SKU_IOS_PRODUCTS],
  android: [...SKU_ANDROID_SUBSCRIPTIONS, ...SKU_ANDROID_PRODUCTS],
}) || [];

export const useIAP = () => {
  const [connected, setConnected] = useState(false);
  const [products, setProducts] = useState([]);
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

        // Fetch products and subscriptions
        await fetchProducts();

        // Flush failed purchases (Android)
        if (Platform.OS === 'android') {
          await flushFailedPurchasesCachedAsPendingAndroid();
        }
      } catch (err) {
        console.error('IAP Init Error:', err);
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
          if (purchase.transactionReceipt) {
            if (Platform.OS === 'ios') {
              // iOS - acknowledge purchase
              await acknowledgePurchase({
                transactionId: purchase.transactionId,
              });
            } else if (Platform.OS === 'android') {
              // Android - acknowledge purchase
              await acknowledgePurchase({
                purchaseToken: purchase.purchaseToken,
                productId: purchase.productId,
                isConsumable: false,
              });

              // If it's a consumable product, consume it
              if (isConsumableProduct(purchase.productId)) {
                await consumePurchase({
                  purchaseToken: purchase.purchaseToken,
                  productId: purchase.productId,
                });
              }
            }

            // Update user purchases
            setUserPurchases(prev => [...prev, purchase.productId]);
            setError(null);
          }
        } catch (err) {
          console.error('Error handling purchase:', err);
          setError(err?.message);
        }
      }
    );

    // Listen for purchase errors
    purchaseErrorSubscription.current = purchaseErrorListener(error => {
      console.error('Purchase Error:', error);
      setIsPurchasing(false);
      setError(error?.message || 'Purchase failed');
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

  const fetchProducts = async () => {
    try {
      // Fetch subscriptions
      const subs = await getSubscriptions({
        skus: Platform.OS === 'ios' ? SKU_IOS_SUBSCRIPTIONS : SKU_ANDROID_SUBSCRIPTIONS,
      });
      setSubscriptions(subs);
      console.log('Subscriptions fetched:', subs);

      // Fetch products
      const prods = await getProducts({
        skus: Platform.OS === 'ios' ? SKU_IOS_PRODUCTS : SKU_ANDROID_PRODUCTS,
      });
      setProducts(prods);
      console.log('Products fetched:', prods);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err?.message);
    }
  };

  const isConsumableProduct = (productId) => {
    // Define which products are consumable (can be purchased multiple times)
    const consumableSkus = ['com.dualshot.credits.100'];
    return consumableSkus.includes(productId);
  };

  const requestBuySubscription = async (subscriptionSku) => {
    try {
      setIsPurchasing(true);
      setError(null);

      await requestSubscription({
        sku: subscriptionSku,
      });
    } catch (err) {
      console.error('Subscription Request Error:', err);
      setError(err?.message);
      setIsPurchasing(false);
    }
  };

  const requestBuyProduct = async (productSku) => {
    try {
      setIsPurchasing(true);
      setError(null);

      await requestPurchase({
        sku: productSku,
        andDangerouslyFinishTransactionAutomaticallyIOS: false, // Handle manually
      });
    } catch (err) {
      console.error('Product Request Error:', err);
      setError(err?.message);
      setIsPurchasing(false);
    }
  };

  const checkSubscriptionStatus = (subscriptionSku) => {
    return userPurchases.includes(subscriptionSku);
  };

  const disconnect = async () => {
    try {
      if (connected) {
        await endConnection();
        setConnected(false);
      }
    } catch (err) {
      console.error('Error disconnecting IAP:', err);
    }
  };

  return {
    connected,
    products,
    subscriptions,
    isPurchasing,
    userPurchases,
    error,
    requestBuySubscription,
    requestBuyProduct,
    checkSubscriptionStatus,
    fetchProducts,
    disconnect,
  };
};
