import type {
  CalendarEventDetail,
  CalendarEventSummary,
  CalendarMember,
  DateKey,
} from './types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_IN_MS = 9 * 60 * 60 * 1000;

export const WEEKDAY_LABELS = [
  '일',
  '월',
  '화',
  '수',
  '목',
  '금',
  '토',
] as const;

export interface YearMonth {
  month: number;
  year: number;
}

export interface CalendarDay {
  dateKey: DateKey;
  day: number;
  isCurrentMonth: boolean;
  month: number;
  year: number;
}

export interface CalendarWeek {
  days: readonly CalendarDay[];
  endDate: DateKey;
  startDate: DateKey;
}

export interface CalendarMonth {
  endDate: DateKey;
  month: number;
  startDate: DateKey;
  weeks: readonly CalendarWeek[];
  year: number;
}

export interface EventSegment {
  continuesAfter: boolean;
  continuesBefore: boolean;
  endColumn: number;
  event: CalendarEventSummary;
  lane: number;
  startColumn: number;
}

export interface WeekEventLayout {
  overflowByDate: Readonly<Record<DateKey, number>>;
  segments: readonly EventSegment[];
  week: CalendarWeek;
}

/**
 * 일정 상세의 참여자 중 현재 활성 구성원 목록에 존재하는 ID만 유지한다.
 *
 * 구성원 목록이 아직 로딩 중이거나 조회에 실패해 비어 있으면 상세 응답을 그대로
 * 유지한다. 활성 구성원 목록을 받은 뒤에는 이탈한 멤버십 ID가 상세 태그나 편집
 * 요청으로 다시 노출되지 않게 제거한다.
 */
export function retainActiveEventParticipants(
  detail: CalendarEventDetail,
  members: readonly CalendarMember[],
): CalendarEventDetail {
  if (members.length === 0) {
    return detail;
  }

  const activeMemberIds = new Set(members.map(member => member.memberId));
  const participantMemberIds = detail.participantMemberIds.filter(memberId =>
    activeMemberIds.has(memberId),
  );
  if (participantMemberIds.length === detail.participantMemberIds.length) {
    return detail;
  }

  return {...detail, participantMemberIds};
}

export function createCalendarMonth(
  year: number,
  month: number,
): CalendarMonth {
  const firstDate = createUtcDate(year, month, 1);
  const gridStart = addDays(firstDate, -firstDate.getUTCDay());
  const days: CalendarDay[] = [];

  // 달력 격자는 항상 6주 42칸으로 고정한다.
  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const cellMonth = date.getUTCMonth() + 1;
    days.push({
      dateKey: formatUtcDate(date),
      day: date.getUTCDate(),
      isCurrentMonth: cellMonth === month && date.getUTCFullYear() === year,
      month: cellMonth,
      year: date.getUTCFullYear(),
    });
  }

  const weeks: CalendarWeek[] = [];
  for (let index = 0; index < days.length; index += 7) {
    const weekDays = days.slice(index, index + 7);
    weeks.push({
      days: weekDays,
      endDate: weekDays[6].dateKey,
      startDate: weekDays[0].dateKey,
    });
  }

  return {
    endDate: days[days.length - 1].dateKey,
    month,
    startDate: days[0].dateKey,
    weeks,
    year,
  };
}

