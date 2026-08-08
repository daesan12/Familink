import type {ProfileUpdateInput, UserProfile} from './api/profileApi';
import type {Gender, ProfileImageAsset} from './types';

export const PROFILE_IMAGE_LIMITS = {
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeBytes: 10 * 1024 * 1024,
} as const;

export type ProfileImageValidationError = 'metadata' | 'size' | 'type';

export type ProfileImageAssetResult =
  | {asset: ProfileImageAsset; error: null}
  | {asset: null; error: ProfileImageValidationError};

interface PickedProfileImageMetadata {
  fileName?: string;
  fileSize?: number;
  type?: string;
  uri?: string;
}

export function parsePickedProfileImage(
  value: PickedProfileImageMetadata,
): ProfileImageAssetResult {
  const uri = value.uri?.trim();
  const fileName = value.fileName?.trim();
  const contentType = value.type?.split(';', 1)[0].trim().toLowerCase();
  const sizeBytes = value.fileSize;

  if (
    uri === undefined ||
    uri.length === 0 ||
    fileName === undefined ||
    fileName.length === 0 ||
    fileName.length > 255 ||
    hasInvalidFileNameCharacter(fileName) ||
    contentType === undefined ||
    contentType.length === 0 ||
    sizeBytes === undefined ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0
  ) {
    return {asset: null, error: 'metadata'};
  }

  const allowedTypes: readonly string[] = PROFILE_IMAGE_LIMITS.allowedTypes;
  if (!allowedTypes.includes(contentType)) {
    return {asset: null, error: 'type'};
  }
  if (sizeBytes > PROFILE_IMAGE_LIMITS.maxSizeBytes) {
    return {asset: null, error: 'size'};
  }

  return {
    asset: {contentType, fileName, sizeBytes, uri},
    error: null,
  };
}

export function hasInvalidFileNameCharacter(value: string): boolean {
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return (
      character === '\\' || character === '/' || code <= 31 || code === 127
    );
  });
}

// 성별 코드값을 화면 표시 문구로 바꾼다.
export function formatGenderLabel(gender: Gender): string {
  return gender === 'male' ? '남자' : '여자';
}

export function mergeUserProfile<T extends {age: number; birthDate: string}>(
  current: T,
  remote: UserProfile,
  now = new Date(),
): T & UserProfile {
  return {
    ...current,
    age: calculateAge(remote.birthDate, now),
    birthDate: formatIsoDate(remote.birthDate),
    gender: remote.gender,
    loginId: remote.loginId,
    name: remote.name,
    profileImageUrl: remote.profileImageUrl,
  } as T & UserProfile;
}

export function calculateAge(birthDate: string, now = new Date()): number {
  const parsed = parseIsoDate(birthDate);
  if (parsed === null) {
    return 0;
  }

  // Profile age follows the product's Asia/Seoul business-date rule. Seoul
  // has a fixed UTC+09:00 offset, so shifting the instant keeps this helper
  // deterministic without relying on the device's local timezone.
  const seoulNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  let age = seoulNow.getUTCFullYear() - parsed.year;
  const birthdayPassed =
    seoulNow.getUTCMonth() + 1 > parsed.month ||
    (seoulNow.getUTCMonth() + 1 === parsed.month &&
      seoulNow.getUTCDate() >= parsed.day);
  if (!birthdayPassed) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function formatIsoDate(value: string): string {
  const parsed = parseIsoDate(value);
  return parsed === null
    ? value
    : formatDisplayDate(parsed.year, parsed.month, parsed.day);
}

export function toApiProfileUpdate(
  profile: {
    birthDate: string;
    gender: Gender;
    name: string;
  },
  profileImageUrl?: string | null,
): {
  birthDate?: string;
  gender: 'FEMALE' | 'MALE';
  name: string;
  profileImageUrl?: string | null;
} {
  const parsedBirthDate = parseDisplayDate(profile.birthDate);
  const input: {
    birthDate?: string;
    gender: 'FEMALE' | 'MALE';
    name: string;
    profileImageUrl?: string | null;
  } = {
    ...(parsedBirthDate
      ? {
          birthDate: toIsoDate(
            parsedBirthDate.year,
            parsedBirthDate.month,
            parsedBirthDate.day,
          ),
        }
      : {}),
    gender: profile.gender === 'male' ? 'MALE' : 'FEMALE',
    name: profile.name,
  };
  if (profileImageUrl !== undefined) {
    input.profileImageUrl = profileImageUrl;
  }
  return input;
}

export function toChangedApiProfileUpdate(
  current: {
    birthDate: string;
    gender: Gender;
    name: string;
  },
  next: {
    birthDate: string;
    gender: Gender;
    name: string;
  },
  profileImageUrl?: string | null,
): ProfileUpdateInput {
  const input: ProfileUpdateInput = {};

  if (next.name !== current.name) {
    input.name = next.name;
  }
  if (next.gender !== current.gender) {
    input.gender = next.gender === 'male' ? 'MALE' : 'FEMALE';
  }
  if (next.birthDate !== current.birthDate) {
    const parsedBirthDate = parseDisplayDate(next.birthDate);
    if (parsedBirthDate !== null) {
      input.birthDate = toIsoDate(
        parsedBirthDate.year,
        parsedBirthDate.month,
        parsedBirthDate.day,
      );
    }
  }
  if (profileImageUrl !== undefined) {
    input.profileImageUrl = profileImageUrl;
  }

  return input;
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

// 달력 격자는 항상 6주 42칸으로 고정한다.
const CALENDAR_CELL_COUNT = 42;

// (year, month 1~12)의 달력을 일요일 시작 6주 42칸으로 만든다.
// 첫 주 앞은 이전 달 말일, 남는 뒤 칸은 다음 달 초로 채워 월마다 높이가 달라지지 않게 하고
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

  // 남는 칸을 42칸까지 채우기 위한 다음 달 초.
  const next = shiftMonth(year, month, 1);
  let nextDay = 1;
  while (cells.length < CALENDAR_CELL_COUNT) {
    const iso = toIsoDate(next.year, next.month, nextDay);
    cells.push({
      day: nextDay,
      filled: postDates.has(iso),
      inMonth: false,
      iso,
    });
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
function parseIsoDate(
  value: string,
): {year: number; month: number; day: number} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }
  return {year, month, day};
}

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
