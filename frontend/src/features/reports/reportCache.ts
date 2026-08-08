import type {
  CallReport,
  CareReceiverReportPage,
  CareReceiverReportTarget,
} from "./types";

// 준비가 끝난 건별 리포트만 캐시한다. generating·failed·unavailable은 다음
// 조회에서 달라질 수 있는 일시 상태라 저장하면 폴링이 멈춘다.
export type ReadyCallReport = Extract<CallReport, { status: "ready" }>;

const DEFAULT_MAX_CALL_REPORTS = 50;
const DEFAULT_MAX_PAGE_SNAPSHOTS = 20;
const DEFAULT_MAX_TARGET_LISTS = 5;

export interface ReportCacheOptions {
  maxCallReports?: number;
  maxPageSnapshots?: number;
  maxTargetLists?: number;
}

export interface ReportCache {
  clear(): void;
  // clear를 호출할 때마다 커진다. 조회를 시작할 때 이 값을 들고 있다가 기록할 때
  // 함께 넘기면, 세션이 끝난 뒤 도착한 응답이 캐시를 다시 채우는 것을 막는다.
  generation(): number;
  getCallReport(callSessionId: string): ReadyCallReport | undefined;
  getPages(
    groupId: string,
    reportDate: string
  ): readonly CareReceiverReportPage[] | undefined;
  getTargets(groupId: string): readonly CareReceiverReportTarget[] | undefined;
  invalidatePages(groupId: string, reportDate: string): void;
  setCallReport(report: ReadyCallReport, generation?: number): void;
  setPages(
    groupId: string,
    reportDate: string,
    pages: readonly CareReceiverReportPage[],
    generation?: number
  ): void;
  setTargets(
    groupId: string,
    targets: readonly CareReceiverReportTarget[],
    generation?: number
  ): void;
  // 기존 스냅샷에서 한 피보호자의 페이지만 교체한다. 스냅샷이 없거나 그 멤버가
  // 없으면 아무것도 하지 않는다.
  updatePage(
    groupId: string,
    reportDate: string,
    memberId: string,
    page: CareReceiverReportPage,
    generation?: number
  ): void;
}

// 앱을 오래 켜 둬도 무한히 커지지 않도록 항목 수를 제한한다. Map은 삽입
// 순서를 유지하므로 가장 먼저 들어온 항목부터 밀어낸다.
function createBoundedMap<T>(maxEntries: number) {
  const entries = new Map<string, T>();

  return {
    clear() {
      entries.clear();
    },
    delete(key: string) {
      entries.delete(key);
    },
    get(key: string): T | undefined {
      return entries.get(key);
    },
    set(key: string, value: T) {
      // 같은 키를 다시 넣을 때 순서를 갱신해야 방금 쓴 항목이 먼저 밀려나지 않는다.
      entries.delete(key);
      entries.set(key, value);

      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done) {
          return;
        }
        entries.delete(oldest.value);
      }
    },
  };
}

// reportDate가 항상 YYYY-MM-DD라 앞에 두면 groupId에 어떤 문자가 있어도
// 키가 겹치지 않는다.
function createPageKey(groupId: string, reportDate: string): string {
  return `${reportDate}|${groupId}`;
}

export function createReportCache(
  options: ReportCacheOptions = {}
): ReportCache {
  const callReports = createBoundedMap<ReadyCallReport>(
    options.maxCallReports ?? DEFAULT_MAX_CALL_REPORTS
  );
  const pageSnapshots = createBoundedMap<readonly CareReceiverReportPage[]>(
    options.maxPageSnapshots ?? DEFAULT_MAX_PAGE_SNAPSHOTS
  );
  const targetLists = createBoundedMap<readonly CareReceiverReportTarget[]>(
    options.maxTargetLists ?? DEFAULT_MAX_TARGET_LISTS
  );
  let currentGeneration = 0;

  // 조회를 시작한 세션이 이미 끝났으면 기록하지 않는다. 세대를 넘기지 않은
  // 호출은 검사 없이 통과시켜 호출부가 필요한 곳에서만 쓰게 한다.
  function isStale(generation: number | undefined): boolean {
    return generation !== undefined && generation !== currentGeneration;
  }

  return {
    clear() {
      callReports.clear();
      pageSnapshots.clear();
      targetLists.clear();
      currentGeneration += 1;
    },
    generation() {
      return currentGeneration;
    },
    getCallReport(callSessionId) {
      return callReports.get(callSessionId);
    },
    getPages(groupId, reportDate) {
      return pageSnapshots.get(createPageKey(groupId, reportDate));
    },
    getTargets(groupId) {
      return targetLists.get(groupId);
    },
    invalidatePages(groupId, reportDate) {
      pageSnapshots.delete(createPageKey(groupId, reportDate));
    },
    setCallReport(report, generation) {
      if (isStale(generation)) {
        return;
      }
      callReports.set(report.callSessionId, report);
    },
    setPages(groupId, reportDate, pages, generation) {
      if (isStale(generation)) {
        return;
      }
      pageSnapshots.set(createPageKey(groupId, reportDate), pages);
    },
    setTargets(groupId, targets, generation) {
      if (isStale(generation)) {
        return;
      }
      targetLists.set(groupId, targets);
    },
    updatePage(groupId, reportDate, memberId, page, generation) {
      if (isStale(generation)) {
        return;
      }

      const key = createPageKey(groupId, reportDate);
      const snapshot = pageSnapshots.get(key);
      if (snapshot === undefined) {
        return;
      }

      const index = snapshot.findIndex((item) => item.memberId === memberId);
      if (index === -1) {
        return;
      }

      const next = [...snapshot];
      next[index] = page;
      pageSnapshots.set(key, next);
    },
  };
}

// 로그인 세션 동안만 유지하는 메모리 캐시다. 로그아웃·탈퇴·그룹 접근 거부에서
// App이 clear를 호출한다.
export const reportCache = createReportCache();
