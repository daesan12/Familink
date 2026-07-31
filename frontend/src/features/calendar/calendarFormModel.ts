import type {
  CalendarEventDetail,
  CalendarEventWriteInput,
  DateKey,
} from "./types";

const KST_OFFSET_IN_MS = 9 * 60 * 60 * 1000;

export interface CalendarEventDraft {
  description: string;
  endDate: DateKey;
  endTime: string;
  participantMemberIds: readonly string[];
  startDate: DateKey;
  startTime: string;
  timeEnabled: boolean;
  title: string;
}

export interface CalendarEventDraftErrors {
  date?: string;
  description?: string;
  time?: string;
  title?: string;
}

export function createCalendarEventDraft(date: DateKey): CalendarEventDraft {
  return {
    description: "",
    endDate: date,
    endTime: "00:00",
    participantMemberIds: [],
    startDate: date,
    startTime: "00:00",
    timeEnabled: false,
    title: "",
  };
}

export function createCalendarEventDraftFromDetail(
  detail: CalendarEventDetail
): CalendarEventDraft {
  const timeEnabled = detail.startAt !== null && detail.endAt !== null;
  return {
    description: detail.description,
    endDate: detail.endDate,
    endTime: detail.endAt ? formatKstTime(detail.endAt) : "00:00",
    participantMemberIds: detail.participantMemberIds,
    startDate: detail.eventDate,
    startTime: detail.startAt ? formatKstTime(detail.startAt) : "00:00",
    timeEnabled,
    title: detail.title,
  };
}

export function enableCalendarEventTime(
  draft: CalendarEventDraft,
  now = new Date()
): CalendarEventDraft {
  const kstNow = new Date(now.getTime() + KST_OFFSET_IN_MS);
  const startHour = kstNow.getUTCHours();
  const endHour = startHour + 1;
  return {
    ...draft,
    endDate: draft.startDate,
    endTime: endHour > 23 ? "23:59" : `${padTwo(endHour)}:00`,
    startTime: `${padTwo(startHour)}:00`,
    timeEnabled: true,
  };
}

export function disableCalendarEventTime(
  draft: CalendarEventDraft
): CalendarEventDraft {
  return { ...draft, timeEnabled: false };
}

export function validateCalendarEventDraft(
  draft: CalendarEventDraft
): CalendarEventDraftErrors {
  const errors: CalendarEventDraftErrors = {};
  const title = draft.title.trim();
  if (!title) {
    errors.title = "일정 제목을 입력해 주세요.";
  } else if (draft.title.length > 20) {
    errors.title = "일정 제목은 20자까지 입력할 수 있어요.";
  }
  if (draft.description.length > 50) {
    errors.description = "세부 내용은 50자까지 입력할 수 있어요.";
  }
  if (!isDateKey(draft.startDate) || !isDateKey(draft.endDate)) {
    errors.date = "날짜 형식이 올바르지 않아요.";
  } else if (draft.endDate < draft.startDate) {
    errors.date = "종료 날짜는 시작 날짜보다 빠를 수 없어요.";
  }
  if (draft.timeEnabled) {
    if (!isTime(draft.startTime) || !isTime(draft.endTime)) {
      errors.time = "시간 형식이 올바르지 않아요.";
    } else if (
      toTimestamp(draft.endDate, draft.endTime) <
      toTimestamp(draft.startDate, draft.startTime)
    ) {
      errors.time = "종료 시간은 시작 시간보다 빠를 수 없어요.";
    }
  }
  return errors;
}

export function hasCalendarEventDraftErrors(
  errors: CalendarEventDraftErrors
): boolean {
  return Object.keys(errors).length > 0;
}

export function toCalendarEventWriteInput(
  draft: CalendarEventDraft
): CalendarEventWriteInput {
  return {
    description: draft.description.trim() || null,
    endAt: draft.timeEnabled ? toIsoString(draft.endDate, draft.endTime) : null,
    endDate: draft.endDate,
    eventDate: draft.startDate,
    participantMemberIds: draft.participantMemberIds,
    startAt: draft.timeEnabled
      ? toIsoString(draft.startDate, draft.startTime)
      : null,
    title: draft.title.trim(),
  };
}

function formatKstTime(isoString: string): string {
  const kstDate = new Date(new Date(isoString).getTime() + KST_OFFSET_IN_MS);
  return `${padTwo(kstDate.getUTCHours())}:${padTwo(kstDate.getUTCMinutes())}`;
}

function toIsoString(date: DateKey, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

function toTimestamp(date: DateKey, time: string): number {
  return new Date(`${date}T${time}:00+09:00`).getTime();
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}
