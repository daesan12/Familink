import {DeviceEventEmitter, NativeModules} from 'react-native';

/**
 * Kotlin `NotificationTapStore.NOTIFICATION_TAP_EVENT`와 문자열이 같아야 한다.
 * 한쪽만 바꾸면 알림 탭이 조용히 유실된다.
 */
export const NOTIFICATION_TAP_EVENT = 'FamilinkNotifications:notificationTap';

export interface NotificationTap {
  notificationId: string;
  type?: string;
}

interface NativeNotificationTapModule {
  consumePendingNotificationTap?: () => Promise<unknown>;
}

interface NotificationTapSubscription {
  remove: () => void;
}

interface NotificationTapEmitter {
  addListener: (
    eventType: string,
    listener: (payload: unknown) => void,
  ) => NotificationTapSubscription;
}

interface NativeNotificationTapProviderOptions {
  emitter?: NotificationTapEmitter;
  nativeModule?: NativeNotificationTapModule;
}

export interface NotificationTapProvider {
  /** 콜드 스타트에 보관된 탭을 1회 가져온다. 없으면 null. */
  consumePendingTap(): Promise<NotificationTap | null>;
  subscribeTap(listener: (tap: NotificationTap) => void): () => void;
}

// notificationId가 비어 있으면 라우팅할 수 없으므로 여기서 거른다.
function toValidTap(value: unknown): NotificationTap | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const notificationId =
    typeof record.notificationId === 'string'
      ? record.notificationId.trim()
      : '';
  if (notificationId.length === 0) {
    return null;
  }
  const type = typeof record.type === 'string' ? record.type.trim() : '';
  return {
    notificationId,
    ...(type.length === 0 ? {} : {type}),
  };
}

/**
 * OS 알림 탭 어댑터 경계. 네이티브 모듈과 이벤트 emitter를 주입할 수 있어
 * 실제 브리지 없이도 동작을 검증할 수 있다(deviceTokenProvider와 같은 구조).
 */
export function createNativeNotificationTapProvider(
  options: NativeNotificationTapProviderOptions = {},
): NotificationTapProvider {
  const {
    emitter = DeviceEventEmitter,
    nativeModule = NativeModules.FamilinkNotifications as
      | NativeNotificationTapModule
      | undefined,
  } = options;

  return {
    async consumePendingTap(): Promise<NotificationTap | null> {
      if (nativeModule?.consumePendingNotificationTap === undefined) {
        return null;
      }
      try {
        return toValidTap(await nativeModule.consumePendingNotificationTap());
      } catch {
        return null;
      }
    },

    subscribeTap(listener: (tap: NotificationTap) => void): () => void {
      const subscription = emitter.addListener(
        NOTIFICATION_TAP_EVENT,
        payload => {
          const tap = toValidTap(payload);
          if (tap !== null) {
            listener(tap);
          }
        },
      );
      return () => {
        subscription.remove();
      };
    },
  };
}

export const nativeNotificationTapProvider: NotificationTapProvider =
  createNativeNotificationTapProvider();
