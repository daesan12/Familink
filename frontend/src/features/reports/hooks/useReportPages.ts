import { useCallback, useEffect, useRef, useState } from "react";

import { toCareReceiverReportPage } from "../reportPresentation";
import { reportCache as defaultReportCache, type ReportCache } from "../reportCache";
import type {
  CareReceiverReportPage,
  CareReceiverReportTarget,
  ReportGateway,
} from "../types";

export const REPORT_PAGE_REQUEST_CONCURRENCY = 3;

const REPORT_PAGE_ERROR_MESSAGE =
  "이 피보호자의 리포트를 불러오지 못했어요. 다시 시도해 주세요.";

export type ReportPageLoadItem =
  | {
      page: CareReceiverReportPage;
      status: "ready";
      target: CareReceiverReportTarget;
    }
  | {
      status: "loading";
      target: CareReceiverReportTarget;
    }
  | {
      message: string;
      status: "error";
      target: CareReceiverReportTarget;
    };

export type ReportPagesLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { items: readonly ReportPageLoadItem[]; status: "ready" };

interface UseReportPagesOptions {
  cache?: ReportCache;
  enabled: boolean;
  groupId: string;
  reportDate: string;
  reportGateway?: ReportGateway;
  targets: readonly CareReceiverReportTarget[];
}

export function useReportPages({
  cache = defaultReportCache,
  enabled,
  groupId,
  reportDate,
  reportGateway,
  targets,
}: UseReportPagesOptions): ReportPagesLoadState & {
  retry: (memberId: string) => void;
} {
  const [state, setState] = useState<ReportPagesLoadState>({ status: "idle" });
  const loadGeneration = useRef(0);
  const nextRetryRequestId = useRef(0);
  const retryRequests = useRef(new Map<string, number>());
  // 현재 전체 로드가 시작된 뒤 재조회한 멤버. 재조회는 전체 재검증보다 나중에
  // 시작하므로 더 최신이다. 재조회가 먼저 끝나 진행 중이 아니게 된 뒤에도
  // 먼저 시작한 전체 응답이 그 자리를 덮어쓰면 안 되므로, in-flight 여부가 아니라
  // "이 로드 이후 재조회가 있었는지"로 판단한다.
  const retriedSinceLoad = useRef(new Set<string>());

  useEffect(() => {
    const generation = ++loadGeneration.current;
    retryRequests.current.clear();
    // 새 전체 로드가 이전 재조회들보다 최신이므로 기준을 새로 만든다. 아래
    // 콜백은 ref가 아니라 이 인스턴스를 붙잡는다. 캐시 기록은 loadGeneration
    // 검사 밖에 있어서, ref를 읽으면 effect가 다시 실행된 뒤 도착한 낡은 응답이
    // 비어 있는 새 Set을 보고 재조회 이전 데이터를 기록해 버린다.
    const retriedMembers = new Set<string>();
    retriedSinceLoad.current = retriedMembers;

    if (!enabled || !reportGateway) {
      setState({ status: "idle" });
      return;
    }

    if (targets.length === 0) {
      setState({ items: [], status: "ready" });
      return;
    }

    // 캐시가 있으면 전체 로딩 화면을 건너뛰고 바로 보여준 뒤 뒤에서 다시 조회한다.
    // 통화와 일일 리포트는 계속 추가되므로 캐시를 그대로 두지 않고 항상 재검증한다.
    const cachedPages = readCachedPages(cache, groupId, reportDate, targets);
    const cacheGeneration = cache.generation();
    setState(
      cachedPages
        ? { items: toReadyItems(cachedPages, targets), status: "ready" }
        : { status: "loading" }
    );

    loadReportPageItems({
      groupId,
      reportDate,
      reportGateway,
      targets,
    })
      .then((items) => {
        // 실패한 대상만 캐시된 페이지로 대신한다. 캐시가 없으면 오류 항목이 남는다.
        const merged = cachedPages
          ? fillFailedItemsFromCache(items, cachedPages, targets)
          : items;
        // 이 로드 이후 재조회한 멤버가 있으면 그 자리가 낡은 채로 스냅샷에 박히므로
        // 기록하지 않는다. 재조회 성공은 updatePage로 이미 스냅샷에 반영돼 있다.
        // 기록은 원본 기준이라 실패가 섞여도 기존 스냅샷을 남긴다.
        // 화면을 떠난 뒤 도착한 결과도 남겨 다음 진입에서 바로 쓴다.
        if (retriedMembers.size === 0) {
          writeCachedPages(cache, groupId, reportDate, items, cacheGeneration);
        }
        if (loadGeneration.current === generation) {
          // 재조회한 멤버 자리는 더 최신이므로 현재 항목을 유지한다.
          setState((current) =>
            keepRetriedItems(current, merged, retriedMembers)
          );
        }
      })
      .catch(() => {
        if (loadGeneration.current !== generation || cachedPages) {
          // 이미 캐시로 페이지를 보여주는 중이면 재검증 실패로 에러 화면에 되돌리지 않는다.
          return;
        }
        setState({
          items: targets.map((target) => toErrorItem(target)),
          status: "ready",
        });
      });

    return () => {
      if (loadGeneration.current === generation) {
        loadGeneration.current += 1;
      }
    };
  }, [cache, enabled, groupId, reportDate, reportGateway, targets]);

  const retry = useCallback(
    (memberId: string) => {
      if (!enabled || !reportGateway || retryRequests.current.has(memberId)) {
        return;
      }

      const target = targets.find((item) => item.memberId === memberId);
      if (!target) {
        return;
      }

      const generation = loadGeneration.current;
      const requestId = ++nextRetryRequestId.current;
      const cacheGeneration = cache.generation();
      retryRequests.current.set(memberId, requestId);
      retriedSinceLoad.current.add(memberId);
      setState((current) =>
        replaceReadyItem(current, memberId, { status: "loading", target })
      );

      loadReportPage({
        groupId,
        reportDate,
        reportGateway,
        target,
      })
        .then((page) => {
          // 일일 리포트 생성 직후에도 호출되므로, 스냅샷을 지우는 대신 이 멤버
          // 자리만 최신 페이지로 갱신한다. 지우기만 하면 다음 진입에서 전체
          // 로딩이 다시 뜬다.
          cache.updatePage(
            groupId,
            reportDate,
            memberId,
            page,
            cacheGeneration
          );
          if (
            loadGeneration.current === generation &&
            retryRequests.current.get(memberId) === requestId
          ) {
            setState((current) =>
              replaceReadyItem(current, memberId, {
                page,
                status: "ready",
                target,
              })
            );
          }
        })
        .catch(() => {
          // 최신 상태를 알 수 없게 됐으므로 낡은 스냅샷을 남기지 않는다. 단
          // 세션이 끝났거나 이 화면이 이미 다시 로드됐다면 그쪽 스냅샷이 더
          // 최신이므로 지우지 않는다.
          if (
            loadGeneration.current === generation &&
            cache.generation() === cacheGeneration
          ) {
            cache.invalidatePages(groupId, reportDate);
          }
          if (
            loadGeneration.current === generation &&
            retryRequests.current.get(memberId) === requestId
          ) {
            setState((current) =>
              replaceReadyItem(current, memberId, toErrorItem(target))
            );
          }
        })
        .finally(() => {
          if (retryRequests.current.get(memberId) === requestId) {
            retryRequests.current.delete(memberId);
          }
        });
    },
    [cache, enabled, groupId, reportDate, reportGateway, targets]
  );

  return { ...state, retry };
}

