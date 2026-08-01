import {
  createNativeDeviceTokenProvider,
  FCM_TOKEN_REFRESH_EVENT,
} from './deviceTokenProvider';
import type {DeviceTokenProvider} from './types';

interface FakeEmitter {
  addListener: jest.Mock;
  emit: (payload: unknown) => void;
  listenerCount: () => number;
}

function createEmitter(): FakeEmitter {
  const listeners = new Map<number, (payload: unknown) => void>();
  let nextId = 0;

  return {
    addListener: jest.fn(
      (eventType: string, listener: (payload: unknown) => void) => {
        const id = nextId++;
        listeners.set(id, listener);
        return {eventType, remove: () => listeners.delete(id)};
      },
    ),
    emit: (payload: unknown) => {
      for (const listener of [...listeners.values()]) {
        listener(payload);
      }
    },
    listenerCount: () => listeners.size,
  };
}

// 옵셔널 호출(`provider.subscribeTokenRefresh?.(...)`)로 구독하면 구현이 사라져도
// 부정 단언이 공허하게 통과한다. 구현 여부를 먼저 확정한다.
function subscribeRefresh(
  provider: DeviceTokenProvider,
  listener: (token: string) => void,
): () => void {
  const {subscribeTokenRefresh} = provider;
  if (subscribeTokenRefresh === undefined) {
    throw new Error('subscribeTokenRefresh가 구현되어 있지 않다');
  }
  return subscribeTokenRefresh(listener);
}

test('네이티브 모듈에 getFcmToken이 없으면 토큰을 null로 반환한다', async () => {
  const provider = createNativeDeviceTokenProvider({
    emitter: createEmitter(),
    nativeModule: {},
  });

  await expect(provider.getToken()).resolves.toBeNull();
});

test('네이티브가 반환한 토큰을 그대로 전달한다', async () => {
  const getFcmToken = jest.fn().mockResolvedValue('fcm-token');
  const provider = createNativeDeviceTokenProvider({
    emitter: createEmitter(),
    nativeModule: {getFcmToken},
  });

  await expect(provider.getToken()).resolves.toBe('fcm-token');
  expect(getFcmToken).toHaveBeenCalledTimes(1);
});

test('공백이거나 문자열이 아닌 토큰은 null로 처리한다', async () => {
  const emitter = createEmitter();

  await expect(
    createNativeDeviceTokenProvider({
      emitter,
      nativeModule: {getFcmToken: jest.fn().mockResolvedValue('   ')},
    }).getToken(),
  ).resolves.toBeNull();

  await expect(
    createNativeDeviceTokenProvider({
      emitter,
      nativeModule: {getFcmToken: jest.fn().mockResolvedValue(null)},
    }).getToken(),
  ).resolves.toBeNull();
});

test('토큰 발급이 실패해도 예외를 전파하지 않고 null을 반환한다', async () => {
  const provider = createNativeDeviceTokenProvider({
    emitter: createEmitter(),
    nativeModule: {
      getFcmToken: jest.fn().mockRejectedValue(new Error('SERVICE_NOT_AVAILABLE')),
    },
  });

  await expect(provider.getToken()).resolves.toBeNull();
});

test('갱신 이벤트를 구독해 새 토큰을 리스너에 전달한다', () => {
  const emitter = createEmitter();
  const provider = createNativeDeviceTokenProvider({
    emitter,
    nativeModule: {},
  });
  const listener = jest.fn();

  subscribeRefresh(provider, listener);
  emitter.emit('refreshed-token');

  expect(emitter.addListener).toHaveBeenCalledWith(
    FCM_TOKEN_REFRESH_EVENT,
    expect.any(Function),
  );
  expect(listener).toHaveBeenCalledWith('refreshed-token');
});

test('갱신 이벤트의 공백·비문자열 페이로드는 리스너에 전달하지 않는다', () => {
  const emitter = createEmitter();
  const provider = createNativeDeviceTokenProvider({
    emitter,
    nativeModule: {},
  });
  const listener = jest.fn();

  subscribeRefresh(provider, listener);
  emitter.emit('  ');
  emitter.emit(42);
  emitter.emit(undefined);

  expect(listener).not.toHaveBeenCalled();
});

test('구독을 해제하면 이후 갱신 이벤트를 받지 않는다', () => {
  const emitter = createEmitter();
  const provider = createNativeDeviceTokenProvider({
    emitter,
    nativeModule: {},
  });
  const listener = jest.fn();

  const unsubscribe = subscribeRefresh(provider, listener);
  unsubscribe();
  emitter.emit('refreshed-token');

  expect(listener).not.toHaveBeenCalled();
  expect(emitter.listenerCount()).toBe(0);
});

test('구독 해제를 여러 번 호출해도 실패하지 않는다', () => {
  const emitter = createEmitter();
  const provider = createNativeDeviceTokenProvider({
    emitter,
    nativeModule: {},
  });

  const unsubscribe = subscribeRefresh(provider, jest.fn());

  expect(() => {
    unsubscribe();
    unsubscribe();
  }).not.toThrow();
});
