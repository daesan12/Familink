import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  DailyReportGenerationStatus,
  ReportGateway,
} from "../types";

export const DAILY_REPORT_POLL_INTERVAL_MS = 5_000;
export const DAILY_REPORT_POLL_TIMEOUT_MS = 90_000;

export interface DailyReportGenerationUiState {
  generationStatus?: DailyReportGenerationStatus;
  message: string | null;
}

interface UseDailyReportGenerationOptions {
  enabled: boolean;
  groupId: string;
  onReady: (memberId: string) => void;
  reportDate: string;
  reportGateway?: ReportGateway;
}

export function useDailyReportGeneration({
  enabled,
  groupId,
  onReady,
  reportDate,
  reportGateway,
}: UseDailyReportGenerationOptions): {
  request: (memberId: string) => void;
  states: Readonly<Record<string, DailyReportGenerationUiState>>;
} {
  const [states, setStates] = useState<
    Record<string, DailyReportGenerationUiState>
  >({});
  const generation = useRef(0);
  const nextRequestId = useRef(0);
  const onReadyRef = useRef(onReady);
  const requestIds = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  onReadyRef.current = onReady;

  const clearTimer = useCallback((memberId: string) => {
    const timer = timers.current.get(memberId);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(memberId);
    }
  }, []);

  const clearAll = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    requestIds.current.clear();
  }, []);

  useEffect(() => {
    generation.current += 1;
    clearAll();
    setStates({});
  }, [clearAll, enabled, groupId, reportDate, reportGateway]);

  useEffect(() => clearAll, [clearAll]);

  const request = useCallback(
    (memberId: string) => {
      if (!enabled || !reportGateway) {
        return;
      }

      const currentGeneration = generation.current;
      const requestId = ++nextRequestId.current;
      const pollingStartedAt = Date.now();
      requestIds.current.set(memberId, requestId);
      clearTimer(memberId);
      updateMemberState(setStates, memberId, {
        generationStatus: "generating",
        message: null,
      });

      const isCurrent = () =>
        generation.current === currentGeneration &&
        requestIds.current.get(memberId) === requestId;

      const finish = (state: DailyReportGenerationUiState) => {
        if (!isCurrent()) {
          return;
        }
        clearTimer(memberId);
        requestIds.current.delete(memberId);
        updateMemberState(setStates, memberId, state);
      };

      const handleServerStatus = (status: DailyReportGenerationStatus) => {
        if (status === "ready") {
          finish({ generationStatus: "ready", message: null });
          onReadyRef.current(memberId);
          return;
        }
        if (status === "available" || status === "notReady") {
          finish({
            generationStatus: status,
            message:
              status === "available"
                ? "일간 리포트를 생성하지 못했어요. 다시 시도해 주세요."
                : "생성할 수 있는 건별 리포트가 아직 없어요.",
          });
          return;
        }
        updateMemberState(setStates, memberId, {
          generationStatus: "generating",
          message: null,
        });
        schedulePoll();
      };

      const poll = async () => {
        if (!isCurrent()) {
          return;
        }
        try {
          const result = await reportGateway.getDailyReport(
            groupId,
            memberId,
            reportDate
          );
          if (isCurrent()) {
            handleServerStatus(result.generationStatus);
          }
        } catch {
          if (!isCurrent()) {
            return;
          }
          updateMemberState(setStates, memberId, {
            generationStatus: "generating",
            message: "생성 상태를 다시 확인하고 있어요.",
          });
          schedulePoll();
        }
      };

      function schedulePoll() {
        clearTimer(memberId);
        if (!isCurrent()) {
          return;
        }
        const elapsedMs = Date.now() - pollingStartedAt;
        if (elapsedMs >= DAILY_REPORT_POLL_TIMEOUT_MS) {
          finish({
            generationStatus: "generating",
            message: "생성이 지연되고 있어요. 잠시 후 다시 확인해 주세요.",
          });
          return;
        }
        timers.current.set(
          memberId,
          setTimeout(() => {
            timers.current.delete(memberId);
            poll().catch(() => {
              // poll이 오류 상태와 다음 확인을 처리한다.
            });
          }, Math.min(
            DAILY_REPORT_POLL_INTERVAL_MS,
            DAILY_REPORT_POLL_TIMEOUT_MS - elapsedMs
          ))
        );
      }

      reportGateway
        .requestDailyReportGeneration(groupId, memberId)
        .then((result) => {
          if (isCurrent()) {
            handleServerStatus(result.generationStatus);
          }
        })
        .catch(async () => {
          if (!isCurrent()) {
            return;
          }
          try {
            const result = await reportGateway.getDailyReport(
              groupId,
              memberId,
              reportDate
            );
            if (isCurrent()) {
              handleServerStatus(result.generationStatus);
            }
          } catch {
            finish({
              message: "생성 요청을 보내지 못했어요. 다시 시도해 주세요.",
            });
          }
        });
    }, [clearTimer, enabled, groupId, reportDate, reportGateway]
  );

  return { request, states };
}

function updateMemberState(
  setStates: Dispatch<
    SetStateAction<Record<string, DailyReportGenerationUiState>>
  >,
  memberId: string,
  state: DailyReportGenerationUiState
) {
  setStates((current) => ({ ...current, [memberId]: state }));
}
