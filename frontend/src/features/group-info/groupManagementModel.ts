import {ALIAS_MAX_LENGTH, clampAliasInput} from './groupInfoModel';
import type {GroupMember} from './types';

// 그룹명 최대 길이. 개인화 호칭과 동일한 10자 규칙을 재사용한다(H-10 입력창 1~10자).
export const GROUP_NAME_MAX_LENGTH = ALIAS_MAX_LENGTH;

// 그룹명 입력을 최대 길이로 자른다. 호칭 입력과 동일한 규칙이라 로직을 재사용한다.
export function clampGroupNameInput(value: string): string {
  return clampAliasInput(value);
}

// 변경 가능한 그룹명인지 검사한다. 1~10자이며 기존 이름과 '달라졌을' 때만 저장한다.
export function isGroupNameSaveable(
  draft: string,
  currentName: string,
): boolean {
  const trimmed = draft.trim();
  return (
    trimmed.length >= 1 &&
    Array.from(draft).length <= GROUP_NAME_MAX_LENGTH &&
    trimmed !== currentName.trim()
  );
}

// H-6 그룹관리자 변경 후보. 관리자는 보호자(guardian) 구성원에게만 넘길 수 있다.
export function managerCandidates(
  members: readonly GroupMember[],
): readonly GroupMember[] {
  return members.filter((member) => member.role === 'guardian');
}

// 현재 그룹관리자의 memberId. 없으면 null.
export function currentManagerId(
  members: readonly GroupMember[],
): string | null {
  return members.find((member) => member.isManager)?.memberId ?? null;
}

// 그룹관리자 변경을 확정할 수 있는지. 현재 관리자와 '다른' 후보를 골랐을 때만 활성화한다.
export function isManagerChangeSaveable(
  members: readonly GroupMember[],
  selectedMemberId: string | null,
): boolean {
  if (selectedMemberId === null) {
    return false;
  }
  return selectedMemberId !== currentManagerId(members);
}

// H-7 내보낼 수 있는 구성원. 조회자 본인은 내보낼 수 없어(API-GROUPS-012 CANNOT_REMOVE_SELF) 제외한다.
export function removableMembers(
  members: readonly GroupMember[],
  viewerMemberId: string,
): readonly GroupMember[] {
  return members.filter((member) => member.memberId !== viewerMemberId);
}

// H-8 그룹 요약 카드에 표시할 그룹관리자 이름. 없으면 빈 문자열.
export function resolveManagerName(members: readonly GroupMember[]): string {
  const manager = members.find((member) => member.isManager);
  if (!manager) {
    return '';
  }
  const alias = manager.alias?.trim();
  return alias ? alias : manager.name;
}

// H-7 "가입 YYYY.MM.DD" 문구. 어떤 조회 API도 가입일을 내려주지 않아 목업값을 포맷한다.
// 값이 없으면 빈 문자열을 돌려줘 화면에서 날짜 줄을 숨긴다.
export function formatJoinedDate(joinedAt: string | undefined): string {
  if (!joinedAt) {
    return '';
  }
  const [datePart] = joinedAt.split('T');
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) {
    return '';
  }
  return `가입 ${year}.${month}.${day}`;
}
