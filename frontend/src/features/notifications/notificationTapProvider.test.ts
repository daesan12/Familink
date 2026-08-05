import {
  createNativeNotificationTapProvider,
  NOTIFICATION_TAP_EVENT,
} from './notificationTapProvider';

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

test('네이티브 모듈에 consumePendingNotificationTap이 없으면 null을 반환한다', async () => {
  const provider = createNativeNotificationTapProvider({
    emitter: createEmitter(),
    nativeModule: {},
  });

  await expect(provider.consumePendingTap()).resolves.toBeNull();
});

test('보관된 탭을 가져오고 type이 없으면 생략한다', async () => {
  const consume = jest
    .fn()
    .mockResolvedValueOnce({notificationId: '12', type: 'NEW_POST'})
    .mockResolvedValueOnce({notificationId: '13', type: null});
  const provider = createNativeNotificationTapProvider({
    emitter: createEmitter(),
    nativeModule: {consumePendingNotificationTap: consume},
  });

  await expect(provider.consumePendingTap()).resolves.toEqual({
    notificationId: '12',
    type: 'NEW_POST',
  });
  await expect(provider.consumePendingTap()).resolves.toEqual({
    notificationId: '13',
  });
});

test('보관분이 없거나 형식이 잘못됐거나 조회가 실패하면 null을 반환한다', async () => {
  const emitter = createEmitter();

  await expect(
    createNativeNotificationTapProvider({
      emitter,
      nativeModule: {
        consumePendingNotificationTap: jest.fn().mockResolvedValue(null),
      },
    }).consumePendingTap(),
  ).resolves.toBeNull();

  await expect(
    createNativeNotificationTapProvider({
      emitter,
      nativeModule: {
        consumePendingNotificationTap: jest
          .fn()
          .mockResolvedValue({notificationId: '   '}),
      },
    }).consumePendingTap(),
  ).resolves.toBeNull();

  await expect(
    createNativeNotificationTapProvider({
      emitter,
      nativeModule: {
        consumePendingNotificationTap: jest
          .fn()
          .mockRejectedValue(new Error('bridge')),
      },
    }).consumePendingTap(),
  ).resolves.toBeNull();
});

test('탭 이벤트를 구독해 리스너에 전달한다', () => {
  const emitter = createEmitter();
  const provider = createNativeNotificationTapProvider({
    emitter,
    nativeModule: {},
  });
  const listener = jest.fn();

  provider.subscribeTap(listener);
  emitter.emit({notificationId: '12', type: 'EVENT_CHANGED'});

  expect(emitter.addListener).toHaveBeenCalledWith(
    NOTIFICATION_TAP_EVENT,
    expect.any(Function),
  );
  expect(listener).toHaveBeenCalledWith({
    notificationId: '12',
    type: 'EVENT_CHANGED',
  });
});

test('notificationId가 없는 이벤트 페이로드는 리스너에 전달하지 않는다', () => {
  const emitter = createEmitter();
  const provider = createNativeNotificationTapProvider({
    emitter,
    nativeModule: {},
  });
  const listener = jest.fn();

  provider.subscribeTap(listener);
  emitter.emit(undefined);
  emitter.emit('12');
  emitter.emit({type: 'NEW_POST'});
  emitter.emit({notificationId: '  '});

  expect(listener).not.toHaveBeenCalled();
});

test('구독을 해제하면 이후 탭 이벤트를 받지 않는다', () => {
  const emitter = createEmitter();
  const provider = createNativeNotificationTapProvider({
    emitter,
    nativeModule: {},
  });
  const listener = jest.fn();

  const unsubscribe = provider.subscribeTap(listener);
  unsubscribe();
  emitter.emit({notificationId: '12'});

  expect(listener).not.toHaveBeenCalled();
  expect(emitter.listenerCount()).toBe(0);
});
