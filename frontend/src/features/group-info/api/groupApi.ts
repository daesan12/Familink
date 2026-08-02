import {
  ApiError,
  apiClient,
  isApiSuccess,
  type ApiSuccess,
} from '../../../shared/api';
import type {FamilyGroup, GroupRole} from '../../../app-shell';
import type {GroupInviteCode} from '../types';

type ServerGroupRole = 'CARE_RECEIVER' | 'GUARDIAN';

export type GroupJoinRequestStatus = 'APPROVED' | 'PENDING_ADMIN' | 'REJECTED';

export interface FamilyGroupSummary extends FamilyGroup {
  isManager: boolean;
  memberCount: number;
  myMemberId: string;
}

export interface GroupJoinRequestSummary {
  groupId: string;
  groupName: string;
  joinRequestId: string;
  processedAt: string | null;
  requestedAt: string;
  status: GroupJoinRequestStatus;
}

export interface FamilyGroupListSnapshot {
  groups: readonly FamilyGroupSummary[];
  joinRequests: readonly GroupJoinRequestSummary[];
}

export interface CreateFamilyGroupInput {
  name: string;
  role: GroupRole;
}

export interface CreatedFamilyGroup {
  createdAt: string;
  group: FamilyGroup;
  inviteCode: string;
  managerMemberId: string;
}

export interface GroupJoinRequestResult {
  groupId: string;
  groupName: string;
  joinRequestId: string;
  status: 'PENDING_ADMIN';
}

export interface FamilyGroupDetail {
  careReceiverCount: number;
  guardianCount: number;
  id: string;
  isManager: boolean;
  managerMemberId: string | null;
  memberCount: number;
  name: string;
}

export interface UpdatedFamilyGroup {
  id: string;
  name: string;
  updatedAt: string;
}

export interface FamilyGroupGateway {
  createGroup(
    input: CreateFamilyGroupInput,
    signal?: AbortSignal,
  ): Promise<CreatedFamilyGroup>;
  getGroupDetail(groupId: string): Promise<FamilyGroupDetail>;
  getInviteCode(groupId: string): Promise<GroupInviteCode>;
  loadGroups(): Promise<FamilyGroupListSnapshot>;
  renameGroup(groupId: string, name: string): Promise<UpdatedFamilyGroup>;
  requestJoinByCode?(
    inviteCode: string,
    signal?: AbortSignal,
  ): Promise<GroupJoinRequestResult>;
}

export async function loadGroups(): Promise<FamilyGroupListSnapshot> {
  const response = await apiClient.get<ApiSuccess<unknown>>('/groups');
  return parseApiEnvelope(response.data, response.status, parseGroupListSnapshot);
}

export async function createGroup(
  input: CreateFamilyGroupInput,
  signal?: AbortSignal,
): Promise<CreatedFamilyGroup> {
  const body = {
    myRole: toServerGroupRole(input.role),
    name: input.name,
  };
  const response =
    signal === undefined
      ? await apiClient.post<ApiSuccess<unknown>>('/groups', body)
      : await apiClient.post<ApiSuccess<unknown>>('/groups', body, {signal});
  const result = parseApiEnvelope(
    response.data,
    response.status,
    parseCreatedGroupResponse,
  );
  const {groupId, ...created} = result;

  return {
    ...created,
    group: {
      id: groupId,
      name: input.name,
      role: input.role,
    },
  };
}

export async function getGroupDetail(
  groupId: string,
): Promise<FamilyGroupDetail> {
  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}`,
  );
  return parseApiEnvelope(response.data, response.status, parseGroupDetail);
}

export async function renameGroup(
  groupId: string,
  name: string,
): Promise<UpdatedFamilyGroup> {
  const response = await apiClient.patch<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}`,
    {name},
  );
  return parseApiEnvelope(response.data, response.status, parseUpdatedGroup);
}

