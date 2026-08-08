import {
  filterPosts,
  formatDateLabel,
  formatMonthLabel,
  getActiveDaySet,
  getCalendarWeeks,
  groupPostsByDate,
  shiftMonth,
} from './archiveModel';
import type {ArchivePost} from './types';

// 로직 검증용 데이터. 실제 목업 내용과 독립적으로 여러 날짜·구성원을 다룬다.
const POSTS: readonly ArchivePost[] = [
  {dateKey: '2026-07-17', groupId: 'g', id: 'a', mediaKind: 'image', memberId: 'm-a', postId: 'p-a'},
  {dateKey: '2026-07-14', groupId: 'g', id: 'b', mediaKind: 'text', memberId: 'm-a', postId: 'p-b', text: 'x'},
  {dateKey: '2026-07-14', groupId: 'g', id: 'c', mediaKind: 'image', memberId: 'm-b', postId: 'p-c'},
  {dateKey: '2026-07-09', groupId: 'g', id: 'd', mediaKind: 'image', memberId: 'm-b', postId: 'p-d'},
];

test('구성원 필터는 해당 구성원의 게시글만 남긴다', () => {
  const filtered = filterPosts(POSTS, {memberId: 'm-a'});

  expect(filtered.map(post => post.id)).toEqual(['a', 'b']);
});

test('구성원 필터가 null이면 전체 게시글을 유지한다', () => {
  expect(filterPosts(POSTS, {memberId: null})).toHaveLength(POSTS.length);
});

test('날짜 필터는 해당 날짜의 게시글만 남긴다', () => {
  const filtered = filterPosts(POSTS, {dateKey: '2026-07-14'});

  expect(filtered.map(post => post.id)).toEqual(['b', 'c']);
});

test('게시글이 없는 구성원은 빈 배열을 반환한다', () => {
  expect(filterPosts(POSTS, {memberId: 'm-none'})).toHaveLength(0);
});

test('날짜 그룹은 최신 날짜가 먼저 오도록 정렬한다', () => {
  const dateKeys = groupPostsByDate(POSTS).map(group => group.dateKey);

  expect(dateKeys).toEqual(['2026-07-17', '2026-07-14', '2026-07-09']);
});

test('활성 날짜 집합은 구성원 필터를 반영한다', () => {
  const allDays = getActiveDaySet(POSTS, 2026, 7);
  const memberADays = getActiveDaySet(POSTS, 2026, 7, 'm-a');
  const memberBDays = getActiveDaySet(POSTS, 2026, 7, 'm-b');

  expect([...allDays].sort((left, right) => left - right)).toEqual([9, 14, 17]);
  expect([...memberADays].sort((left, right) => left - right)).toEqual([14, 17]);
  expect([...memberBDays].sort((left, right) => left - right)).toEqual([9, 14]);
});

test('활성 날짜 집합은 다른 달의 게시글을 포함하지 않는다', () => {
  expect(getActiveDaySet(POSTS, 2026, 8).size).toBe(0);
});

test('shiftMonth는 연도 경계를 넘어 이동한다', () => {
  expect(shiftMonth(2026, 1, -1)).toEqual({month: 12, year: 2025});
  expect(shiftMonth(2026, 12, 1)).toEqual({month: 1, year: 2027});
});

test('getCalendarWeeks는 6주 42칸 고정 격자를 만든다', () => {
  const weeks = getCalendarWeeks(2026, 7);

  expect(weeks).toHaveLength(6);
  expect(weeks.every(week => week.length === 7)).toBe(true);
  // 2026년 7월 1일은 수요일이라 앞에 6월 28~30일이 붙는다.
  expect(weeks[0]?.[0]).toEqual({
    dateKey: '2026-06-28',
    day: 28,
    inMonth: false,
  });
  expect(weeks[0]?.[3]).toEqual({
    dateKey: '2026-07-01',
    day: 1,
    inMonth: true,
  });
  expect(weeks[5]?.[6]).toEqual({
    dateKey: '2026-08-08',
    day: 8,
    inMonth: false,
  });
  expect(weeks.flat().filter(cell => cell.inMonth)).toHaveLength(31);
});

test('28일뿐인 달도 6주 42칸을 채운다', () => {
  // 2026년 2월 1일은 일요일이라 앞 스필오버가 없고, 뒤를 3월 1~14일로 채운다.
  const weeks = getCalendarWeeks(2026, 2);

  expect(weeks).toHaveLength(6);
  expect(weeks[0]?.[0]).toEqual({
    dateKey: '2026-02-01',
    day: 1,
    inMonth: true,
  });
  expect(weeks[5]?.[6]).toEqual({
    dateKey: '2026-03-14',
    day: 14,
    inMonth: false,
  });
});

test('날짜·월 라벨을 한국어 형식으로 만든다', () => {
  expect(formatDateLabel('2026-07-14')).toBe('2026년 7월 14일');
  expect(formatMonthLabel(2026, 7)).toBe('2026년 7월');
});
