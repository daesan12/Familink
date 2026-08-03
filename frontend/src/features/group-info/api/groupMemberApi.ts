import type {GroupRole} from '../../../app-shell';
import {ApiError, apiClient, type ApiSuccess} from '../../../shared/api';
import {parseApiEnvelope} from './groupApi';
import type {GroupMember, MemberGender} from '../types';

type ServerGroupRole = 'CARE_RECEIVER' | 'GUARDIAN';

export interface MemberProfile {
  age: number | null;
  displayName: string;
  gender: MemberGender | null;
  memberId: string;
}

export interface MemberAliasUpdate {
  alias: string;
  targetMemberId: string;
}

export interface MemberRoleUpdate {
  groupId: string;
  memberId: string;
  role: GroupRole;
}

export type GroupMembersLoader = (
  groupId: string,
) => Promise<readonly GroupMember[]>;

export type MemberProfileLoader = (
  groupId: string,
  memberId: string,
) => Promise<MemberProfile>;

export type MemberAliasUpdater = (
  groupId: string,
  targetMemberId: string,
  alias: string,
) => Promise<MemberAliasUpdate>;

export type MemberRoleUpdater = (
  groupId: string,
  memberId: string,
  role: GroupRole,
) => Promise<MemberRoleUpdate>;

export interface GroupMemberGateway {
  loadMembers: GroupMembersLoader;
  loadMemberProfile: MemberProfileLoader;
  updateMemberAlias: MemberAliasUpdater;
  updateMemberRole: MemberRoleUpdater;
}

/** API-GROUPS-005: 현재 그룹의 활성 구성원을 조회한다. */
export async function loadMembers(
  groupId: string,
): Promise<readonly GroupMember[]> {
  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/members`,
  );
  return parseApiEnvelope(
    response.data,
    response.status,
    parseMembersResponse,
  );
}

/** API-GROUPS-015: 같은 그룹 구성원의 축소 프로필을 조회한다. */
export async function loadMemberProfile(
  groupId: string,
  memberId: string,
): Promise<MemberProfile> {
  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
      memberId,
    )}`,
  );
  const result = parseApiEnvelope(
    response.data,
    response.status,
    parseMemberProfile,
  );
  if (result.memberId !== memberId) {
    throwInvalidResponse(response.status);
  }
  return result;
}

/** API-GROUPS-010: 관리자가 활성 구성원의 역할을 변경한다. */
export async function updateMemberRole(
  groupId: string,
  memberId: string,
  role: GroupRole,
): Promise<MemberRoleUpdate> {
  const response = await apiClient.patch<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
      memberId,
    )}/role`,
    {role: toServerGroupRole(role)},
  );
  const result = parseApiEnvelope(
    response.data,
    response.status,
    parseMemberRoleUpdate,
  );
  if (result.groupId !== groupId || result.memberId !== memberId) {
    throwInvalidResponse(response.status);
  }
  return result;
}

/** API-ALIASES-001: 현재 사용자가 대상 구성원에게 보일 호칭을 저장한다. */
export async function updateMemberAlias(
  groupId: string,
  targetMemberId: string,
  alias: string,
): Promise<MemberAliasUpdate> {
  const response = await apiClient.put<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
      targetMemberId,
    )}/alias`,
    {alias},
  );
  const result = parseApiEnvelope(
    response.data,
    response.status,
    parseMemberAliasUpdate,
  );
  if (result.targetMemberId !== targetMemberId) {
    throwInvalidResponse(response.status);
  }
  return result;
}

export const familyGroupMemberGateway: GroupMemberGateway = {
  loadMembers,
  loadMemberProfile,
  updateMemberAlias,
  updateMemberRole,
};

function parseMembersResponse(
  value: unknown,
): readonly GroupMember[] | null {
  if (!isRecord(value) || !Array.isArray(value.members)) {
    return null;
  }

  const members = value.members.map(parseMemberSummary);
  return members.every(isNotNull) ? members : null;
}

function throwInvalidResponse(status: number): never {
  throw new ApiError({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    message: '서버 응답의 대상 식별자가 요청과 일치하지 않습니다.',
    status,
  });
}

function parseMemberSummary(value: unknown): GroupMember | null {
  if (!isRecord(value)) {
    return null;
  }

  const memberId = parseId(value.memberId);
  const userId = parseId(value.userId);
  const role = parseServerGroupRole(value.role);
  const profileImageUrl =
    value.profileImageUrl === undefined || value.profileImageUrl === null
      ? null
      : isNonEmptyString(value.profileImageUrl)
        ? value.profileImageUrl.trim()
        : INVALID;
  if (
    memberId === null ||
    userId === null ||
    !isNonEmptyString(value.displayName) ||
    role === null ||
    typeof value.isManager !== 'boolean' ||
    profileImageUrl === INVALID
  ) {
    return null;
  }

  const displayName = value.displayName.trim();
  return {
    age: null,
    alias: null,
    avatarText: Array.from(displayName)[0] ?? '',
    gender: null,
    isManager: value.isManager,
    memberId,
    name: displayName,
    profileImageUrl,
    role,
    userId,
  };
}

function parseMemberProfile(value: unknown): MemberProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const memberId = parseId(value.memberId);
  const age = parseNullableAge(value.age);
  const gender = parseNullableGender(value.gender);
  if (
    memberId === null ||
    !isNonEmptyString(value.displayName) ||
    age === INVALID ||
    gender === INVALID
  ) {
    return null;
  }

  return {
    age,
    displayName: value.displayName.trim(),
    gender,
    memberId,
  };
}

function parseMemberRoleUpdate(value: unknown): MemberRoleUpdate | null {
  if (!isRecord(value)) {
    return null;
  }

  const groupId = parseId(value.groupId);
  const memberId = parseId(value.memberId);
  const role = parseServerGroupRole(value.role);
  if (groupId === null || memberId === null || role === null) {
    return null;
  }

  return {groupId, memberId, role};
}

function parseMemberAliasUpdate(value: unknown): MemberAliasUpdate | null {
  if (!isRecord(value)) {
    return null;
  }

  const targetMemberId = parseId(value.targetMemberId);
  if (
    targetMemberId === null ||
    !isNonEmptyString(value.alias) ||
    Array.from(value.alias.trim()).length > 10
  ) {
    return null;
  }

  return {alias: value.alias.trim(), targetMemberId};
}

const INVALID = Symbol('invalid');

function parseId(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return String(value);
}

function parseServerGroupRole(value: unknown): GroupRole | null {
  if (value === 'GUARDIAN') {
    return 'guardian';
  }
  if (value === 'CARE_RECEIVER') {
    return 'careReceiver';
  }
  return null;
}

function parseNullableAge(value: unknown): number | null | typeof INVALID {
  if (value === null) {
    return null;
  }
  return isNonNegativeInteger(value) ? value : INVALID;
}

function parseNullableGender(
  value: unknown,
): MemberGender | null | typeof INVALID {
  if (value === null) {
    return null;
  }
  if (value === 'MALE') {
    return 'male';
  }
  if (value === 'FEMALE') {
    return 'female';
  }
  return INVALID;
}

function toServerGroupRole(role: GroupRole): ServerGroupRole {
  return role === 'guardian' ? 'GUARDIAN' : 'CARE_RECEIVER';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
