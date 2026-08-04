import {
  createAsyncStorage,
  type AsyncStorage,
} from '@react-native-async-storage/async-storage';

const PREFERENCES_DATABASE = 'familink-preferences';
const PENDING_JOIN_REQUEST_KEY_PREFIX = 'pending-group-join-request-ids';

export interface PendingJoinRequestStore {
  load(userId: number): Promise<readonly string[]>;
  save(userId: number, requestIds: readonly string[]): Promise<void>;
}

function storageKey(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError('사용자 ID는 양의 정수여야 합니다.');
  }
  return `${PENDING_JOIN_REQUEST_KEY_PREFIX}:${userId}`;
}

function normalizeRequestIds(requestIds: readonly string[]): readonly string[] {
  return [...new Set(requestIds.map(id => id.trim()).filter(Boolean))];
}

export function createPendingJoinRequestStore(
  storage: AsyncStorage,
): PendingJoinRequestStore {
  return {
    async load(userId) {
      const serialized = await storage.getItem(storageKey(userId));
      if (serialized === null) {
        return [];
      }

      try {
        const parsed: unknown = JSON.parse(serialized);
        if (!Array.isArray(parsed)) {
          return [];
        }
        return normalizeRequestIds(
          parsed.filter((value): value is string => typeof value === 'string'),
        );
      } catch {
        return [];
      }
    },
    async save(userId, requestIds) {
      const key = storageKey(userId);
      const normalized = normalizeRequestIds(requestIds);
      if (normalized.length === 0) {
        await storage.removeItem(key);
        return;
      }
      await storage.setItem(key, JSON.stringify(normalized));
    },
  };
}

export const pendingJoinRequestStore: PendingJoinRequestStore = {
  load(userId) {
    return createPendingJoinRequestStore(
      createAsyncStorage(PREFERENCES_DATABASE),
    ).load(userId);
  },
  save(userId, requestIds) {
    return createPendingJoinRequestStore(
      createAsyncStorage(PREFERENCES_DATABASE),
    ).save(userId, requestIds);
  },
};
