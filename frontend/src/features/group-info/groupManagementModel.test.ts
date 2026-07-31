import {
  clampGroupNameInput,
  currentManagerId,
  formatJoinedDate,
  isGroupNameSaveable,
  isManagerChangeSaveable,
  managerCandidates,
  removableMembers,
  resolveManagerName,
} from './groupManagementModel';
import type {GroupMember} from './types';

function member(overrides: Partial<GroupMember> & {memberId: string}): GroupMember {
  return {
    name: '이름',
    alias: null,
    role: 'guardian',
    isManager: false,
    avatarText: '이',
    age: 30,
    gender: 'male',
    weeklyRank: 1,
    weeklyStamps: [false, false, false, false, false, false, false],
    ...overrides,
  };
}

const MEMBERS: readonly GroupMember[] = [
  member({memberId: 'm-manager', name: '이경호', role: 'guardian', isManager: true}),
  member({memberId: 'm-dad', name: '손수호', alias: '아빠', role: 'guardian'}),
  member({memberId: 'm-sister', name: '홍유라', alias: '딸', role: 'careReceiver'}),
];

describe('그룹명 유효성', () => {
  test('입력을 최대 10자로 자른다', () => {
    expect(clampGroupNameInput('가나다라마바사아자차카타')).toBe('가나다라마바사아자차');
  });

  test('1~10자이며 기존 이름과 다를 때만 저장 가능하다', () => {
    expect(isGroupNameSaveable('우리 가족', '이전 이름')).toBe(true);
    // 공백만 있으면 불가.
    expect(isGroupNameSaveable('   ', '이전 이름')).toBe(false);
    // 기존과 같으면(공백 차이 제외) 불가.
    expect(isGroupNameSaveable('우리 가족', '우리 가족')).toBe(false);
    expect(isGroupNameSaveable('  우리 가족  ', '우리 가족')).toBe(false);
    // 10자 초과는 불가.
    expect(isGroupNameSaveable('가나다라마바사아자차카', '이전')).toBe(false);
  });
});

describe('그룹관리자 변경 후보', () => {
  test('보호자만 후보로 추린다', () => {
    expect(managerCandidates(MEMBERS).map((m) => m.memberId)).toEqual([
      'm-manager',
      'm-dad',
    ]);
  });

  test('현재 관리자 memberId를 찾는다', () => {
    expect(currentManagerId(MEMBERS)).toBe('m-manager');
    expect(currentManagerId([])).toBeNull();
  });

  test('현재 관리자와 다른 후보를 골라야 변경할 수 있다', () => {
    expect(isManagerChangeSaveable(MEMBERS, null)).toBe(false);
    // 현재 관리자 본인을 고르면 변경이 아니다.
    expect(isManagerChangeSaveable(MEMBERS, 'm-manager')).toBe(false);
    expect(isManagerChangeSaveable(MEMBERS, 'm-dad')).toBe(true);
  });
});

describe('구성원 내보내기·요약', () => {
  test('조회자 본인은 내보낼 수 없어 제외한다', () => {
    expect(
      removableMembers(MEMBERS, 'm-manager').map((m) => m.memberId),
    ).toEqual(['m-dad', 'm-sister']);
  });

  test('그룹관리자 이름은 호칭이 있으면 호칭을, 없으면 실명을 쓴다', () => {
    expect(resolveManagerName(MEMBERS)).toBe('이경호');
    expect(
      resolveManagerName([member({memberId: 'x', name: '김철수', alias: '삼촌', isManager: true})]),
    ).toBe('삼촌');
    expect(resolveManagerName([])).toBe('');
  });
});

describe('가입일 포맷', () => {
  test('ISO 날짜를 "가입 YYYY.MM.DD"로 만든다', () => {
    expect(formatJoinedDate('2026-05-12')).toBe('가입 2026.05.12');
    expect(formatJoinedDate('2026-05-12T09:30:00Z')).toBe('가입 2026.05.12');
  });

  test('값이 없거나 형식이 깨지면 빈 문자열을 돌려준다', () => {
    expect(formatJoinedDate(undefined)).toBe('');
    expect(formatJoinedDate('')).toBe('');
    expect(formatJoinedDate('2026-05')).toBe('');
  });
});
