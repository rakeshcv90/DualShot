# In-App Updates Implementation Guide

This project uses cross-platform in-app updates for both iOS and Android using the SpInAppUpdates library with platform-specific options.

**Packages Used:**
- `sp-react-native-in-app-updates` (Handles both Android and iOS)
  - Android: Google Play In-App Update API
  - iOS: App Store Connect API integration

## Installation

The packages are already added to `package.json`. Run:

```bash
npm install
# or
yarn install
```

## Configuration

### iOS Setup

Update your Apple App ID in `src/hooks/useInAppUpdate.js`:

```javascript
const result = await inAppUpdates.current.checkNeedsUpdate(
  Platform.select({
    ios: {
      appleId: '6736737373', // Replace with your actual App ID from App Store Connect
      country: 'in', // Change to your country code (us, uk, in, etc.)
    },
    android: undefined,
  }),
);
```

To find your Apple App ID:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **App Information**
4. Find the **App ID** (e.g., 6736737373)

### Android Setup

#### 1. Update `android/build.gradle`

Add Google Play Services to the buildscript dependencies:

```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:7.x.x'
    }
}
```

#### 2. Update `android/app/build.gradle`

Add Google Play Core library:

```gradle
dependencies {
    implementation 'com.google.android.play:core:1.10.3'
}
```

Also update your package name:

```gradle
android {
    defaultConfig {
        applicationId "com.example.dualshot"  // Update to your package name
        versionCode 1
        versionName "0.0.1"
    }
}
```

#### 3. Google Play Console Configuration

1. Upload your app to [Google Play Console](https://play.google.com/console)
2. Go to **Release > Internal testing** (for testing)
3. Upload a new version with an incremented `versionCode`
4. Updates will be detected within a few hours

## How It Works

### Update Flow

1. **App Starts** → `useInAppUpdate` hook triggers
2. **Check for Updates**:
   - Android: Checks Google Play Store
   - iOS: Checks App Store Connect
3. **If Update Available**:
   - Shows update prompt with custom title and message
   - User taps "Update Now" or "Later"
4. **Update Process**:
   - Android: Downloads and installs in-app
   - iOS: Opens App Store app for user to update

### Error Handling

The implementation handles dev build scenarios gracefully:

```javascript
if (error?.message?.includes('-10')) {
  console.log('In-app update: App not owned (expected in dev builds)');
}
```

This error is expected when testing on dev builds not linked to App Store/Play Store.

## Usage

### Automatic Update Check

The hook automatically checks for updates when the app starts:

```javascript
const AppContent = () => {
  useInAppUpdate(); // Automatically checks for updates

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
};
```

### Manual Update Check

Trigger update check from any component:

```javascript
import { useInAppUpdate } from '../hooks/useInAppUpdate';

export function SettingsScreen() {
  const { checkForUpdate } = useInAppUpdate();

  return (
    <TouchableOpacity onPress={checkForUpdate}>
      <Text>Check for Updates</Text>
    </TouchableOpacity>
  );
}
```

## Platform-Specific Behavior

| Platform | Update Method | User Experience |
|----------|---------------|-----------------|
| **Android** | In-app Download | App downloads & installs, then restarts |
| **iOS** | Opens App Store | User taps "Update" in App Store app |

## Update Types

### Android

Update types are controlled by the `IAUUpdateKind`:

```javascript
// Flexible Update - User can skip/delay
updateType: IAUUpdateKind.FLEXIBLE

// Immediate Update - Forces update (IMMEDIATE is set by default)
updateType: IAUUpdateKind.IMMEDIATE
```

### iOS

Customizable dialog:

```javascript
buttonUpgradeText: 'Update Now'      // Button to start update
buttonCancelText: 'Later'             // Button to dismiss
```

## Install Status

Track update installation status (Android):

```javascript
import { IAUInstallStatus } from 'sp-react-native-in-app-updates';

// Possible statuses:
// IAUInstallStatus.PENDING
// IAUInstallStatus.DOWNLOADING
// IAUInstallStatus.INSTALLING
// IAUInstallStatus.INSTALLED
// IAUInstallStatus.FAILED
```

## Testing

### Android Testing

1. Build and upload version 1 to Google Play Console
2. Create version 2 with incremented `versionCode`
3. Upload version 2 to Google Play Console
4. Install version 1 on test device
5. App will detect and prompt for update
6. Tap "Update Now" to download and install version 2

**Note**: Wait 2-3 hours for Play Store to process the upload

### iOS Testing

1. Create app on App Store Connect
2. Upload version 1.0.0
3. Create and upload version 1.0.1
4. Install version 1.0.0 on test device
5. App will detect newer version
6. Tap "Update Now" to open App Store

**Note**: Wait for App Store to approve the new version

### Development Testing

When testing in development (dev builds not linked to stores), you may see:

```
In-app update: App not owned (expected in dev builds)
```

This is expected behavior. The update check still works fine on released app store builds.

## Troubleshooting

### Update Not Detected

**Android:**
- Wait 2-3 hours for Play Store propagation
- Verify `versionCode` is higher than installed version
- Check test device is using same Google account as Play Store

**iOS:**
- Verify App ID is correct in `useInAppUpdate.js`
- Check version number is higher than installed
- Ensure test device has internet connectivity
- Try with same Apple ID used in App Store Connect

### Common Errors

**Error -10 (App Not Owned)**
- Expected in dev builds
- Normal on released builds from correct store

**Error -1 (Network)**
- Check internet connectivity
- Verify API credentials (Apple ID, Google Play)

**App Crashes on Update Check**
- Verify `sp-react-native-in-app-updates` is properly installed
- Check console logs for specific error messages

## Version Management

### Android

Update in `android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 2  // Increment for each release
    versionName "0.0.2"
}
```

### iOS

Update in Xcode:
- Target → General → Version (e.g., 0.0.1)
- Target → General → Build (e.g., 1)

### JavaScript

Update in `src/utils/generateUserId.js`:

```javascript
export const APP_VERSION = '0.0.2';
export const BUILD_NUMBER = '2';
```

## Country Codes

The iOS configuration uses country codes to connect to the correct App Store region:

| Code | Country |
|------|---------|
| `us` | United States |
| `gb` | United Kingdom |
| `in` | India |
| `au` | Australia |
| `ca` | Canada |
| `de` | Germany |
| `fr` | France |
| `jp` | Japan |

Update the `country` parameter in `useInAppUpdate.js` based on your target region.



