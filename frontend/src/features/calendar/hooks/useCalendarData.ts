import { useCallback, useEffect, useState } from "react";

import type {
  CalendarEventSummary,
  CalendarGateway,
  CalendarMember,
  DateKey,
} from "../types";

type LoadStatus = "idle" | "loading" | "success" | "error";

interface CalendarDataState {
  errorMessage: string | null;
  events: readonly CalendarEventSummary[];
  members: readonly CalendarMember[];
  removeEvent: (eventId: string) => void;
  reload: () => void;
  status: LoadStatus;
}

export function useCalendarData({
  endDate,
  gateway,
  groupId,
  startDate,
}: {
  endDate: DateKey;
  gateway: CalendarGateway;
  groupId: string;
  startDate: DateKey;
}): CalendarDataState {
  const [events, setEvents] = useState<readonly CalendarEventSummary[]>([]);
  const [members, setMembers] = useState<readonly CalendarMember[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadRequestId, setReloadRequestId] = useState(0);

  const reload = useCallback(() => {
    setReloadRequestId((requestId) => requestId + 1);
  }, []);
  const removeEvent = useCallback((eventId: string) => {
    setEvents((currentEvents) =>
      currentEvents.filter((event) => event.id !== eventId)
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage(null);
    setEvents([]);

    gateway
      .listEvents({
        endDate,
        groupId,
        signal: controller.signal,
        startDate,
      })
      .then((nextEvents) => {
        if (!controller.signal.aborted) {
          setEvents(nextEvents);
          setStatus("success");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setEvents([]);
          setErrorMessage(toErrorMessage(error));
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, [endDate, gateway, groupId, reloadRequestId, startDate]);

  useEffect(() => {
    const controller = new AbortController();
    setMembers([]);

    gateway
      .listMembers(groupId, controller.signal)
      .then((nextMembers) => {
        if (!controller.signal.aborted) {
          setMembers(nextMembers);
        }
      })
      .catch(() => {
        // 일정 조회는 유지하고 상세에서 구성원 ID와 기본 프로필로 대체한다.
      });

    return () => controller.abort();
  }, [gateway, groupId, reloadRequestId]);

  return {
    errorMessage,
    events,
    members,
    removeEvent,
    reload,
    status,
  };
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "일정을 불러오지 못했어요.";
}
