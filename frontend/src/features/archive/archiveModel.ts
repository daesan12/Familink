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

// 달력 렌더링용 주 단위 배열. 각 칸은 일(day) 숫자이거나 빈 칸(null)이다.
export function getCalendarWeeks(
  year: number,
  month: number,
): readonly (readonly (number | null)[])[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (number | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}
