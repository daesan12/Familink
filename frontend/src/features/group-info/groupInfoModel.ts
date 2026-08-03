import type {GroupRole} from '../../app-shell';

import type {
  GroupMember,
  MemberGender,
  PendingJoinCountState,
} from './types';

// 개인화 호칭 최대 길이. H-2 입력창의 글자 수 카운터(0/10) 기준이다.
export const ALIAS_MAX_LENGTH = 10;

// 구성원 목록에 표시할 이름을 정한다.
// 호칭이 있으면 호칭을, 없으면 실제 이름을 쓴다(스펙 규칙 6).
export function resolveMemberDisplayName(member: GroupMember): string {
  const alias = member.alias?.trim();
  return alias ? alias : member.name;
}

// 역할별 인원 수를 센다.
export function countMembersByRole(members: readonly GroupMember[]): {
  careReceiverCount: number;
  guardianCount: number;
} {
  return members.reduce(
    (counts, member) => {
      if (member.role === 'careReceiver') {
        return {...counts, careReceiverCount: counts.careReceiverCount + 1};
      }
      return {...counts, guardianCount: counts.guardianCount + 1};
    },
    {careReceiverCount: 0, guardianCount: 0},
  );
}

// 구성원 헤더 문구를 만든다. H-1의 "피보호자 N명, 보호자 M명" 순서를 따른다.
export function formatMemberCounts(members: readonly GroupMember[]): string {
  const {careReceiverCount, guardianCount} = countMembersByRole(members);
  return `피보호자 ${careReceiverCount}명, 보호자 ${guardianCount}명`;
}

// H-7 '가입 승인 대기' 행의 설명 문구를 만든다. 건수를 알 수 없을 때
// 0건으로 보이면 대기 요청이 없는 것과 구분되지 않으므로 이유를 문구로 밝힌다.
export function formatPendingJoinDescription(
  state: PendingJoinCountState,
): string {
  switch (state.status) {
    case 'success':
      return `승인 요청 ${state.count}건`;
    case 'loading':
      return '승인 요청 불러오는 중';
    case 'error':
      return '건수를 불러오지 못했어요';
    case 'disabled':
      return '관리자만 확인할 수 있어요';
  }
}

// 입력값을 최대 길이로 자른다. TextInput maxLength와 별개로 로직에서도 보장한다.
export function clampAliasInput(value: string): string {
  return Array.from(value).slice(0, ALIAS_MAX_LENGTH).join('');
}

// 저장 가능한 호칭인지 검사한다. 공백만 있거나 최대 길이를 넘으면 저장하지 않는다.
export function isAliasSaveable(value: string): boolean {
  const trimmedLength = value.trim().length;
  return trimmedLength >= 1 && Array.from(value).length <= ALIAS_MAX_LENGTH;
}

// 조회자가 방장(그룹 관리자)인지 확인한다. 방장만 역할을 변경할 수 있다.
export function canManageRoles(
  members: readonly GroupMember[],
  currentMemberId: string,
): boolean {
  return members.some(
    (member) => member.memberId === currentMemberId && member.isManager,
  );
}

// 축소 프로필 팝업에 쓰는 나이 문구.
export function formatAge(age: number | null): string {
  if (age === null) {
    return '미입력';
  }
  return `만 ${age}세`;
}

// 성별 표시 문구.
export function formatGender(gender: MemberGender | null): string {
  if (gender === null) {
    return '미입력';
  }
  return gender === 'male' ? '남자' : '여자';
}

// 세그먼트 토글에서 누른 역할로 바꾼다. 이미 같은 역할이면 그대로 둔다.
export function applyRoleChange(
  members: readonly GroupMember[],
  memberId: string,
  role: GroupRole,
): readonly GroupMember[] {
  return members.map((member) =>
    member.memberId === memberId ? {...member, role} : member,
  );
}

// 대상 구성원의 호칭을 갱신한다. 공백을 제거한 값이 비면 호칭을 해제한다.
export function applyAliasChange(
  members: readonly GroupMember[],
  memberId: string,
  alias: string,
): readonly GroupMember[] {
  const nextAlias = alias.trim() === '' ? null : alias.trim();
  return members.map((member) =>
    member.memberId === memberId ? {...member, alias: nextAlias} : member,
  );
}
