import type {AsyncStorage} from '@react-native-async-storage/async-storage';

import {createOpenedJoinRequestStore} from './openedJoinRequestStore';

function createMemoryStorage(): AsyncStorage {
  const values = new Map<string, string>();
  return {
    async clear() {
      values.clear();
    },
    async getAllKeys() {
      return [...values.keys()];
    },
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async getMany(keys) {
      return Object.fromEntries(
        keys.map(key => [key, values.get(key) ?? null]),
      );
    },
    async removeItem(key) {
      values.delete(key);
    },
    async removeMany(keys) {
      keys.forEach(key => values.delete(key));
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async setMany(entries) {
      Object.entries(entries).forEach(([key, value]) => values.set(key, value));
    },
  };
}

test('입장한 가입 요청 ID를 저장하고 앱 재실행 경계에서 복원한다', async () => {
  const storage = createMemoryStorage();
  const store = createOpenedJoinRequestStore(storage);

  await expect(store.load()).resolves.toEqual([]);
  await store.add('request-1');
  await store.add('request-2');
  await store.add('request-1');
  await expect(store.load()).resolves.toEqual(['request-1', 'request-2']);
});

test('저장 개수 상한을 넘으면 오래된 ID부터 버린다', async () => {
  const store = createOpenedJoinRequestStore(createMemoryStorage());

  for (let index = 0; index < 55; index += 1) {
    await store.add(`request-${index}`);
  }

  const ids = await store.load();
  expect(ids).toHaveLength(50);
  expect(ids[0]).toBe('request-5');
  expect(ids[ids.length - 1]).toBe('request-54');
});

test('손상된 저장 값은 빈 목록으로 대체한다', async () => {
  const storage = createMemoryStorage();
  await storage.setItem('opened-approved-join-request-ids', '{not-json');
  const store = createOpenedJoinRequestStore(storage);

  await expect(store.load()).resolves.toEqual([]);
});
