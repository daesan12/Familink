import { useCallback, useEffect, useRef, useState } from "react";

import { toCareReceiverReportPage } from "../reportPresentation";
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
  enabled: boolean;
  groupId: string;
  reportDate: string;
  reportGateway?: ReportGateway;
  targets: readonly CareReceiverReportTarget[];
}

export function useReportPages({
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

    setState({ status: "loading" });

    loadReportPageItems({
      groupId,
      reportDate,
      reportGateway,
      targets,
    })
      .then((items) => {
        if (loadGeneration.current === generation) {
          setState({ items, status: "ready" });
        }
      })
      .catch(() => {
        if (loadGeneration.current === generation) {
          setState({
            items: targets.map((target) => toErrorItem(target)),
            status: "ready",
          });
        }
      });

    return () => {
      if (loadGeneration.current === generation) {
        loadGeneration.current += 1;
      }
    };
  }, [enabled, groupId, reportDate, reportGateway, targets]);

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
    [enabled, groupId, reportDate, reportGateway, targets]
  );

  return { ...state, retry };
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
