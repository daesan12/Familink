import type {Gender} from './types';

// 성별 코드값을 화면 표시 문구로 바꾼다.
export function formatGenderLabel(gender: Gender): string {
  return gender === 'male' ? '남자' : '여자';
}

export const GENDER_OPTIONS: readonly {label: string; value: Gender}[] = [
  {label: '남자', value: 'male'},
  {label: '여자', value: 'female'},
];

// 일요일 시작 요일 헤더(생년월일 캘린더 I-4·월간 도장 I-5 공통).
export const WEEKDAY_LABELS: readonly string[] = [
  '일',
  '월',
  '화',
  '수',
  '목',
  '금',
  '토',
];

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

// 'YYYY-MM-DD' 형태의 ISO 날짜 문자열을 만든다.
export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export interface MonthCell {
  day: number;
  filled: boolean;
  // 이 셀이 기준 달에 속하는지 여부. false면 인접 달 스필오버(흐리게 표시).
  inMonth: boolean;
  iso: string;
}

// (year, month 1~12)의 달력을 일요일 시작·완전한 주 단위로 만든다.
// 첫 주 앞은 이전 달 말일, 마지막 주 뒤는 다음 달 초로 채워 7열 정렬을 맞추고
// 각 셀은 실제 날짜를 가진다(inMonth=false는 인접 달). postDates에 있는 날짜는 도장이 채워진다.
export function buildMonthGrid(
  year: number,
  month: number,
  postDates: ReadonlySet<string>,
): readonly MonthCell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: MonthCell[] = [];

  // 첫 주를 채우기 위한 이전 달 말일들.
  const prev = shiftMonth(year, month, -1);
  const daysInPrev = new Date(prev.year, prev.month, 0).getDate();
  for (let offset = firstWeekday - 1; offset >= 0; offset -= 1) {
    const day = daysInPrev - offset;
    const iso = toIsoDate(prev.year, prev.month, day);
    cells.push({day, filled: postDates.has(iso), inMonth: false, iso});
  }

  // 기준 달.
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toIsoDate(year, month, day);
    cells.push({day, filled: postDates.has(iso), inMonth: true, iso});
  }

  // 마지막 주를 채우기 위한 다음 달 초.
  const next = shiftMonth(year, month, 1);
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const iso = toIsoDate(next.year, next.month, nextDay);
    cells.push({day: nextDay, filled: postDates.has(iso), inMonth: false, iso});
    nextDay += 1;
  }

  return cells;
}

// 연·월을 하나의 순번으로 환산한다(월 경계 비교·이동 범위 제한용).
export function monthOrdinal(year: number, month: number): number {
  return year * 12 + (month - 1);
}

// 셀 배열을 7칸(한 주) 단위로 나눈다.
export function chunkIntoWeeks(
  cells: readonly MonthCell[],
): readonly (readonly MonthCell[])[] {
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// '2026년 7월' 형태의 제목.
export function formatMonthTitle(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

// 이전·다음 달로 이동한다. 12월/1월 경계에서 연도를 넘긴다.
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): {year: number; month: number} {
  // month를 0-based로 환산해 계산한 뒤 다시 1-based로 되돌린다.
  const zeroBased = month - 1 + delta;
  const nextYear = year + Math.floor(zeroBased / 12);
  const nextMonth = ((zeroBased % 12) + 12) % 12;
  return {year: nextYear, month: nextMonth + 1};
}

// 'YYYY.MM.DD' 표시 문자열을 연·월·일로 분해한다. 형식이 어긋나면 null.
export function parseDisplayDate(
  value: string,
): {year: number; month: number; day: number} | null {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return {year, month, day};
}

// 연·월·일을 'YYYY.MM.DD' 표시 문자열로 만든다.
export function formatDisplayDate(
  year: number,
  month: number,
  day: number,
): string {
  return `${year}.${pad(month)}.${pad(day)}`;
}
