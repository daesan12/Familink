import {ApiError} from '../../../shared/api';
import {
  createProfileGateway,
  getProfileWithdrawErrorMessage,
  type ProfileHttpClient,
} from './profileApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

function createClient(): jest.Mocked<ProfileHttpClient> {
  return {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
  } as unknown as jest.Mocked<ProfileHttpClient>;
}

describe('profileApi', () => {
  it('관리자 위임이 필요한 탈퇴 오류를 사용자 안내로 변환한다', () => {
    const error = new ApiError({
      code: 'MANAGER_TRANSFER_REQUIRED',
      kind: 'server',
      message: 'manager transfer required',
      status: 409,
    });

    expect(getProfileWithdrawErrorMessage(error)).toContain('그룹 관리자');
  });

  it('본인 프로필 조회 응답을 화면 모델에 맞게 변환한다', async () => {
    const client = createClient();
    client.get.mockResolvedValueOnce(
      success({
        birthDate: '1995-03-17',
        gender: 'MALE',
        loginId: 'testuser',
        name: '홍길동',
        profileImageUrl: null,
      }),
    );
    const gateway = createProfileGateway({client});

    await expect(gateway.loadCurrentProfile()).resolves.toEqual({
      birthDate: '1995-03-17',
      gender: 'male',
      loginId: 'testuser',
      name: '홍길동',
      profileImageUrl: null,
    });
    expect(client.get).toHaveBeenCalledWith('/users/me');
  });

  it('프로필 수정 필드를 그대로 PATCH 계약에 전달한다', async () => {
    const client = createClient();
    client.patch.mockResolvedValueOnce(
      success({
        id: 12,
        name: '새 이름',
        updatedAt: '2026-07-31T01:02:03Z',
      }),
    );
    const gateway = createProfileGateway({client});

    await expect(
      gateway.updateCurrentProfile({
        birthDate: '1995-03-17',
        gender: 'FEMALE',
        name: '새 이름',
        profileImageUrl: null,
      }),
    ).resolves.toEqual({
      id: '12',
      name: '새 이름',
      updatedAt: '2026-07-31T01:02:03Z',
    });
    expect(client.patch).toHaveBeenCalledWith('/users/me', {
      birthDate: '1995-03-17',
      gender: 'FEMALE',
      name: '새 이름',
      profileImageUrl: null,
    });
  });

  it('회원 탈퇴는 204 응답만 성공으로 처리한다', async () => {
    const client = createClient();
    client.delete.mockResolvedValueOnce({status: 204} as never);
    const gateway = createProfileGateway({client});

    await expect(gateway.withdrawCurrentUser()).resolves.toBeUndefined();
    expect(client.delete).toHaveBeenCalledWith('/users/me');
  });

  it('필수 프로필 필드가 빠진 응답은 거부한다', async () => {
    const client = createClient();
    client.get.mockResolvedValueOnce(
      success({
        birthDate: '1995-03-17',
        gender: 'MALE',
        loginId: 'testuser',
        profileImageUrl: null,
      }),
    );
    const gateway = createProfileGateway({client});

    await expect(gateway.loadCurrentProfile()).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });
});
