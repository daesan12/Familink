import {
  buildMonthGrid,
  chunkIntoWeeks,
  formatDisplayDate,
  formatGenderLabel,
  formatMonthTitle,
  monthOrdinal,
  parseDisplayDate,
  shiftMonth,
  toIsoDate,
} from './profileModel';

test('성별 코드값을 표시 문구로 바꾼다', () => {
  expect(formatGenderLabel('male')).toBe('남자');
  expect(formatGenderLabel('female')).toBe('여자');
});

test('월간 도장 그리드는 완전한 주 단위로 인접 달 날짜까지 채운다', () => {
  // 2026-07-01은 수요일(getDay=3)이라 앞에 6월 28·29·30일(스필오버)이 붙고,
  // 마지막 주는 8월 1일로 채워져 총 35칸(5주)이 된다.
  const cells = buildMonthGrid(2026, 7, new Set());
  expect(cells).toHaveLength(35);
  expect(cells.length % 7).toBe(0);
  expect(cells[0]).toEqual({
    day: 28,
    filled: false,
    inMonth: false,
    iso: '2026-06-28',
  });
  expect(cells.slice(0, 3).every(cell => !cell.inMonth)).toBe(true);
  expect(cells[3]).toEqual({
    day: 1,
    filled: false,
    inMonth: true,
    iso: '2026-07-01',
  });
  const last = cells[cells.length - 1];
  expect(last).toEqual({day: 1, filled: false, inMonth: false, iso: '2026-08-01'});
});

test('적립 날짜는 기준 달·인접 달 모두 채워진 도장으로 표시한다', () => {
  const cells = buildMonthGrid(2026, 7, new Set(['2026-07-02', '2026-06-30']));
  const july2 = cells.find(cell => cell.iso === '2026-07-02');
  const july3 = cells.find(cell => cell.iso === '2026-07-03');
  const june30 = cells.find(cell => cell.iso === '2026-06-30');
  expect(july2?.filled).toBe(true);
  expect(july3?.filled).toBe(false);
  expect(june30).toMatchObject({filled: true, inMonth: false});
});

test('셀을 7칸 단위 주로 나눈다', () => {
  const weeks = chunkIntoWeeks(buildMonthGrid(2026, 7, new Set()));
  weeks.forEach(week => expect(week).toHaveLength(7));
});

test('월 순번은 연도 경계를 넘어 비교할 수 있다', () => {
  expect(monthOrdinal(2026, 7) - monthOrdinal(2026, 6)).toBe(1);
  expect(monthOrdinal(2027, 1) - monthOrdinal(2026, 12)).toBe(1);
  expect(monthOrdinal(2026, 6)).toBeLessThan(monthOrdinal(2026, 7));
});

test('이전·다음 달 이동은 연도 경계를 넘는다', () => {
  expect(shiftMonth(2026, 7, 1)).toEqual({year: 2026, month: 8});
  expect(shiftMonth(2026, 12, 1)).toEqual({year: 2027, month: 1});
  expect(shiftMonth(2026, 1, -1)).toEqual({year: 2025, month: 12});
});

test('월 제목과 ISO 날짜를 만든다', () => {
  expect(formatMonthTitle(2026, 7)).toBe('2026년 7월');
  expect(toIsoDate(2026, 7, 2)).toBe('2026-07-02');
});

test('표시 날짜 문자열을 파싱하고 다시 만든다', () => {
  expect(parseDisplayDate('1999.08.02')).toEqual({
    year: 1999,
    month: 8,
    day: 2,
  });
  expect(parseDisplayDate('bad')).toBeNull();
  expect(parseDisplayDate('1999.13.02')).toBeNull();
  expect(formatDisplayDate(1999, 8, 2)).toBe('1999.08.02');
});
