import {
  createAsyncStorage,
  type AsyncStorage,
} from '@react-native-async-storage/async-storage';

import type {CurrentGroupStore} from './types';

const CURRENT_GROUP_KEY = 'current-group-id';
const PREFERENCES_DATABASE = 'familink-preferences';

export function createCurrentGroupStore(
  storage: AsyncStorage,
): CurrentGroupStore {
  return {
    async load() {
      const groupId = await storage.getItem(CURRENT_GROUP_KEY);
      const normalized = groupId?.trim() ?? '';
      return normalized.length > 0 ? normalized : null;
    },
    async save(groupId: string) {
      const normalized = groupId.trim();
      if (normalized.length === 0) {
        throw new TypeError('현재 그룹 ID는 비어 있을 수 없습니다.');
      }
      await storage.setItem(CURRENT_GROUP_KEY, normalized);
    },
  };
}

export const currentGroupStore = createCurrentGroupStore(
  createAsyncStorage(PREFERENCES_DATABASE),
);