// 멤버 구성이 달라진 캐시는 쓰지 않는다. 항목은 targets 순서로 저장된다.
function readCachedPages(
  cache: ReportCache,
  groupId: string,
  reportDate: string,
  targets: readonly CareReceiverReportTarget[]
): readonly CareReceiverReportPage[] | undefined {
  const cached = cache.getPages(groupId, reportDate);
  if (cached === undefined || cached.length !== targets.length) {
    return undefined;
  }

  const matchesTargets = targets.every(
    (target, index) => cached[index].memberId === target.memberId
  );
  return matchesTargets ? cached : undefined;
}

// 전체 재검증 결과에 실패한 대상이 있으면 그 자리만 캐시된 페이지로 채운다.
// loadReportPageItems가 실패를 오류 항목으로 변환해 넘기므로, 이렇게 하지 않으면
// 이미 보여 주던 정상 페이지가 오류 화면으로 뒤집힌다.
function fillFailedItemsFromCache(
  items: readonly ReportPageLoadItem[],
  cachedPages: readonly CareReceiverReportPage[],
  targets: readonly CareReceiverReportTarget[]
): readonly ReportPageLoadItem[] {
  if (items.every((item) => item.status === "ready")) {
    return items;
  }

  return items.map((item) => {
    if (item.status === "ready") {
      return item;
    }

    const cachedIndex = targets.findIndex(
      (target) => target.memberId === item.target.memberId
    );
    const cachedPage = cachedIndex === -1 ? undefined : cachedPages[cachedIndex];
    return cachedPage
      ? { page: cachedPage, status: "ready" as const, target: item.target }
      : item;
  });
}

function toReadyItems(
  pages: readonly CareReceiverReportPage[],
  targets: readonly CareReceiverReportTarget[]
): readonly ReportPageLoadItem[] {
  return targets.map((target, index) => ({
    page: pages[index],
    status: "ready",
    target,
  }));
}

