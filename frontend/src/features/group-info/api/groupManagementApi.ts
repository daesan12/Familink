import {ApiError, apiClient, type ApiSuccess} from '../../../shared/api';
import {parseApiEnvelope} from './groupApi';

export interface ManagerUpdate {
  groupId: string;
  managerMemberId: string;
}

export type ManagerUpdater = (
  groupId: string,
  newManagerMemberId: string,
) => Promise<ManagerUpdate>;

export type MemberRemover = (
  groupId: string,
  memberId: string,
) => Promise<void>;

export type GroupLeaver = (groupId: string) => Promise<void>;

export type GroupDeleter = (
  groupId: string,
  confirmationName: string,
) => Promise<void>;

export interface GroupManagementGateway {
  changeManager: ManagerUpdater;
  deleteGroup: GroupDeleter;
  leaveGroup: GroupLeaver;
  removeMember: MemberRemover;
}

/** API-GROUPS-011: 그룹 관리자가 활성 구성원에게 관리자 권한을 위임한다. */
export async function changeManager(
  groupId: string,
  newManagerMemberId: string,
): Promise<ManagerUpdate> {
  const requestedManagerId = String(toRequestId(newManagerMemberId));
  const response = await apiClient.patch<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/manager`,
    {newManagerMemberId: Number(requestedManagerId)},
  );
  const result = parseApiEnvelope(
    response.data,
    response.status,
    parseManagerUpdate,
  );
  if (
    result.groupId !== groupId ||
    result.managerMemberId !== requestedManagerId
  ) {
    throwInvalidResponse(response.status);
  }
  return result;
}

/** API-GROUPS-012: 그룹 관리자가 다른 활성 구성원을 내보낸다. */
export async function removeMember(
  groupId: string,
  memberId: string,
): Promise<void> {
  const response = await apiClient.delete(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
      memberId,
    )}`,
  );
  ensureNoContent(response.status);
}

/** API-GROUPS-013: 현재 사용자가 그룹에서 탈퇴한다. */
export async function leaveGroup(groupId: string): Promise<void> {
  const response = await apiClient.delete(
    `/groups/${encodeURIComponent(groupId)}/leave`,
  );
  ensureNoContent(response.status);
}

/** API-GROUPS-014: 다른 활성 구성원이 없는 그룹을 이름 확인 후 삭제한다. */
export async function deleteGroup(
  groupId: string,
  confirmationName: string,
): Promise<void> {
  const normalizedName = confirmationName.trim();
  if (normalizedName.length === 0) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'invalidResponse',
      message: '그룹 이름 확인이 필요합니다.',
    });
  }

  const response = await apiClient.delete(
    `/groups/${encodeURIComponent(groupId)}`,
    {data: {confirmationName: normalizedName}},
  );
  ensureNoContent(response.status);
}

export const familyGroupManagementGateway: GroupManagementGateway = {
  changeManager,
  deleteGroup,
  leaveGroup,
  removeMember,
};

export function getGroupManagementErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  switch (error.code) {
    case 'UNAUTHORIZED':
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    case 'FORBIDDEN':
    case 'NOT_GROUP_MANAGER':
      return '이 작업을 수행할 권한이 없습니다.';
    case 'GROUP_MEMBER_NOT_FOUND':
    case 'GROUP_MEMBER_ALREADY_LEFT':
      return '구성원 상태가 바뀌었습니다. 그룹 정보를 다시 확인해 주세요.';
    case 'CANNOT_REMOVE_SELF':
      return '본인은 내보낼 수 없습니다.';
    case 'MANAGER_TRANSFER_REQUIRED':
      return '다른 활성 구성원에게 관리자 권한을 먼저 위임해 주세요.';
    case 'GROUP_HAS_ACTIVE_MEMBERS':
      return '다른 활성 구성원이 있으면 그룹을 삭제할 수 없습니다.';
    case 'GROUP_NAME_MISMATCH':
      return '확인용 그룹 이름이 일치하지 않습니다.';
    case 'NETWORK_ERROR':
    case 'API_TIMEOUT':
      return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
    default:
      return error.message || fallback;
  }
}

interface ManagerUpdateResponse {
  groupId: string;
  managerMemberId: string;
}

function parseManagerUpdate(value: unknown): ManagerUpdateResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const groupId = parseId(value.groupId);
  const managerMemberId = parseId(value.managerMemberId);
  if (groupId === null || managerMemberId === null) {
    return null;
  }

  return {groupId, managerMemberId};
}

function toRequestId(value: string): number {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'invalidResponse',
      message: '구성원 식별자가 올바르지 않습니다.',
    });
  }

  const id = Number(normalized);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'invalidResponse',
      message: '구성원 식별자가 올바르지 않습니다.',
    });
  }
  return id;
}

function parseId(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return String(value);
}

function ensureNoContent(status: number): void {
  if (status === 204) {
    return;
  }
  throwInvalidResponse(status);
}

function throwInvalidResponse(status: number): never {
  throw new ApiError({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    message: '서버가 예상하지 못한 응답을 반환했습니다.',
    status,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
