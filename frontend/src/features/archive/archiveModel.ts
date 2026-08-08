import type {
  ArchiveDateGroup,
  ArchiveMemberFilter,
  ArchivePost,
} from './types';

export interface ArchiveFilter {
  dateKey?: string | null;
  memberId?: ArchiveMemberFilter;
}

export interface YearMonth {
  month: number;
  year: number;
}

export function parseDateKey(dateKey: string): {
  day: number;
  month: number;
  year: number;
} {
  const [year, month, day] = dateKey.split('-').map(Number);
  return {day, month, year};
}

export function toDateKey(year: number, month: number, day: number): string {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  return `${year}-${paddedMonth}-${paddedDay}`;
}

export function formatDateLabel(dateKey: string): string {
  const {day, month, year} = parseDateKey(dateKey);
  return `${year}년 ${month}월 ${day}일`;
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

export function filterPosts(
  posts: readonly ArchivePost[],
  filter: ArchiveFilter = {},
): readonly ArchivePost[] {
  const {dateKey, memberId} = filter;
  return posts.filter(post => {
    if (memberId != null && post.memberId !== memberId) {
      return false;
    }
    if (dateKey != null && post.dateKey !== dateKey) {
      return false;
    }
    return true;
  });
}

export function groupPostsByDate(
  posts: readonly ArchivePost[],
): readonly ArchiveDateGroup[] {
  const groupsByKey = new Map<string, ArchivePost[]>();
  posts.forEach(post => {
    const bucket = groupsByKey.get(post.dateKey);
    if (bucket) {
      bucket.push(post);
    } else {
      groupsByKey.set(post.dateKey, [post]);
    }
  });

  return [...groupsByKey.keys()]
    .sort((left, right) => (left < right ? 1 : left > right ? -1 : 0))
    .map(dateKey => ({
      dateKey,
      dateLabel: formatDateLabel(dateKey),
      posts: groupsByKey.get(dateKey) ?? [],
    }));
}

// 달력에서 게시글이 있어 선택 가능한 날짜 집합. 구성원 필터를 반영한다.
export function getActiveDaySet(
  posts: readonly ArchivePost[],
  year: number,
  month: number,
  memberId: ArchiveMemberFilter = null,
): ReadonlySet<number> {
  const activeDays = new Set<number>();
  filterPosts(posts, {memberId}).forEach(post => {
    const parsed = parseDateKey(post.dateKey);
    if (parsed.year === year && parsed.month === month) {
      activeDays.add(parsed.day);
    }
  });
  return activeDays;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): YearMonth {
  const zeroBased = month - 1 + delta;
  return {
    month: ((zeroBased % 12) + 12) % 12 + 1,
    year: year + Math.floor(zeroBased / 12),
  };
}

// 달력 격자는 항상 6주 42칸으로 고정한다.
const CALENDAR_CELL_COUNT = 42;

export interface CalendarDayCell {
  dateKey: string;
  day: number;
  // 이 칸이 기준 달에 속하는지 여부. false면 인접 달 스필오버(흐리게, 선택 불가).
  inMonth: boolean;
}

// 달력 렌더링용 주 단위 배열. 6주 42칸 고정이라 월마다 높이가 달라지지 않고,
// 앞뒤 여유 칸은 인접 달의 실제 날짜로 채운다.
export function getCalendarWeeks(
  year: number,
  month: number,
): readonly (readonly CalendarDayCell[])[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const cells: CalendarDayCell[] = [];
  for (let index = 0; index < CALENDAR_CELL_COUNT; index += 1) {
    // Date 생성자가 범위를 벗어난 일(day) 값을 인접 달로 이월해 준다.
    const date = new Date(year, month - 1, index - firstWeekday + 1);
    const cellYear = date.getFullYear();
    const cellMonth = date.getMonth() + 1;
    cells.push({
      dateKey: toDateKey(cellYear, cellMonth, date.getDate()),
      day: date.getDate(),
      inMonth: cellYear === year && cellMonth === month,
    });
  }

  const weeks: CalendarDayCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}
