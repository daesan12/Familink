jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {loadJoinRequests, processJoinRequest} from './groupMembershipApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

describe('groupMembershipApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('승인 대기 가입 요청을 실제 API 응답 모델로 변환한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        joinRequests: [
          {
            applicantName: '홍유라',
            applicantUserId: 12,
            assignedRole: null,
            createdAt: '2026-07-31T01:02:03Z',
            joinRequestId: 34,
            processedAt: null,
            profileImageUrl: null,
            status: 'PENDING_ADMIN',
          },
        ],
      }),
    );

    await expect(loadJoinRequests('group/1')).resolves.toEqual([
      {
        applicantName: '홍유라',
        applicantUserId: '12',
        assignedRole: null,
        createdAt: '2026-07-31T01:02:03Z',
        joinRequestId: '34',
        processedAt: null,
        profileImageUrl: null,
        status: 'PENDING_ADMIN',
      },
    ]);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/groups/group%2F1/join-requests?status=PENDING_ADMIN',
    );
  });

  it('승인 시 역할을 서버 enum으로 변환하고 응답을 검증한다', async () => {
    jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({
        assignedRole: 'GUARDIAN',
        joinRequestId: 34,
        memberId: 56,
        status: 'APPROVED',
      }),
    );

    await expect(
      processJoinRequest('group-1', {
        assignedRole: 'guardian',
        decision: 'APPROVE',
        joinRequestId: '34',
      }),
    ).resolves.toBeUndefined();
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/groups/group-1/join-requests/34',
      {assignedRole: 'GUARDIAN', decision: 'APPROVE'},
    );
  });

  it('거절 시 역할을 null로 보내고 memberId 없는 응답을 허용한다', async () => {
    jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({
        assignedRole: null,
        joinRequestId: 34,
        memberId: null,
        status: 'REJECTED',
      }),
    );

    await expect(
      processJoinRequest('group-1', {
        decision: 'REJECT',
        joinRequestId: '34',
      }),
    ).resolves.toBeUndefined();
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/groups/group-1/join-requests/34',
      {assignedRole: null, decision: 'REJECT'},
    );
  });

  it('잘못된 응답은 공통 INVALID_API_RESPONSE로 거절한다', async () => {
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce(success({joinRequests: [{joinRequestId: 1}]}));

    await expect(loadJoinRequests('group-1')).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it('서버 오류는 변환하지 않고 호출자에게 전달한다', async () => {
    const forbidden = new ApiError({
      code: 'NOT_GROUP_MANAGER',
      kind: 'server',
      message: 'forbidden',
      status: 403,
    });
    jest.spyOn(apiClient, 'patch').mockRejectedValueOnce(forbidden);

    await expect(
      processJoinRequest('group-1', {
        assignedRole: 'careReceiver',
        decision: 'APPROVE',
        joinRequestId: '34',
      }),
    ).rejects.toBe(forbidden);
  });
});
