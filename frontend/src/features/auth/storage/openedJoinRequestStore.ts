import {
  createAsyncStorage,
  type AsyncStorage,
} from '@react-native-async-storage/async-storage';

const OPENED_JOIN_REQUESTS_KEY = 'opened-approved-join-request-ids';
const PREFERENCES_DATABASE = 'familink-preferences';
// 서버는 처리된 가입 요청을 계속 반환하므로 입장한 요청 ID를 기기에 기억해
// 승인 카드를 다시 보여주지 않는다. 오래된 ID부터 잘라 무한히 쌓이지 않게 한다.
const MAX_STORED_IDS = 50;

export interface OpenedJoinRequestStore {
  add(joinRequestId: string): Promise<void>;
  load(): Promise<readonly string[]>;
}

export function createOpenedJoinRequestStore(
  storage: AsyncStorage,
): OpenedJoinRequestStore {
  const load = async (): Promise<readonly string[]> => {
    const raw = await storage.getItem(OPENED_JOIN_REQUESTS_KEY);
    if (raw === null) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
      return [];
    }
  };

  return {
    async add(joinRequestId: string) {
      const ids = await load();
      if (ids.includes(joinRequestId)) {
        return;
      }
      const next = [...ids, joinRequestId].slice(-MAX_STORED_IDS);
      await storage.setItem(OPENED_JOIN_REQUESTS_KEY, JSON.stringify(next));
    },
    load,
  };
}

// 스토리지는 호출 시점에 얻는다. 인스턴스를 모듈 로드 시 고정하면 Jest의
// clearAllMockStorages가 레지스트리만 비워 테스트 간 데이터가 새어 들어간다.
export const openedJoinRequestStore: OpenedJoinRequestStore = {
  add: (joinRequestId) =>
    createOpenedJoinRequestStore(
      createAsyncStorage(PREFERENCES_DATABASE),
    ).add(joinRequestId),
  load: () =>
    createOpenedJoinRequestStore(createAsyncStorage(PREFERENCES_DATABASE)).load(),
};
