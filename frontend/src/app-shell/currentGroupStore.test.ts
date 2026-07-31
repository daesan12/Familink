import type {AsyncStorage} from '@react-native-async-storage/async-storage';

import {createCurrentGroupStore} from './currentGroupStore';

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

test('선택한 현재 그룹을 저장하고 앱 재실행 경계에서 복원한다', async () => {
  const storage = createMemoryStorage();
  const store = createCurrentGroupStore(storage);

  await expect(store.load()).resolves.toBeNull();
  await store.save(' 42 ');
  await expect(store.load()).resolves.toBe('42');
});

test('빈 그룹 ID는 저장하지 않는다', async () => {
  const store = createCurrentGroupStore(createMemoryStorage());

  await expect(store.save('   ')).rejects.toThrow(
    '현재 그룹 ID는 비어 있을 수 없습니다.',
  );
});
