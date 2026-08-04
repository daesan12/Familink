import {createAsyncStorage} from '@react-native-async-storage/async-storage';

import {createPendingJoinRequestStore} from './pendingJoinRequestStore';

describe('pendingJoinRequestStore', () => {
  it('사용자별 요청 ID를 중복 없이 저장한다', async () => {
    const storage = createAsyncStorage('pending-join-request-test');
    await storage.clear();
    const store = createPendingJoinRequestStore(storage);

    await store.save(1, ['request-1', 'request-1', ' request-2 ']);
    await store.save(2, ['request-3']);

    await expect(store.load(1)).resolves.toEqual(['request-1', 'request-2']);
    await expect(store.load(2)).resolves.toEqual(['request-3']);
  });

  it('빈 목록은 저장값을 제거하고 손상된 값은 빈 목록으로 복구한다', async () => {
    const storage = createAsyncStorage('pending-join-request-recovery-test');
    await storage.clear();
    const store = createPendingJoinRequestStore(storage);

    await store.save(1, ['request-1']);
    await store.save(1, []);
    await expect(store.load(1)).resolves.toEqual([]);

    await storage.setItem('pending-group-join-request-ids:1', '{invalid');
    await expect(store.load(1)).resolves.toEqual([]);
  });
});
