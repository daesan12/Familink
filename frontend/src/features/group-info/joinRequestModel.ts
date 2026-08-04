import type {GroupRole} from '../../app-shell';

import {ApiError} from '../../shared/api';
import type {JoinRequest} from './types';

// 화면에 보여줄 대기 중(PENDING_ADMIN) 요청만 추린다.
export function pendingRequests(
  requests: readonly JoinRequest[],
): readonly JoinRequest[] {
  return requests.filter((request) => request.status === 'PENDING_ADMIN');
}

// 처리(승인·거절)한 요청을 목록에서 제거한다.
export function removeRequest(
  requests: readonly JoinRequest[],
  joinRequestId: string,
): readonly JoinRequest[] {
  return requests.filter(
    (request) => request.joinRequestId !== joinRequestId,
  );
}

// 역할 표시 문구.
export function roleLabel(role: GroupRole): string {
  return role === 'guardian' ? '보호자' : '피보호자';
}

// 이미 처리된 요청은 재시도해도 성공할 수 없으므로 호출부가 목록에서 정리한다.
export function isJoinRequestAlreadyProcessed(error: unknown): boolean {
  return (
    error instanceof ApiError && error.code === 'JOIN_REQUEST_ALREADY_PROCESSED'
  );
}

export function isCareReceiverAlreadyActiveInOtherGroup(
  error: unknown,
): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP'
  );
}

// API-GROUPS-009 승인·거절 실패의 409 코드를 사용자 문구로 구분한다.
export function joinRequestDecisionErrorMessage(error: unknown): string {
  if (isJoinRequestAlreadyProcessed(error)) {
    return '이미 처리된 가입 요청이에요.';
  }
  if (isCareReceiverAlreadyActiveInOtherGroup(error)) {
    return '신청자가 이미 다른 그룹의 피보호자예요. 보호자 역할로만 승인할 수 있어요.';
  }
  return '가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
