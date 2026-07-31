import {
  avatarInitial,
  formatWeekRange,
  getCurrentWeekRange,
  rankEntries,
} from './rankingModel';
import type {WeeklyRankingEntry} from './types';

describe('getCurrentWeekRange', () => {
  test('주 중간 날짜는 그 주의 월요일~일요일을 돌려준다', () => {
    // 2026-07-31은 금요일이다. 같은 주는 07-27(월)~08-02(일)이다.
    expect(getCurrentWeekRange(new Date(2026, 6, 31))).toEqual({
      weekStart: '2026-07-27',
      weekEnd: '2026-08-02',
    });
  });

  test('월요일은 그날을 주 시작으로, 일요일은 그 주에 포함한다', () => {
    expect(getCurrentWeekRange(new Date(2026, 6, 27))).toEqual({
      weekStart: '2026-07-27',
      weekEnd: '2026-08-02',
    });
    expect(getCurrentWeekRange(new Date(2026, 7, 2))).toEqual({
      weekStart: '2026-07-27',
      weekEnd: '2026-08-02',
    });
  });
});

describe('rankEntries', () => {
  const entry = (
    displayName: string,
    carnationCount: number,
  ): WeeklyRankingEntry => ({
    memberId: displayName,
    displayName,
    carnationCount,
    previousWeekWinner: false,
  });

  test('카네이션 수 내림차순으로 순위를 매긴다', () => {
    const ranked = rankEntries([entry('가', 2), entry('나', 5), entry('다', 3)]);
    expect(ranked.map((r) => [r.displayName, r.rank])).toEqual([
      ['나', 1],
      ['다', 2],
      ['가', 3],
    ]);
  });

  test('같은 카네이션 수는 공동 순위를 허용하고 다음 순위를 건너뛴다', () => {
    // 5,5,3 → 공동 1위 두 명, 그다음은 3위다(표준 경쟁 순위).
    const ranked = rankEntries([entry('나', 5), entry('가', 5), entry('다', 3)]);
    expect(ranked.map((r) => [r.displayName, r.rank])).toEqual([
      // 공동 1위는 이름 오름차순으로 정렬한다.
      ['가', 1],
      ['나', 1],
      ['다', 3],
    ]);
  });
});

describe('avatarInitial', () => {
  test('표시 이름의 첫 글자를 코드포인트 단위로 돌려준다', () => {
    expect(avatarInitial('강다영')).toBe('강');
    expect(avatarInitial('  손수호 ')).toBe('손');
    expect(avatarInitial('')).toBe('');
  });
});

describe('formatWeekRange', () => {
  test('같은 달이면 끝 날짜는 일만 표기한다', () => {
    expect(formatWeekRange('2026-07-20', '2026-07-26')).toBe(
      '2026년 7월 20일 ~ 26일',
    );
  });

  test('달을 넘어가면 끝 날짜에 월을 붙인다', () => {
    expect(formatWeekRange('2026-07-27', '2026-08-02')).toBe(
      '2026년 7월 27일 ~ 8월 2일',
    );
  });

  test('해를 넘어가면 끝 날짜에 연도까지 붙인다', () => {
    expect(formatWeekRange('2026-12-28', '2027-01-03')).toBe(
      '2026년 12월 28일 ~ 2027년 1월 3일',
    );
  });
});
