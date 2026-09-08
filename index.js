/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

if (!__DEV__) {
  // Release builds: keep warn/error (crash diagnostics, native bridge
  // warnings) but drop the day-to-day console.log noise scattered through
  // screens/hooks — it's dev-time debugging output, not user-facing.
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

AppRegistry.registerComponent(appName, () => App);
