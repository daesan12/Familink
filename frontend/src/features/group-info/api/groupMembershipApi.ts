import type {GroupRole} from '../../../app-shell';
import {apiClient, type ApiSuccess} from '../../../shared/api';
import {getInviteCode, parseApiEnvelope} from './groupApi';
import type {
  GroupInviteCode,
  JoinRequest,
  JoinRequestDecisionInput,
  JoinRequestStatus,
} from '../types';

// 그룹 초대 코드 조회 로더. 테스트에서는 목업 로더를 주입할 수 있다.
export type GroupInviteCodeLoader = (
  groupId: string,
) => Promise<GroupInviteCode>;

// 관리자가 승인 대기 가입 요청을 조회하는 로더.
export type JoinRequestsLoader = (
  groupId: string,
) => Promise<readonly JoinRequest[]>;

// 관리자가 가입 요청을 승인하거나 거절하는 프로세서.
export type JoinRequestProcessor = (
  groupId: string,
  input: JoinRequestDecisionInput,
) => Promise<void>;

export interface GroupMembershipGateway {
  loadJoinRequests: JoinRequestsLoader;
  processJoinRequest: JoinRequestProcessor;
}

export async function loadGroupInviteCode(
  groupId: string,
): Promise<GroupInviteCode> {
  return getInviteCode(groupId);
}

/**
 * API-GROUPS-008: 현재 그룹의 가입 요청을 조회한다.
 * 화면은 승인 대기 요청만 다루므로 서버에도 동일한 필터를 전달한다.
 */
export async function loadJoinRequests(
  groupId: string,
): Promise<readonly JoinRequest[]> {
  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/join-requests?status=PENDING_ADMIN`,
  );
  return parseApiEnvelope(
    response.data,
    response.status,
    parseJoinRequestsResponse,
  );
}

/** API-GROUPS-009: 가입 요청을 승인하거나 거절한다. */
export async function processJoinRequest(
  groupId: string,
  input: JoinRequestDecisionInput,
): Promise<void> {
  const response = await apiClient.patch<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/join-requests/${encodeURIComponent(
      input.joinRequestId,
    )}`,
    {
      assignedRole:
        input.assignedRole === undefined
          ? null
          : toServerGroupRole(input.assignedRole),
      decision: input.decision,
    },
  );

  parseApiEnvelope(response.data, response.status, parseDecisionResponse);
}

export const familyGroupMembershipGateway: GroupMembershipGateway = {
  loadJoinRequests,
  processJoinRequest,
};

interface DecisionResponse {
  assignedRole: GroupRole | null;
  joinRequestId: string;
  memberId: string | null;
  status: JoinRequestStatus;
}

function parseJoinRequestsResponse(
  value: unknown,
): readonly JoinRequest[] | null {
  if (!isRecord(value) || !Array.isArray(value.joinRequests)) {
    return null;
  }

  const requests = value.joinRequests.map(parseJoinRequest);
  return requests.every(isNotNull) ? requests : null;
}

function parseJoinRequest(value: unknown): JoinRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const joinRequestId = parseId(value.joinRequestId);
  const applicantUserId = parseId(value.applicantUserId);
  const assignedRole = parseNullableRole(value.assignedRole);
  const processedAt = parseNullableInstant(value.processedAt);
  if (
    joinRequestId === null ||
    applicantUserId === null ||
    !isNonEmptyString(value.applicantName) ||
    !isNullableString(value.profileImageUrl) ||
    !isJoinRequestStatus(value.status) ||
    assignedRole === INVALID ||
    processedAt === INVALID ||
    !isInstant(value.createdAt)
  ) {
    return null;
  }

  return {
    applicantName: value.applicantName,
    applicantUserId,
    assignedRole,
    createdAt: value.createdAt,
    joinRequestId,
    processedAt,
    profileImageUrl: value.profileImageUrl ?? null,
    status: value.status,
  };
}

function parseDecisionResponse(value: unknown): DecisionResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const joinRequestId = parseId(value.joinRequestId);
  const memberId = parseNullableId(value.memberId);
  const assignedRole = parseNullableRole(value.assignedRole);
  if (
    joinRequestId === null ||
    memberId === INVALID ||
    assignedRole === INVALID ||
    !isJoinRequestStatus(value.status)
  ) {
    return null;
  }

  return {
    assignedRole,
    joinRequestId,
    memberId,
    status: value.status,
  };
}

const INVALID = Symbol('invalid');

function parseId(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return String(value);
}

function parseNullableId(value: unknown): string | null | typeof INVALID {
  if (value === null || value === undefined) {
    return null;
  }
  const id = parseId(value);
  return id ?? INVALID;
}

function parseNullableRole(value: unknown): GroupRole | null | typeof INVALID {
  if (value === null || value === undefined) {
    return null;
  }
  if (value === 'GUARDIAN') {
    return 'guardian';
  }
  if (value === 'CARE_RECEIVER') {
    return 'careReceiver';
  }
  return INVALID;
}

function toServerGroupRole(role: GroupRole): 'CARE_RECEIVER' | 'GUARDIAN' {
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

function isNullableString(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || typeof value === 'string';
}

function isJoinRequestStatus(value: unknown): value is JoinRequestStatus {
  return (
    value === 'APPROVED' || value === 'PENDING_ADMIN' || value === 'REJECTED'
  );
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function parseNullableInstant(value: unknown): string | null | typeof INVALID {
  if (value === null || value === undefined) {
    return null;
  }
  return isInstant(value) ? value : INVALID;
}
