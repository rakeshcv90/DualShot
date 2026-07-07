# react-native-iap - Quick Reference

## What is it?

**In-App Purchases (IAP)** library that enables users to buy digital products/services within your app on iOS and Android.

## What Can You Sell?

1. **Subscriptions** (Recurring)
   - Monthly/Yearly membership
   - Auto-renews
   - User can manage in device settings
   - Example: DualShot PRO membership

2. **Consumable Products** (One-time, repeatable)
   - Credits, coins, energy
   - Can be purchased multiple times
   - Example: 100 Credits

3. **Non-Consumable Products** (One-time, permanent)
   - Permanent features, lifetime access
   - Purchased once, owned forever
   - Example: Unlock watermark removal

## Your App Setup

### Already Installed ✅
- `react-native-iap` (v15.3.6)
- `react-native-nitro-modules` (v0.35.6)
- React Native 0.85.3 ✅

### You Have ✅
- PaywallModal component ready to integrate
- Redux store for state management
- Navigation and UI components

### You Need to Add

1. **Product definitions in `src/hooks/useIAP.js`**
   ```javascript
   SKU_IOS_SUBSCRIPTIONS = ['com.dualshot.pro.monthly', ...]
   SKU_ANDROID_SUBSCRIPTIONS = ['com.dualshot.pro.monthly', ...]
   ```

2. **Create products in:**
   - [App Store Connect](https://appstoreconnect.apple.com) (iOS)
   - [Google Play Console](https://play.google.com/console) (Android)

3. **Update PaywallModal** to use the `useIAP` hook

## Quick Usage Example

```javascript
import { useIAP } from '../hooks/useIAP';

export const PaywallModal = ({ visible, onClose }) => {
  const {
    subscriptions,        // Array of subscription products
    products,             // Array of product listings
    isPurchasing,         // Is purchase in progress?
    error,                // Any purchase error?
    requestBuySubscription,  // Start subscription purchase
    requestBuyProduct,       // Start product purchase
    userPurchases,           // List of purchased products
  } = useIAP();

  return (
    <Modal visible={visible}>
      {/* Show subscriptions */}
      {subscriptions.map(sub => (
        <Button
          title={`${sub.title} - ${sub.localizedPrice}`}
          onPress={() => requestBuySubscription(sub.productId)}
          disabled={isPurchasing}
        />
      ))}

      {/* Show error if any */}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}

      {isPurchasing && <Text>Processing purchase...</Text>}
    </Modal>
  );
};
```

## Purchase Flow

```
1. User taps "Upgrade Now"
        ↓
2. requestBuySubscription(sku) called
        ↓
3. Device opens App Store / Play Store
        ↓
4. User enters credentials & confirms payment
        ↓
5. Receipt generated
        ↓
6. purchaseUpdatedListener fires
        ↓
7. Receipt acknowledged
        ↓
8. User marked as PRO
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `requestBuySubscription(sku)` | Start subscription purchase |
| `requestBuyProduct(sku)` | Start one-time product purchase |
| `checkSubscriptionStatus(sku)` | Check if user has this subscription |
| `fetchProducts()` | Refresh product list |
| `disconnect()` | Clean up IAP connection |

## Product IDs (SKUs) Format

Format: `com.{company}.{app}.{product}`

Examples:
- `com.dualshot.pro.monthly` - Monthly subscription
- `com.dualshot.pro.yearly` - Yearly subscription
- `com.dualshot.credits.100` - 100 credits pack

**IMPORTANT**: SKU on iOS and Android must be identical!

## Testing Workflow

### Step 1: Create Products
- App Store Connect (iOS)
- Google Play Console (Android)

### Step 2: Update SKUs in Code
- Edit `src/hooks/useIAP.js`
- Add your product IDs

### Step 3: Set Up Test Accounts
- iOS: Sandbox Tester account
- Android: Test account in Play Console

### Step 4: Build & Test
```bash
npm run android    # or
npm run ios
```

### Step 5: Test Purchase
- Open app
- Tap "Upgrade Now"
- Complete test purchase
- Device prompts for test account credentials

## Checking Premium Status

```javascript
const { userPurchases, checkSubscriptionStatus } = useIAP();

// Check if user is PRO
if (checkSubscriptionStatus('com.dualshot.pro.monthly')) {
  // Show PRO features
  showUnlimitedRecording();
} else {
  // Show upgrade prompt
  showPaywall();
}
```

## Common Use Cases

### 1. Show PRO Features Only to Subscribers
```javascript
const isPro = userPurchases.includes('com.dualshot.pro.monthly');
if (isPro) {
  <ProFeature />
} else {
  <UpgradePrompt />
}
```

### 2. Handle Purchase Errors
```javascript
useEffect(() => {
  if (error) {
    Alert.alert('Purchase Failed', error);
  }
}, [error]);
```

### 3. Show Loading During Purchase
```javascript
{isPurchasing && <ActivityIndicator />}
```

## Production Checklist

- [ ] Create all products in App Store Connect
- [ ] Create all products in Google Play Console
- [ ] Update SKU list in `useIAP.js`
- [ ] Update PaywallModal to display products
- [ ] Test with sandbox accounts
- [ ] Set up server-side receipt validation
- [ ] Add error handling UI
- [ ] Test on real devices
- [ ] Submit to App Store
- [ ] Release on Google Play

## Files to Check/Update

- `src/hooks/useIAP.js` - Update SKUs here
- `src/component/PaywallModal.js` - Integrate IAP
- `IAP_SETUP.md` - Full documentation

## Support & Docs

- [react-native-iap Docs](https://openiap.dev)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Google Play Console](https://play.google.com/console)
