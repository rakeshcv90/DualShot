# In-App Purchases (IAP) Implementation Guide

This guide covers setting up In-App Purchases for **iOS** (App Store) and **Android** (Google Play Store).

## Overview

The `useIAP` hook provides:
- ✅ Product & Subscription fetching
- ✅ Purchase handling for both platforms
- ✅ Automatic receipt validation
- ✅ Purchase listener management
- ✅ Error handling
- ✅ Consumable product support

## Installation

Already installed in your project:
- `react-native-iap` (v15.3.6)
- `react-native-nitro-modules` (v0.35.6)

## Product IDs (SKUs) Configuration

Update `src/hooks/useIAP.js` with your actual product IDs from App Store Connect and Google Play Console:

```javascript
// Subscriptions (Monthly & Yearly)
const SKU_IOS_SUBSCRIPTIONS = ['com.dualshot.pro.monthly', 'com.dualshot.pro.yearly'];
const SKU_ANDROID_SUBSCRIPTIONS = ['com.dualshot.pro.monthly', 'com.dualshot.pro.yearly'];

// One-time Products (Credits)
const SKU_IOS_PRODUCTS = ['com.dualshot.credits.100'];
const SKU_ANDROID_PRODUCTS = ['com.dualshot.credits.100'];
```

## iOS Setup (App Store Connect)

### 1. Create Bundle ID

