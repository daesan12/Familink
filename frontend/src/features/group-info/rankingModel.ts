import type {RankedEntry, WeeklyRankingEntry} from './types';

// ISO 날짜(YYYY-MM-DD)로 포맷한다. 한 자리 월·일은 0을 붙인다.
function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 주어진 날짜가 속한 주의 범위를 월요일~일요일로 구한다(스펙: 주 경계는 월요일).
// 앱은 KST에서 동작한다고 보고 로컬 날짜 기준으로 계산한다. API 연동 시에는
// 서버가 집계 주간의 weekStart·weekEnd를 내려주므로 이 계산은 그 값으로 대체된다.
export function getCurrentWeekRange(today: Date): {
  weekStart: string;
  weekEnd: string;
} {
  // getDay: 0=일 ~ 6=토. 월요일까지 되돌릴 일수(월=0, …, 일=6)를 구한다.
  const offsetToMonday = (today.getDay() + 6) % 7;
  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - offsetToMonday,
  );
  // Date 생성자는 일수 오버플로를 월·연 경계로 자동 보정한다.
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6,
  );
  return {weekStart: toIsoDate(monday), weekEnd: toIsoDate(sunday)};
}

// 카네이션 수 내림차순으로 표준 경쟁 순위를 매긴다.
// 같은 수는 공동 순위(예: 1,1,3)를 허용하고, 표시 순서는 이름 오름차순으로 고정한다.
export function rankEntries(
  entries: readonly WeeklyRankingEntry[],
): readonly RankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.carnationCount !== a.carnationCount) {
      return b.carnationCount - a.carnationCount;
    }
    return a.displayName.localeCompare(b.displayName, 'ko');
  });
  return sorted.map((entry) => ({
    ...entry,
    // 자신보다 카네이션이 많은 사람 수 + 1이 표준 경쟁 순위다.
    rank:
      1 +
      sorted.filter((other) => other.carnationCount > entry.carnationCount)
        .length,
  }));
}

// 아바타 자리표시자에 쓸 이름 첫 글자. 서버가 아바타 이미지를 주지 않으므로
// 표시 이름에서 파생한다. 결합 문자를 고려해 코드포인트 단위로 자른다.
export function avatarInitial(displayName: string): string {
  return Array.from(displayName.trim())[0] ?? '';
}

// "2026년 7월 20일 ~ 26일" 형태의 문구를 만든다.
// 같은 달이면 끝 날짜는 일(日)만, 같은 해면 월·일을, 그 외에는 연·월·일을 표기한다.
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  // 집계 주간이 없는 빈 스냅샷은 문구를 만들지 않는다.
  if (!weekStart || !weekEnd) {
    return '';
  }
  const [startYear, startMonth, startDay] = weekStart.split('-').map(Number);
  const [endYear, endMonth, endDay] = weekEnd.split('-').map(Number);

  const start = `${startYear}년 ${startMonth}월 ${startDay}일`;
  let end: string;
  if (startYear === endYear && startMonth === endMonth) {
    end = `${endDay}일`;
  } else if (startYear === endYear) {
    end = `${endMonth}월 ${endDay}일`;
  } else {
    end = `${endYear}년 ${endMonth}월 ${endDay}일`;
  }
  return `${start} ~ ${end}`;
}
