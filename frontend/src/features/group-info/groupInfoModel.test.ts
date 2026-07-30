import {
  ALIAS_MAX_LENGTH,
  applyAliasChange,
  applyRoleChange,
  canManageRoles,
  clampAliasInput,
  countMembersByRole,
  formatAge,
  formatGender,
  formatMemberCounts,
  isAliasSaveable,
  resolveMemberDisplayName,
} from './groupInfoModel';
import type {GroupMember} from './types';

function member(overrides: Partial<GroupMember>): GroupMember {
  return {
    memberId: 'm-1',
    name: '홍길동',
    alias: null,
    role: 'guardian',
    isManager: false,
    avatarText: '홍',
    age: 30,
    gender: 'male',
    weeklyRank: 1,
    weeklyStamps: [false, false, false, false, false, false, false],
    ...overrides,
  };
}

const MEMBERS: readonly GroupMember[] = [
  member({memberId: 'm-1', role: 'guardian', isManager: true}),
  member({memberId: 'm-2', role: 'guardian'}),
  member({memberId: 'm-3', role: 'careReceiver'}),
];

test('호칭이 있으면 호칭을, 없으면 실제 이름을 표시한다', () => {
  expect(resolveMemberDisplayName(member({alias: '아빠', name: '손수호'}))).toBe(
    '아빠',
  );
  expect(resolveMemberDisplayName(member({alias: null, name: '손수호'}))).toBe(
    '손수호',
  );
  // 공백뿐인 호칭은 없는 것으로 본다.
  expect(resolveMemberDisplayName(member({alias: '   ', name: '손수호'}))).toBe(
    '손수호',
  );
});

test('역할별 인원 수를 세고 문구로 만든다', () => {
  expect(countMembersByRole(MEMBERS)).toEqual({
    careReceiverCount: 1,
    guardianCount: 2,
  });
  expect(formatMemberCounts(MEMBERS)).toBe('피보호자 1명, 보호자 2명');
});

test('호칭 입력은 최대 길이로 자른다', () => {
  const long = '가나다라마바사아자차카타';
  expect(Array.from(clampAliasInput(long))).toHaveLength(ALIAS_MAX_LENGTH);
});

test('저장 가능한 호칭만 통과시킨다', () => {
  expect(isAliasSaveable('아빠')).toBe(true);
  expect(isAliasSaveable('   ')).toBe(false);
  expect(isAliasSaveable('')).toBe(false);
  expect(isAliasSaveable('가나다라마바사아자차카')).toBe(false);
});

test('축소 프로필 나이·성별 문구를 만든다', () => {
  expect(formatAge(27)).toBe('만 27세');
  expect(formatGender('male')).toBe('남자');
  expect(formatGender('female')).toBe('여자');
});

test('방장만 역할 관리 권한을 가진다', () => {
  expect(canManageRoles(MEMBERS, 'm-1')).toBe(true);
  expect(canManageRoles(MEMBERS, 'm-2')).toBe(false);
  expect(canManageRoles(MEMBERS, 'unknown')).toBe(false);
});

test('역할 변경은 대상 구성원만 바꾸고 원본을 유지한다', () => {
  const next = applyRoleChange(MEMBERS, 'm-2', 'careReceiver');
  expect(next.find((m) => m.memberId === 'm-2')?.role).toBe('careReceiver');
  expect(next.find((m) => m.memberId === 'm-1')?.role).toBe('guardian');
  // 원본 배열은 변하지 않는다.
  expect(MEMBERS.find((m) => m.memberId === 'm-2')?.role).toBe('guardian');
});

test('호칭 변경은 대상 구성원만 갱신하고 공백은 해제로 처리한다', () => {
  const set = applyAliasChange(MEMBERS, 'm-2', '삼촌');
  expect(set.find((m) => m.memberId === 'm-2')?.alias).toBe('삼촌');

  const cleared = applyAliasChange(set, 'm-2', '   ');
  expect(cleared.find((m) => m.memberId === 'm-2')?.alias).toBeNull();
});