function writeCachedPages(
  cache: ReportCache,
  groupId: string,
  reportDate: string,
  items: readonly ReportPageLoadItem[],
  generation: number
) {
  const pages: CareReceiverReportPage[] = [];

  for (const item of items) {
    if (item.status !== "ready") {
      // 일부 멤버가 실패한 스냅샷은 남기지 않는다. 다음 진입에서 다시 조회한다.
      return;
    }
    pages.push(item.page);
  }

  cache.setPages(groupId, reportDate, pages, generation);
}

// 전체 재검증 결과를 반영하되, 이 로드 이후 재조회한 멤버 자리는 현재 항목을
// 그대로 둔다. 재조회가 더 나중에 시작해 더 최신이기 때문이다. 재조회가 이미
// 끝난 뒤라도 마찬가지라, 먼저 시작한 전체 응답이 최신 결과를 되돌리지 않는다.
function keepRetriedItems(
  current: ReportPagesLoadState,
  loaded: readonly ReportPageLoadItem[],
  retriedMembers: ReadonlySet<string>
): ReportPagesLoadState {
  if (retriedMembers.size === 0 || current.status !== "ready") {
    return { items: loaded, status: "ready" };
  }

  const currentByMember = new Map(
    current.items.map((item) => [item.target.memberId, item])
  );

  return {
    items: loaded.map((item) => {
      if (!retriedMembers.has(item.target.memberId)) {
        return item;
      }
      return currentByMember.get(item.target.memberId) ?? item;
    }),
    status: "ready",
  };
}

async function loadReportPageItems({
  groupId,
  reportDate,
  reportGateway,
  targets,
}: {
  groupId: string;
  reportDate: string;
  reportGateway: ReportGateway;
  targets: readonly CareReceiverReportTarget[];
}): Promise<readonly ReportPageLoadItem[]> {
  const items: ReportPageLoadItem[] = [];

  for (
    let start = 0;
    start < targets.length;
    start += REPORT_PAGE_REQUEST_CONCURRENCY
  ) {
    const chunk = targets.slice(start, start + REPORT_PAGE_REQUEST_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((target) =>
        loadReportPage({
          groupId,
          reportDate,
          reportGateway,
          target,
        })
      )
    );

    results.forEach((result, index) => {
      const target = chunk[index];
      items.push(
        result.status === "fulfilled"
          ? { page: result.value, status: "ready", target }
          : toErrorItem(target)
      );
    });
  }

  return items;
}

async function loadReportPage({
  groupId,
  reportDate,
  reportGateway,
  target,
}: {
  groupId: string;
  reportDate: string;
  reportGateway: ReportGateway;
  target: CareReceiverReportTarget;
}): Promise<CareReceiverReportPage> {
  const callsResult = await reportGateway.getDailyReport(
    groupId,
    target.memberId,
    reportDate
  );
  const [year, month] = parseYearMonth(reportDate);
  const calendar = await reportGateway.getReportDates(
    groupId,
    target.memberId,
    year,
    month
  );
  const latestReportDate = resolveLatestReportDate(
    calendar.latestReportDate,
    calendar.reportDates,
    reportDate
  );

  if (
    !latestReportDate ||
    latestReportDate === reportDate ||
    callsResult.dailyReport
  ) {
    return toCareReceiverReportPage(target, callsResult, callsResult, calendar);
  }

  const dailyResult = await reportGateway.getDailyReport(
    groupId,
    target.memberId,
    latestReportDate
  );
  return toCareReceiverReportPage(target, callsResult, dailyResult, calendar);
}

function replaceReadyItem(
  state: ReportPagesLoadState,
  memberId: string,
  replacement: ReportPageLoadItem
): ReportPagesLoadState {
  if (state.status !== "ready") {
    return state;
  }

  return {
    items: state.items.map((item) =>
      item.target.memberId === memberId ? replacement : item
    ),
    status: "ready",
  };
}

function toErrorItem(target: CareReceiverReportTarget): ReportPageLoadItem {
  return {
    message: REPORT_PAGE_ERROR_MESSAGE,
    status: "error",
    target,
  };
}

function parseYearMonth(reportDate: string): readonly [number, number] {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(reportDate);
  if (!match) {
    throw new Error("reportDate must use YYYY-MM-DD format.");
  }

  return [Number(match[1]), Number(match[2])];
}

function resolveLatestReportDate(
  latestReportDate: string | null,
  reportDates: readonly string[],
  reportDate: string
): string | undefined {
  if (latestReportDate !== null && latestReportDate <= reportDate) {
    return latestReportDate;
  }

  return [...reportDates]
    .filter((date) => date <= reportDate)
    .sort()
    .at(-1);
}