1. Go to [Developer.apple.com](https://developer.apple.com)
2. Certificates, IDs & Profiles → Identifiers
3. Register a new App ID (e.g., `com.example.dualshot`)
4. Enable In-App Purchase capability

### 2. Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. My Apps → Create App
3. Use same Bundle ID as above
4. Configure App information

### 3. Create Products

#### Subscription Products:
1. In-App Purchases → Create New → Subscription
2. Reference Name: "PRO Monthly"
3. Subscription ID: `com.dualshot.pro.monthly`
4. Set pricing and billing cycle
5. Submit for review

#### One-Time Products:
1. In-App Purchases → Create New → Consumable
2. Reference Name: "100 Credits"
3. Product ID: `com.dualshot.credits.100`
4. Set pricing
5. Submit for review

### 4. Set Up Sandbox Tester

1. Users → Sandbox Testers
2. Create sandbox tester account
3. Use this account for testing purchases

## Android Setup (Google Play Console)

### 1. Create App

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Complete app details and release to testing

### 2. Configure Products

#### Subscription Products:
1. Monetize → In-app products → Subscriptions
2. Create Subscription
3. Product ID: `com.dualshot.pro.monthly`
4. Set name, description, and pricing
5. Save and publish

#### One-Time Products:
1. Monetize → In-app products → Products
2. Create Product
3. Product ID: `com.dualshot.credits.100`
4. Set name, description, and pricing
5. Save and publish

### 3. Set Up Test Account

1. Settings → License testing
2. Add test account email
3. Use this account for testing

## Usage in Components

### Example: PaywallModal with IAP

```javascript
import { useIAP } from '../hooks/useIAP';

export const PaywallModal = ({ visible, onClose }) => {
  const {
    subscriptions,
    products,
    isPurchasing,
    error,
    requestBuySubscription,
    requestBuyProduct,
    userPurchases,
    checkSubscriptionStatus,
  } = useIAP();

  const handleSubscribe = (sku) => {
    requestBuySubscription(sku);
  };

  const handleBuyCredits = (sku) => {
    requestBuyProduct(sku);
  };

  const isProUser = checkSubscriptionStatus('com.dualshot.pro.monthly');

  return (
    <Modal visible={visible} transparent>
      <View style={styles.container}>
        {/* Display subscriptions */}
        {subscriptions.map(sub => (
          <TouchableOpacity
            key={sub.productId}
            onPress={() => handleSubscribe(sub.productId)}
            disabled={isPurchasing}
          >
            <Text>{sub.title}</Text>
            <Text>{sub.localizedPrice}</Text>
          </TouchableOpacity>
        ))}

        {/* Display products */}
        {products.map(prod => (
          <TouchableOpacity
            key={prod.productId}
            onPress={() => handleBuyCredits(prod.productId)}
            disabled={isPurchasing}
          >
            <Text>{prod.title}</Text>
            <Text>{prod.localizedPrice}</Text>
          </TouchableOpacity>
        ))}

        {error && <Text>{error}</Text>}
        {isPurchasing && <Text>Processing...</Text>}

        <TouchableOpacity onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};
```

### Check if User is PRO

```javascript
const { checkSubscriptionStatus } = useIAP();

const isPro = checkSubscriptionStatus('com.dualshot.pro.monthly');

if (isPro) {
  // Show PRO features
} else {
  // Show upgrade prompt
}
```

### Listen to Purchase Errors

```javascript
const { error, isPurchasing } = useIAP();

useEffect(() => {
  if (error) {
    console.log('Purchase failed:', error);
    Alert.alert('Purchase Error', error);
  }
}, [error]);
```

## Product Types

### Subscriptions
- Recurring billing (monthly, yearly, etc.)
- Auto-renew
- User can manage in device settings
- Good for: PRO membership

### Consumable Products
- One-time purchase
- Can be purchased multiple times
- No auto-renew
- Good for: Credits, coins, one-time features

### Non-Consumable Products
- One-time purchase
- Permanently owned
- Cannot be purchased again
- Good for: Permanent features, lifetime access

## Testing

### iOS Sandbox Testing

1. Build and run on test device
2. Device Settings → App Store → Apple ID → Sandbox Tester
3. Sign in with sandbox tester account
4. Launches will prompt to purchase with sandbox account
5. No real money charged

### Android Testing

1. Build and run on test device
2. Device must have Google Play account
3. Add test account in Google Play Console
4. Sign in with test account on device
5. Purchases will show "Test Purchase" prompt
6. No real money charged

## Receipt Validation

### Server-Side Validation (Recommended)

For production, validate receipts on your backend:

**iOS:**
```bash
POST https://buy.itunes.apple.com/verifyReceipt
{
  "receipt-data": "base64_receipt",
  "password": "your_shared_secret"
}
```

**Android:**
```bash
POST https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/subscriptions/{subscriptionId}/tokens/{token}/acknowledge
Headers: Authorization: Bearer {access_token}
```

## Security Best Practices

1. **Always validate receipts** - Don't trust client-side only
2. **Use HTTPS** - For all server communication
3. **Secure shared secrets** - Don't expose in client code
4. **Handle errors gracefully** - Show user-friendly messages
5. **Store purchase state** - Use Redux or local storage
6. **Test thoroughly** - Use sandbox/test accounts

## Product List Format

```javascript
{
  productId: "com.dualshot.pro.monthly",
  title: "DualShot PRO - Monthly",
  description: "Unlimited recording and editing",
  price: "9.99",
  currency: "USD",
  localizedPrice: "$9.99",
  type: "subs" // or "iap"
}
```

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| **Product not found** | Wrong SKU/Product ID | Verify ID matches App Store/Play Store |
| **User cancelled** | User pressed back/cancel | Handle gracefully, don't show alert |
| **Network error** | No internet | Check connectivity before purchase |
| **App not owned** | Dev build not linked to store | Only happens in dev, works fine on release |

## Troubleshooting

### Products Not Loading
- Check all SKUs match exactly (case-sensitive)
- Verify products are published in store
- Try `fetchProducts()` to refresh
- Check internet connectivity

### Purchases Not Working
- Ensure test device is signed in to correct store account
- Verify product is published
- Check IAP capability is enabled (iOS)
- Rebuild and reinstall app

### Receipt Validation Fails
- Verify receipt contains valid data
- Check secret key is correct
- Ensure you're using correct validation endpoint
- Check certificate/key expiration

## Next Steps

1. **Create products** in App Store Connect & Google Play Console
2. **Update SKUs** in `useIAP.js`
3. **Build and test** using sandbox/test accounts
4. **Implement purchase handling** in PaywallModal
5. **Set up server-side validation** for receipts
6. **Release to production** once testing is complete
