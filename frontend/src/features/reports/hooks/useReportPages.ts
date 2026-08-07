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
  // retry는 더 최신 데이터를 가져오므로, 그보다 먼저 시작한 전체 재검증 응답이
  // 뒤늦게 도착해 retry 결과를 되돌리지 못하게 구분한다. 언마운트로 증가하는
  // loadGeneration과 달리 이 값이 바뀌면 캐시 기록도 건너뛴다.
  const pagesInvalidation = useRef(0);

  useEffect(() => {
    const generation = ++loadGeneration.current;
    retryRequests.current.clear();

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
    const invalidationAtStart = pagesInvalidation.current;
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
        if (pagesInvalidation.current !== invalidationAtStart) {
          // retry가 이미 더 최신 결과를 반영했다. 낡은 응답으로 덮어쓰지 않는다.
          return;
        }
        // 실패한 대상만 캐시된 페이지로 대신한다. 캐시가 없으면 오류 항목이 남는다.
        const merged = cachedPages
          ? fillFailedItemsFromCache(items, cachedPages, targets)
          : items;
        // 캐시 기록은 원본 기준이라 실패가 섞이면 기존 스냅샷을 그대로 둔다.
        // 화면을 떠난 뒤 도착한 결과도 남겨 다음 진입에서 바로 쓴다.
        writeCachedPages(cache, groupId, reportDate, items);
        if (loadGeneration.current === generation) {
          setState({ items: merged, status: "ready" });
        }
      })
      .catch(() => {
        if (
          loadGeneration.current !== generation ||
          pagesInvalidation.current !== invalidationAtStart ||
          cachedPages
        ) {
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
      retryRequests.current.set(memberId, requestId);
      // 재조회를 요청했다는 건 이 스냅샷이 더 이상 최신이 아니라는 뜻이다.
      // 일일 리포트 생성 직후에도 호출되므로 낡은 페이지를 다시 보여주지 않는다.
      cache.invalidatePages(groupId, reportDate);
      pagesInvalidation.current += 1;
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
  items: readonly ReportPageLoadItem[]
) {
  const pages: CareReceiverReportPage[] = [];

  for (const item of items) {
    if (item.status !== "ready") {
      // 일부 멤버가 실패한 스냅샷은 남기지 않는다. 다음 진입에서 다시 조회한다.
      return;
    }
    pages.push(item.page);
  }

  cache.setPages(groupId, reportDate, pages);
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
