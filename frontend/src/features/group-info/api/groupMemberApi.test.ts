jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {
  loadMemberProfile,
  loadMembers,
  updateMemberAlias,
  updateMemberRole,
} from './groupMemberApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

describe('groupMemberApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('구성원 목록의 서버 ID와 역할을 화면 모델로 변환한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        members: [
          {
            displayName: '아빠',
            isManager: true,
            memberId: 12,
            profileImageUrl: 'https://cdn.example.com/profile.jpg',
            role: 'GUARDIAN',
            userId: 34,
          },
        ],
      }),
    );

    await expect(loadMembers('group/1')).resolves.toEqual([
      {
        age: null,
        alias: null,
        avatarText: '아',
        gender: null,
        isManager: true,
        memberId: '12',
        name: '아빠',
        profileImageUrl: 'https://cdn.example.com/profile.jpg',
        role: 'guardian',
        userId: '34',
      },
    ]);
    expect(apiClient.get).toHaveBeenCalledWith('/groups/group%2F1/members');
  });

  it('축소 프로필의 nullable 나이·성별과 표시명을 보존한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        age: null,
        displayName: '보호자',
        gender: null,
        memberId: 12,
      }),
    );

    await expect(loadMemberProfile('group-1', '12')).resolves.toEqual({
      age: null,
      displayName: '보호자',
      gender: null,
      memberId: '12',
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/groups/group-1/members/12',
    );
  });

  it('관리자 역할 변경 요청은 서버 enum과 응답을 검증한다', async () => {
    jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({groupId: 1, memberId: 12, role: 'CARE_RECEIVER'}),
    );

    await expect(
      updateMemberRole('1', '12', 'careReceiver'),
    ).resolves.toEqual({
      groupId: '1',
      memberId: '12',
      role: 'careReceiver',
    });
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/groups/1/members/12/role',
      {role: 'CARE_RECEIVER'},
    );
  });

  it('호칭 변경은 공백을 제거한 응답을 반환한다', async () => {
    jest.spyOn(apiClient, 'put').mockResolvedValueOnce(
      success({alias: '  엄마  ', targetMemberId: 12}),
    );

    await expect(
      updateMemberAlias('group-1', '12', '엄마'),
    ).resolves.toEqual({alias: '엄마', targetMemberId: '12'});
    expect(apiClient.put).toHaveBeenCalledWith(
      '/groups/group-1/members/12/alias',
      {alias: '엄마'},
    );
  });

  it.each([
    ['목록', () => loadMembers('group-1'), {members: [{memberId: 1}]}],
    [
      '프로필',
      () => loadMemberProfile('group-1', '1'),
      {memberId: 1, displayName: '이름', age: '30', gender: 'MALE'},
    ],
    [
      '역할',
      () => updateMemberRole('group-1', '1', 'guardian'),
      {groupId: 1, memberId: 1, role: 'UNKNOWN'},
    ],
    [
      '호칭',
      () => updateMemberAlias('group-1', '1', '엄마'),
      {targetMemberId: 1, alias: ''},
    ],
  ] as const)('%s 응답이 계약과 다르면 INVALID_API_RESPONSE를 던진다', async (_label, request, data) => {
    const method = _label === '역할' ? 'patch' : _label === '호칭' ? 'put' : 'get';
    jest.spyOn(apiClient, method).mockResolvedValueOnce(success(data));

    await expect(request()).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it('서버 권한 오류는 원래 ApiError를 호출자에게 전달한다', async () => {
    const forbidden = new ApiError({
      code: 'FORBIDDEN',
      kind: 'server',
      message: 'forbidden',
      status: 403,
    });
    jest.spyOn(apiClient, 'patch').mockRejectedValueOnce(forbidden);

    await expect(
      updateMemberRole('group-1', '12', 'guardian'),
    ).rejects.toBe(forbidden);
  });

  it('성공 봉투라도 요청 대상과 다른 식별자는 거부한다', async () => {
    jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({groupId: 1, memberId: 99, role: 'GUARDIAN'}),
    );

    await expect(
      updateMemberRole('group-1', '12', 'guardian'),
    ).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });
});
