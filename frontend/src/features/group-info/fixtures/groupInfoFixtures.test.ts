import {getDevelopmentGroupInfo} from './groupInfoFixtures';

test('그룹 ID에 맞는 그룹의 구성원을 돌려준다', () => {
  expect(
    getDevelopmentGroupInfo('development-guardian-group').members.map(
      (m) => m.name,
    ),
  ).toContain('이경호');
  expect(
    getDevelopmentGroupInfo('development-care-receiver-group').members.map(
      (m) => m.name,
    ),
  ).toContain('박말순');
  expect(
    getDevelopmentGroupInfo('development-empty-group').members.map(
      (m) => m.name,
    ),
  ).toContain('최영숙');
});

test('그룹마다 서로 다른 구성원 목록을 돌려준다', () => {
  const alumni = getDevelopmentGroupInfo(
    'development-care-receiver-group',
  ).members.map((m) => m.memberId);
  const church = getDevelopmentGroupInfo(
    'development-empty-group',
  ).members.map((m) => m.memberId);
  expect(alumni).not.toEqual(church);
});

test('알 수 없는 그룹은 가족 그룹으로 폴백한다', () => {
  const fallback = getDevelopmentGroupInfo('unknown-group');
  expect(fallback.members.map((m) => m.name)).toContain('이경호');
  expect(fallback.currentMemberId).toBe('member-gyeongho');
});
