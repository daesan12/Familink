import { useCallback, useEffect, useState } from "react";

import { toCareReceiverReportPage } from "../reportPresentation";
import type {
  CareReceiverReportPage,
  CareReceiverReportTarget,
  ReportGateway,
} from "../types";

export type ReportPagesLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { pages: readonly CareReceiverReportPage[]; status: "ready" }
  | { message: string; status: "error" };

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
}: UseReportPagesOptions): ReportPagesLoadState & { retry: () => void } {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<ReportPagesLoadState>({ status: "idle" });

  useEffect(() => {
    if (!enabled || !reportGateway) {
      setState({ status: "idle" });
      return;
    }

    if (targets.length === 0) {
      setState({ pages: [], status: "ready" });
      return;
    }

    let isActive = true;
    setState({ status: "loading" });

    Promise.all(
      targets.map(async (target) => {
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
          return toCareReceiverReportPage(target, callsResult);
        }

        const dailyResult = await reportGateway.getDailyReport(
          groupId,
          target.memberId,
          latestReportDate
        );
        return toCareReceiverReportPage(target, callsResult, dailyResult);
      })
    )
      .then((pages) => {
        if (isActive) {
          setState({ pages, status: "ready" });
        }
      })
      .catch(() => {
        if (isActive) {
          setState({
            message: "리포트를 불러오지 못했어요. 다시 시도해 주세요.",
            status: "error",
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    enabled,
    groupId,
    reloadCount,
    reportDate,
    reportGateway,
    targets,
  ]);

  const retry = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  return { ...state, retry };
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
