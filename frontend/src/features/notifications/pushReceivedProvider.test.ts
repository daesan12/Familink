import {
  createNativePushReceivedSubscriber,
  PUSH_RECEIVED_EVENT,
} from './pushReceivedProvider';

interface FakeEmitter {
  addListener: jest.Mock;
  emit: () => void;
  listenerCount: () => number;
}

function createEmitter(): FakeEmitter {
  const listeners = new Map<number, () => void>();
  let nextId = 0;

  return {
    addListener: jest.fn((eventType: string, listener: () => void) => {
      const id = nextId++;
      listeners.set(id, listener);
      return {eventType, remove: () => listeners.delete(id)};
    }),
    emit: () => {
      for (const listener of [...listeners.values()]) {
        listener();
      }
    },
    listenerCount: () => listeners.size,
  };
}

test('푸시 도착 이벤트를 구독해 리스너를 호출한다', () => {
  const emitter = createEmitter();
  const subscribe = createNativePushReceivedSubscriber(emitter);
  const listener = jest.fn();

  subscribe(listener);
  emitter.emit();

  expect(emitter.addListener).toHaveBeenCalledWith(
    PUSH_RECEIVED_EVENT,
    expect.any(Function),
  );
  expect(listener).toHaveBeenCalledTimes(1);
});

test('구독을 해제하면 이후 푸시 도착 이벤트를 받지 않는다', () => {
  const emitter = createEmitter();
  const subscribe = createNativePushReceivedSubscriber(emitter);
  const listener = jest.fn();

  const unsubscribe = subscribe(listener);
  unsubscribe();
  emitter.emit();

  expect(listener).not.toHaveBeenCalled();
  expect(emitter.listenerCount()).toBe(0);
});