export async function getInviteCode(groupId: string): Promise<GroupInviteCode> {
  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/invite-code`,
  );
  return parseApiEnvelope(response.data, response.status, parseInviteCode);
}

export async function requestJoinByCode(
  inviteCode: string,
  signal?: AbortSignal,
): Promise<GroupJoinRequestResult> {
  const body = {inviteCode};
  const response =
    signal === undefined
      ? await apiClient.post<ApiSuccess<unknown>>(
          '/join-requests/by-code',
          body,
        )
      : await apiClient.post<ApiSuccess<unknown>>(
          '/join-requests/by-code',
          body,
          {signal},
        );
  return parseApiEnvelope(
    response.data,
    response.status,
    parseGroupJoinRequestResult,
  );
}

export const familyGroupGateway: FamilyGroupGateway = {
  createGroup,
  getGroupDetail,
  getInviteCode,
  loadGroups,
  renameGroup,
  requestJoinByCode,
};

interface CreatedGroupResponse {
  createdAt: string;
  groupId: string;
  inviteCode: string;
  managerMemberId: string;
}

export function parseApiEnvelope<T>(
  envelope: unknown,
  status: number,
  parseData: (value: unknown) => T | null,
): T {
  const data = isApiSuccess(envelope) ? parseData(envelope.data) : null;
  if (data !== null) {
    return data;
  }

  throw new ApiError({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    message: '서버가 예상하지 못한 응답을 반환했습니다.',
    status,
  });
}

function parseGroupListSnapshot(
  value: unknown,
): FamilyGroupListSnapshot | null {
  if (!isRecord(value) || !Array.isArray(value.groups)) {
    return null;
  }
  if (!Array.isArray(value.joinRequests)) {
    return null;
  }

  const groups = value.groups.map(parseGroupSummary);
  const joinRequests = value.joinRequests.map(parseJoinRequestSummary);
  if (!groups.every(isNotNull) || !joinRequests.every(isNotNull)) {
    return null;
  }

  return {
    groups,
    joinRequests,
  };
}

function parseGroupSummary(value: unknown): FamilyGroupSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseId(value.id);
  const myMemberId = parseId(value.myMemberId);
  const role = parseServerGroupRole(value.myRole);
  if (
    id === null ||
    myMemberId === null ||
    role === null ||
    !isGroupName(value.name) ||
    !isNonNegativeInteger(value.memberCount) ||
    typeof value.isManager !== 'boolean'
  ) {
    return null;
  }

  return {
    id,
    isManager: value.isManager,
    memberCount: value.memberCount,
    myMemberId,
    name: value.name,
    role,
  };
}

function parseJoinRequestSummary(
  value: unknown,
): GroupJoinRequestSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const joinRequestId = parseId(value.joinRequestId);
  const groupId = parseId(value.groupId);
  if (
    joinRequestId === null ||
    groupId === null ||
    !isGroupName(value.groupName) ||
    !isJoinRequestStatus(value.status) ||
    !isInstant(value.requestedAt) ||
    (value.processedAt !== undefined && !isNullableInstant(value.processedAt))
  ) {
    return null;
  }

  return {
    groupId,
    groupName: value.groupName,
    joinRequestId,
    processedAt: value.processedAt ?? null,
    requestedAt: value.requestedAt,
    status: value.status,
  };
}

function parseCreatedGroupResponse(
  value: unknown,
): CreatedGroupResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const groupId = parseId(value.groupId);
  const managerMemberId = parseId(value.managerMemberId);
  if (
    groupId === null ||
    managerMemberId === null ||
    !isInviteCode(value.inviteCode) ||
    !isInstant(value.createdAt)
  ) {
    return null;
  }

  return {
    createdAt: value.createdAt,
    groupId,
    inviteCode: value.inviteCode,
    managerMemberId,
  };
}

function parseGroupDetail(value: unknown): FamilyGroupDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseId(value.id);
  let managerMemberId: string | null = null;
  if (value.managerMemberId !== null) {
    managerMemberId = parseId(value.managerMemberId);
    if (managerMemberId === null) {
      return null;
    }
  }
  if (
    id === null ||
    !isGroupName(value.name) ||
    typeof value.isManager !== 'boolean' ||
    !isNonNegativeInteger(value.guardianCount) ||
    !isNonNegativeInteger(value.careReceiverCount) ||
    !isNonNegativeInteger(value.memberCount) ||
    value.guardianCount + value.careReceiverCount !== value.memberCount
  ) {
    return null;
  }

  return {
    careReceiverCount: value.careReceiverCount,
    guardianCount: value.guardianCount,
    id,
    isManager: value.isManager,
    managerMemberId,
    memberCount: value.memberCount,
    name: value.name,
  };
}

function parseUpdatedGroup(value: unknown): UpdatedFamilyGroup | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseId(value.id);
  if (id === null || !isGroupName(value.name) || !isInstant(value.updatedAt)) {
    return null;
  }

  return {id, name: value.name, updatedAt: value.updatedAt};
}

function parseInviteCode(value: unknown): GroupInviteCode | null {
  if (!isRecord(value) || !isInviteCode(value.inviteCode)) {
    return null;
  }
  return {inviteCode: value.inviteCode};
}

function parseGroupJoinRequestResult(
  value: unknown,
): GroupJoinRequestResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const groupId = parseId(value.groupId);
  const joinRequestId = parseId(value.joinRequestId);
  if (
    groupId === null ||
    joinRequestId === null ||
    !isGroupName(value.groupName) ||
    value.status !== 'PENDING_ADMIN'
  ) {
    return null;
  }

  return {
    groupId,
    groupName: value.groupName,
    joinRequestId,
    status: 'PENDING_ADMIN',
  };
}

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

function toServerGroupRole(role: GroupRole): ServerGroupRole {
  return role === 'guardian' ? 'GUARDIAN' : 'CARE_RECEIVER';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

function isGroupName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Array.from(value).length <= 10
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isInviteCode(value: unknown): value is string {
  return typeof value === 'string' && Array.from(value).length === 6;
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isNullableInstant(value: unknown): value is string | null {
  return value === null || isInstant(value);
}

function isJoinRequestStatus(value: unknown): value is GroupJoinRequestStatus {
  return (
    value === 'APPROVED' || value === 'PENDING_ADMIN' || value === 'REJECTED'
  );
}