export function shiftMonth(
  yearMonth: YearMonth,
  delta: number,
): YearMonth {
  const shifted = createUtcDate(yearMonth.year, yearMonth.month + delta, 1);
  return {
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
}

export function shiftSelectedDateToMonth(
  selectedDate: DateKey,
  target: YearMonth,
): DateKey {
  const selectedDay = parseDateKey(selectedDate).day;
  const lastDay = createUtcDate(target.year, target.month + 1, 0).getUTCDate();
  return formatDateKey(
    target.year,
    target.month,
    Math.min(selectedDay, lastDay),
  );
}

export function getTodayDateKey(now = new Date()): DateKey {
  const kst = new Date(now.getTime() + KST_OFFSET_IN_MS);
  return formatDateKey(
    kst.getUTCFullYear(),
    kst.getUTCMonth() + 1,
    kst.getUTCDate(),
  );
}

export function parseDateKey(dateKey: DateKey): {
  day: number;
  month: number;
  year: number;
} {
  const [year, month, day] = dateKey.split('-').map(Number);
  return {day, month, year};
}

export function formatDateKey(
  year: number,
  month: number,
  day: number,
): DateKey {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function formatMonthLabel(yearMonth: YearMonth): string {
  return `${yearMonth.year}년 ${yearMonth.month}월`;
}

export function formatSelectedDateLabel(dateKey: DateKey): string {
  const {day, month, year} = parseDateKey(dateKey);
  const weekday = WEEKDAY_LABELS[toUtcDate(dateKey).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 ${weekday}요일`;
}

export function eventsForDate(
  events: readonly CalendarEventSummary[],
  dateKey: DateKey,
): readonly CalendarEventSummary[] {
  return sortEvents(
    events.filter(
      event => event.eventDate <= dateKey && event.endDate >= dateKey,
    ),
  );
}

export function buildWeekEventLayout(
  week: CalendarWeek,
  events: readonly CalendarEventSummary[],
  maxVisibleLanes = 3,
): WeekEventLayout {
  const overlapping = sortEvents(
    events.filter(
      event =>
        event.eventDate <= week.endDate && event.endDate >= week.startDate,
    ),
  );
  const laneEnds: string[] = [];
  const segments: EventSegment[] = [];
  const overflowByDate: Record<DateKey, number> = {};

  overlapping.forEach(event => {
    const segmentStart =
      event.eventDate > week.startDate ? event.eventDate : week.startDate;
    const segmentEnd =
      event.endDate < week.endDate ? event.endDate : week.endDate;
    const startColumn = differenceInDays(week.startDate, segmentStart);
    const endColumn = differenceInDays(week.startDate, segmentEnd);
    let lane = laneEnds.findIndex(laneEnd => laneEnd < segmentStart);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(segmentEnd);
    } else {
      laneEnds[lane] = segmentEnd;
    }

    if (lane < maxVisibleLanes) {
      segments.push({
        continuesAfter: event.endDate > segmentEnd,
        continuesBefore: event.eventDate < segmentStart,
        endColumn,
        event,
        lane,
        startColumn,
      });
      return;
    }

    for (let column = startColumn; column <= endColumn; column += 1) {
      const dateKey = week.days[column].dateKey;
      overflowByDate[dateKey] = (overflowByDate[dateKey] ?? 0) + 1;
    }
  });

  return {overflowByDate, segments, week};
}

export function sortEvents(
  events: readonly CalendarEventSummary[],
): readonly CalendarEventSummary[] {
  return [...events].sort((left, right) => {
    const leftAllDay = left.startAt === null;
    const rightAllDay = right.startAt === null;
    if (leftAllDay !== rightAllDay) {
      return leftAllDay ? -1 : 1;
    }
    if (left.eventDate !== right.eventDate) {
      return left.eventDate < right.eventDate ? -1 : 1;
    }

    const leftDuration = differenceInDays(left.eventDate, left.endDate);
    const rightDuration = differenceInDays(right.eventDate, right.endDate);
    if (leftDuration !== rightDuration) {
      return rightDuration - leftDuration;
    }
    if (left.startAt !== right.startAt) {
      return (left.startAt ?? '').localeCompare(right.startAt ?? '');
    }
    const titleOrder = left.title.localeCompare(right.title, 'ko');
    return titleOrder !== 0 ? titleOrder : left.id.localeCompare(right.id);
  });
}

export function formatEventTime(event: CalendarEventSummary): string {
  if (event.startAt === null || event.endAt === null) {
    return '하루 종일';
  }
  return `${formatKstTime(event.startAt)} - ${formatKstTime(event.endAt)}`;
}

export function formatEventDateRange(event: CalendarEventSummary): string {
  if (event.eventDate === event.endDate) {
    return formatSelectedDateLabel(event.eventDate);
  }
  return `${formatShortDate(event.eventDate)} - ${formatShortDate(
    event.endDate,
  )}`;
}

function formatShortDate(dateKey: DateKey): string {
  const {day, month, year} = parseDateKey(dateKey);
  return `${year}.${month}.${day}`;
}

function formatKstTime(timestamp: string): string {
  const kst = new Date(new Date(timestamp).getTime() + KST_OFFSET_IN_MS);
  return `${String(kst.getUTCHours()).padStart(2, '0')}:${String(
    kst.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

function differenceInDays(startDate: DateKey, endDate: DateKey): number {
  return Math.round(
    (toUtcDate(endDate).getTime() - toUtcDate(startDate).getTime()) /
      DAY_IN_MS,
  );
}

function toUtcDate(dateKey: DateKey): Date {
  const {day, month, year} = parseDateKey(dateKey);
  return createUtcDate(year, month, day);
}

function createUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function formatUtcDate(date: Date): DateKey {
  return formatDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}
