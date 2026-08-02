import {
  buildWeekEventLayout,
  createCalendarMonth,
  eventsForDate,
  formatEventTime,
  getTodayDateKey,
  shiftMonth,
  shiftSelectedDateToMonth,
} from './calendarModel';
import type {CalendarEventSummary} from './types';

const event = (
  overrides: Partial<CalendarEventSummary>,
): CalendarEventSummary => ({
  endAt: null,
  endDate: '2026-07-17',
  eventDate: '2026-07-17',
  id: 'event-1',
  startAt: null,
  title: '가족 모임',
  ...overrides,
});

test('월간 그리드는 이전·다음 달을 포함한 6주 42일을 만든다', () => {
  const month = createCalendarMonth(2026, 7);

  expect(month.weeks).toHaveLength(6);
  expect(month.startDate).toBe('2026-06-28');
  expect(month.endDate).toBe('2026-08-08');
  expect(month.weeks.flatMap(week => week.days)).toHaveLength(42);
});

test('연말·윤년 월 이동과 선택 날짜 보정을 처리한다', () => {
  expect(shiftMonth({month: 12, year: 2026}, 1)).toEqual({
    month: 1,
    year: 2027,
  });
  expect(
    shiftSelectedDateToMonth('2028-01-31', {month: 2, year: 2028}),
  ).toBe('2028-02-29');
});

test('KST 기준 오늘 날짜를 계산한다', () => {
  expect(getTodayDateKey(new Date('2026-07-31T16:30:00.000Z'))).toBe(
    '2026-08-01',
  );
});

test('기간 일정은 주 경계에서 끊고 다음 주에 이어지는 표시를 남긴다', () => {
  const month = createCalendarMonth(2026, 7);
  const multiDay = event({
    endDate: '2026-07-08',
    eventDate: '2026-07-03',
  });

  const firstWeek = buildWeekEventLayout(month.weeks[0], [multiDay]);
  const secondWeek = buildWeekEventLayout(month.weeks[1], [multiDay]);

  expect(firstWeek.segments[0]).toMatchObject({
    continuesAfter: true,
    continuesBefore: false,
    endColumn: 6,
    startColumn: 5,
  });
  expect(secondWeek.segments[0]).toMatchObject({
    continuesAfter: false,
    continuesBefore: true,
    endColumn: 3,
    startColumn: 0,
  });
});

test('표시 가능한 막대 수를 넘긴 일정은 날짜별 초과 개수로 집계한다', () => {
  const week = createCalendarMonth(2026, 7).weeks[2];
  const events = ['a', 'b', 'c', 'd'].map(id =>
    event({
      endDate: '2026-07-15',
      eventDate: '2026-07-15',
      id,
      title: id,
    }),
  );

  const layout = buildWeekEventLayout(week, events, 3);

  expect(layout.segments).toHaveLength(3);
  expect(layout.overflowByDate['2026-07-15']).toBe(1);
});

test('선택 날짜에는 하루 일정과 걸쳐 있는 일정을 모두 반환한다', () => {
  const events = [
    event({id: 'single'}),
    event({
      endDate: '2026-07-20',
      eventDate: '2026-07-15',
      id: 'range',
    }),
    event({eventDate: '2026-07-18', id: 'later'}),
  ];

  expect(eventsForDate(events, '2026-07-17').map(item => item.id)).toEqual([
    'range',
    'single',
  ]);
});

test('시간 일정은 UTC timestamp를 KST 시각으로 표시한다', () => {
  expect(
    formatEventTime(
      event({
        endAt: '2026-07-17T07:00:00Z',
        startAt: '2026-07-17T06:00:00Z',
      }),
    ),
  ).toBe('15:00 - 16:00');
  expect(formatEventTime(event({}))).toBe('하루 종일');
});
