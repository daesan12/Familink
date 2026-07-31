import {pendingRequests, removeRequest, roleLabel} from './joinRequestModel';
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
