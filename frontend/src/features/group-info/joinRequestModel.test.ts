import {ApiError} from '../../shared/api';
import {
  isJoinRequestAlreadyProcessed,
  joinRequestDecisionErrorMessage,
  pendingRequests,
  removeRequest,
  roleLabel,
} from './joinRequestModel';
import type {JoinRequest} from './types';

const request = (
  id: string,
  status: JoinRequest['status'],
): JoinRequest => ({
  joinRequestId: id,
  applicantUserId: `user-${id}`,
  applicantName: id,
  profileImageUrl: null,
  status,
  assignedRole: null,
  processedAt: null,
  createdAt: '2026-07-30T00:00:00Z',
});

describe('pendingRequests', () => {
  test('대기 중(PENDING_ADMIN) 요청만 남긴다', () => {
    const result = pendingRequests([
      request('a', 'PENDING_ADMIN'),
      request('b', 'APPROVED'),
      request('c', 'REJECTED'),
      request('d', 'PENDING_ADMIN'),
    ]);
    expect(result.map((r) => r.joinRequestId)).toEqual(['a', 'd']);
  });
});

describe('removeRequest', () => {
  test('해당 id의 요청을 제거한다', () => {
    const result = removeRequest(
      [request('a', 'PENDING_ADMIN'), request('b', 'PENDING_ADMIN')],
      'a',
    );
    expect(result.map((r) => r.joinRequestId)).toEqual(['b']);
  });

  test('없는 id면 목록을 그대로 둔다', () => {
    const list = [request('a', 'PENDING_ADMIN')];
    expect(removeRequest(list, 'x')).toHaveLength(1);
  });
});

describe('roleLabel', () => {
  test('역할을 한국어 문구로 바꾼다', () => {
    expect(roleLabel('guardian')).toBe('보호자');
    expect(roleLabel('careReceiver')).toBe('피보호자');
  });
});

const apiError = (code: string): ApiError =>
  new ApiError({code, kind: 'server', message: 'conflict', status: 409});

describe('joinRequestDecisionErrorMessage', () => {
  test('409 코드별로 원인 문구를 구분한다', () => {
    expect(
      joinRequestDecisionErrorMessage(
        apiError('JOIN_REQUEST_ALREADY_PROCESSED'),
      ),
    ).toBe('이미 처리된 가입 요청이에요.');
    expect(
      joinRequestDecisionErrorMessage(
        apiError('CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP'),
      ),
    ).toBe(
      '신청자가 이미 다른 그룹의 피보호자예요. 보호자 역할로만 승인할 수 있어요.',
    );
  });

  test('그 외 오류는 일반 재시도 문구를 사용한다', () => {
    expect(joinRequestDecisionErrorMessage(new Error('network'))).toBe(
      '가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
    expect(joinRequestDecisionErrorMessage(apiError('UNKNOWN'))).toBe(
      '가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  });
});

describe('isJoinRequestAlreadyProcessed', () => {
  test('이미 처리된 요청 코드만 참으로 판별한다', () => {
    expect(
      isJoinRequestAlreadyProcessed(apiError('JOIN_REQUEST_ALREADY_PROCESSED')),
    ).toBe(true);
    expect(isJoinRequestAlreadyProcessed(apiError('UNKNOWN'))).toBe(false);
    expect(isJoinRequestAlreadyProcessed(new Error('x'))).toBe(false);
  });
});
