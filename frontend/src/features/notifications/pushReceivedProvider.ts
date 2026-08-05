import {DeviceEventEmitter} from 'react-native';

/**
 * Kotlin `FamilinkMessagingService.PUSH_RECEIVED_EVENT`와 문자열이 같아야 한다.
 * 한쪽만 바꾸면 배지 실시간 갱신이 조용히 유실된다.
 */
export const PUSH_RECEIVED_EVENT = 'FamilinkNotifications:pushReceived';

/** 구독을 등록하고 해제 함수를 반환한다. */
export type SubscribePushReceived = (listener: () => void) => () => void;

interface PushReceivedSubscription {
  remove: () => void;
}

interface PushReceivedEmitter {
  addListener: (
    eventType: string,
    listener: () => void,
  ) => PushReceivedSubscription;
}

/**
 * 앱 실행 중 푸시 도착 이벤트의 어댑터 경계. emitter를 주입할 수 있어 실제 브리지
 * 없이도 동작을 검증할 수 있다(notificationTapProvider와 같은 구조).
 */
export function createNativePushReceivedSubscriber(
  emitter: PushReceivedEmitter = DeviceEventEmitter,
): SubscribePushReceived {
  return listener => {
    const subscription = emitter.addListener(PUSH_RECEIVED_EVENT, listener);
    return () => {
      subscription.remove();
    };
  };
}

export const subscribeNativePushReceived: SubscribePushReceived =
  createNativePushReceivedSubscriber();
