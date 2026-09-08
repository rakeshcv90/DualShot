/**
 * Single source of truth for subscription product IDs. These must match
 * exactly with the App Store Connect / Google Play Console listings.
 */
export const SUBSCRIPTION_SKUS = {
  ios: {
    monthly: 'com.dualshot.pro.monthly',
    yearly: 'com.dualshot.pro.yearly',
  },
  android: {
    monthly: 'b_monthly',
    yearly: 'a_yearly',
  },
};

export const ALL_SUBSCRIPTION_SKUS = [
  ...Object.values(SUBSCRIPTION_SKUS.ios),
  ...Object.values(SUBSCRIPTION_SKUS.android),
];
