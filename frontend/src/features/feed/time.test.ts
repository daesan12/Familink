import {formatRelativeTime} from './time';

const NOW = new Date('2026-07-31T12:00:00Z');

test('1분 미만은 "방금 전"으로 표시한다', () => {
  expect(formatRelativeTime('2026-07-31T11:59:30Z', NOW)).toBe('방금 전');
});

test('1시간 미만은 분 단위로 표시한다', () => {
  expect(formatRelativeTime('2026-07-31T11:25:00Z', NOW)).toBe('35분 전');
});

test('하루 미만은 시간 단위로 표시한다', () => {
  expect(formatRelativeTime('2026-07-31T09:00:00Z', NOW)).toBe('3시간 전');
});

test('일주일 미만은 일 단위로 표시한다', () => {
  expect(formatRelativeTime('2026-07-29T12:00:00Z', NOW)).toBe('2일 전');
});

test('일주일 이상은 YYYY.MM.DD 날짜로 표시한다', () => {
  // 정오(UTC) 기준이라 흔한 타임존에서 날짜 부분이 동일하다.
  expect(formatRelativeTime('2026-07-01T12:00:00Z', NOW)).toBe('2026.07.01');
});

test('미래 시각(음수 diff)은 "방금 전"으로 표시한다', () => {
  expect(formatRelativeTime('2026-07-31T12:05:00Z', NOW)).toBe('방금 전');
});

test('유효하지 않은 시각 문자열은 빈 문자열을 반환한다', () => {
  expect(formatRelativeTime('not-a-date', NOW)).toBe('');
});
