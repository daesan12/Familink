import {
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import type {DevicePermissionStatus, DeviceTokenProvider} from './types';

interface NativeDeviceTokenModule {
  getFcmToken?: () => Promise<unknown>;
}

const nativeDeviceTokenModule = NativeModules.FamilinkNotifications as
  | NativeDeviceTokenModule
  | undefined;

/**
 * Android FCM adapter boundary. The native module is optional until the app's
 * Firebase project configuration is supplied; the API lifecycle remains
 * testable through DeviceTokenProvider injection.
 */
export const nativeDeviceTokenProvider: DeviceTokenProvider = {
  async requestPermission(): Promise<DevicePermissionStatus> {
    if (Platform.OS !== 'android') {
      return 'unavailable';
    }
    if (Number(Platform.Version) < 33) {
      return 'granted';
    }

    try {
      const result = await PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS',
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return 'granted';
      }
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        return 'blocked';
      }
      return 'denied';
    } catch {
      return 'denied';
    }
  },

  async getToken(): Promise<string | null> {
    if (nativeDeviceTokenModule?.getFcmToken === undefined) {
      return null;
    }
    try {
      const token = await nativeDeviceTokenModule.getFcmToken();
      return typeof token === 'string' && token.trim().length > 0 ? token : null;
    } catch {
      return null;
    }
  },
};
