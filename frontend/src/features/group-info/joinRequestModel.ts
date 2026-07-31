import type {GroupRole} from '../../app-shell';

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
