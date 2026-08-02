import {
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import type {DevicePermissionStatus, DeviceTokenProvider} from './types';

/**
 * Kotlin `FamilinkMessagingService.TOKEN_REFRESH_EVENT`와 문자열이 같아야 한다.
 * 한쪽만 바꾸면 갱신 토큰이 조용히 유실된다.
 */
export const FCM_TOKEN_REFRESH_EVENT = 'FamilinkNotifications:tokenRefresh';

interface NativeDeviceTokenModule {
  getFcmToken?: () => Promise<unknown>;
}

interface TokenRefreshSubscription {
  remove: () => void;
}

interface TokenRefreshEmitter {
  addListener: (
    eventType: string,
    listener: (payload: unknown) => void,
  ) => TokenRefreshSubscription;
}

interface NativeDeviceTokenProviderOptions {
  emitter?: TokenRefreshEmitter;
  nativeModule?: NativeDeviceTokenModule;
}

// 서버 계약은 공백이 아닌 토큰만 허용한다. 네이티브가 무엇을 넘기든 여기서 거른다.
function toValidToken(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Android FCM 어댑터 경계. 네이티브 모듈과 이벤트 emitter를 주입할 수 있어
 * 실제 브리지 없이도 동작을 검증할 수 있다.
 */
export function createNativeDeviceTokenProvider(
  options: NativeDeviceTokenProviderOptions = {},
): DeviceTokenProvider {
  const {
    emitter = DeviceEventEmitter,
    nativeModule = NativeModules.FamilinkNotifications as
      | NativeDeviceTokenModule
      | undefined,
  } = options;

  return {
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
      if (nativeModule?.getFcmToken === undefined) {
        return null;
      }
      try {
        return toValidToken(await nativeModule.getFcmToken());
      } catch {
        return null;
      }
    },

    subscribeTokenRefresh(listener: (token: string) => void): () => void {
      const subscription = emitter.addListener(
        FCM_TOKEN_REFRESH_EVENT,
        payload => {
          const token = toValidToken(payload);
          if (token !== null) {
            listener(token);
          }
        },
      );
      return () => {
        subscription.remove();
      };
    },
  };
}

export const nativeDeviceTokenProvider: DeviceTokenProvider =
  createNativeDeviceTokenProvider();
