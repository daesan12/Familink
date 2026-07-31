jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {
  createGroup,
  getGroupDetail,
  getInviteCode,
  loadGroups,
  renameGroup,
} from './groupApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: '성공', success: true},
    status,
  } as never;
}

describe('groupApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('그룹 목록과 가입 요청을 화면 모델로 변환한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        groups: [
          {
            id: 11,
            isManager: true,
            memberCount: 3,
            myMemberId: 21,
            myRole: 'CARE_RECEIVER',
            name: '우리 가족',
          },
        ],
        joinRequests: [
          {
            groupId: 12,
            groupName: '친척 모임',
            joinRequestId: 31,
            processedAt: null,
            requestedAt: '2026-07-31T01:02:03Z',
            status: 'PENDING_ADMIN',
          },
        ],
      }),
    );

    await expect(loadGroups()).resolves.toEqual({
      groups: [
        {
          id: '11',
          isManager: true,
          memberCount: 3,
          myMemberId: '21',
          name: '우리 가족',
          role: 'careReceiver',
        },
      ],
      joinRequests: [
        {
          groupId: '12',
          groupName: '친척 모임',
          joinRequestId: '31',
          processedAt: null,
          requestedAt: '2026-07-31T01:02:03Z',
          status: 'PENDING_ADMIN',
        },
      ],
    });
    expect(apiClient.get).toHaveBeenCalledWith('/groups');
  });

  it('processedAt 필드가 생략된 가입 요청도 null로 정규화한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        groups: [],
        joinRequests: [
          {
            groupId: 12,
            groupName: '가족 모임',
            joinRequestId: 31,
            requestedAt: '2026-07-31T01:02:03Z',
            status: 'PENDING_ADMIN',
          },
        ],
      }),
    );

    await expect(loadGroups()).resolves.toEqual({
      groups: [],
      joinRequests: [
        {
          groupId: '12',
          groupName: '가족 모임',
          joinRequestId: '31',
          processedAt: null,
          requestedAt: '2026-07-31T01:02:03Z',
          status: 'PENDING_ADMIN',
        },
      ],
    });
  });

  it('화면 역할을 서버 역할로 바꿔 그룹을 생성한다', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce(
      success(
        {
          createdAt: '2026-07-31T01:02:03Z',
          groupId: 41,
          inviteCode: 'A1B2C3',
          managerMemberId: 51,
        },
        201,
      ),
    );

    await expect(
      createGroup({name: '새 가족', role: 'careReceiver'}),
    ).resolves.toEqual({
      createdAt: '2026-07-31T01:02:03Z',
      group: {id: '41', name: '새 가족', role: 'careReceiver'},
      inviteCode: 'A1B2C3',
      managerMemberId: '51',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/groups', {
      myRole: 'CARE_RECEIVER',
      name: '새 가족',
    });
  });

  it('그룹 상세를 조회하고 nullable 관리자 ID를 보존한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        careReceiverCount: 1,
        guardianCount: 0,
        id: 61,
        isManager: false,
        managerMemberId: null,
        memberCount: 1,
        name: '한 사람 가족',
      }),
    );

    await expect(getGroupDetail('61')).resolves.toEqual({
      careReceiverCount: 1,
      guardianCount: 0,
      id: '61',
      isManager: false,
      managerMemberId: null,
      memberCount: 1,
      name: '한 사람 가족',
    });
    expect(apiClient.get).toHaveBeenCalledWith('/groups/61');
  });

  it('그룹명을 수정하고 서버가 확정한 이름과 시각을 반환한다', async () => {
    jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({
        id: 71,
        name: '바뀐 가족',
        updatedAt: '2026-07-31T02:03:04Z',
      }),
    );

    await expect(renameGroup('71', '바뀐 가족')).resolves.toEqual({
      id: '71',
      name: '바뀐 가족',
      updatedAt: '2026-07-31T02:03:04Z',
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/groups/71', {
      name: '바뀐 가족',
    });
  });

  it('초대 코드를 실제 그룹 경로에서 조회한다', async () => {
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce(success({inviteCode: 'ABC123'}));

    await expect(getInviteCode('81')).resolves.toEqual({
      inviteCode: 'ABC123',
    });
    expect(apiClient.get).toHaveBeenCalledWith('/groups/81/invite-code');
  });

  it.each([
    ['목록 역할', loadGroups, {groups: [{id: 1}], joinRequests: []}, 'get'],
    [
      '생성 초대 코드',
      () => createGroup({name: '가족', role: 'guardian'}),
      {
        createdAt: '2026-07-31T01:02:03Z',
        groupId: 1,
        inviteCode: 'SHORT',
        managerMemberId: 2,
      },
      'post',
    ],
    [
      '상세 인원 합계',
      () => getGroupDetail('1'),
      {
        careReceiverCount: 1,
        guardianCount: 1,
        id: 1,
        isManager: true,
        managerMemberId: 2,
        memberCount: 3,
        name: '가족',
      },
      'get',
    ],
    [
      '수정 시각',
      () => renameGroup('1', '가족'),
      {id: 1, name: '가족', updatedAt: 'not-a-date'},
      'patch',
    ],
    ['초대 코드', () => getInviteCode('1'), {inviteCode: '123'}, 'get'],
  ] as const)(
    '잘못된 %s 성공 payload를 거부한다',
    async (_label, request, data, method) => {
      jest.spyOn(apiClient, method).mockResolvedValueOnce(success(data));

      await expect(request()).rejects.toMatchObject<Partial<ApiError>>({
        code: 'INVALID_API_RESPONSE',
        kind: 'invalidResponse',
      });
    },
  );

  it('공통 API 오류를 기능별 코드로 바꾸지 않고 전달한다', async () => {
    const forbidden = new ApiError({
      code: 'FORBIDDEN',
      kind: 'server',
      message: '권한이 없습니다.',
      status: 403,
    });
    jest.spyOn(apiClient, 'get').mockRejectedValueOnce(forbidden);

    await expect(getInviteCode('81')).rejects.toBe(forbidden);
  });
});
