import {ApiError} from '../../../shared/api';
import {
  createProfileGateway,
  getProfileWithdrawErrorMessage,
  type ProfileHttpClient,
  type ProfileUploadTransport,
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
    post: jest.fn(),
  } as unknown as jest.Mocked<ProfileHttpClient>;
}

function createUploadTransport(): jest.Mocked<ProfileUploadTransport> {
  return {
    put: jest.fn(),
    readFile: jest.fn(),
  };
}

describe('profileApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('presigned 응답 헤더를 그대로 사용해 프로필 이미지를 업로드한다', async () => {
    const client = createClient();
    const uploadTransport = createUploadTransport();
    const blob = {size: 2048} as Blob;
    client.post.mockResolvedValueOnce(
      success(
        {
          uploads: [
            {
              expiresAt: '2026-08-01T08:10:00Z',
              fileUrl:
                'https://cdn.example.com/profile-image/profile-photo.jpg',
              headers: {
                'Content-Length': '2048',
                'Content-Type': 'image/jpeg',
                'x-amz-meta-token': 'signed',
              },
              uploadUrl: 'https://s3.example.com/signed-upload',
            },
          ],
        },
        201,
      ),
    );
    uploadTransport.readFile.mockResolvedValueOnce(blob);
    uploadTransport.put.mockResolvedValueOnce();
    const gateway = createProfileGateway({client, uploadTransport});

    await expect(
      gateway.uploadProfileImage({
        contentType: 'image/jpeg',
        fileName: 'profile-photo.jpg',
        sizeBytes: 1024,
        uri: 'content://profile-photo',
      }),
    ).resolves.toBe(
      'https://cdn.example.com/profile-image/profile-photo.jpg',
    );
    expect(client.post).toHaveBeenCalledWith('/files/presigned-urls', {
      files: [
        {
          contentType: 'image/jpeg',
          fileName: 'profile-photo.jpg',
          sizeBytes: 2048,
        },
      ],
      purpose: 'profile-image',
    });
    expect(uploadTransport.readFile).toHaveBeenCalledWith(
      'content://profile-photo',
    );
    expect(uploadTransport.put).toHaveBeenCalledWith(
      'https://s3.example.com/signed-upload',
      blob,
      {
        headers: {
          'Content-Length': '2048',
          'Content-Type': 'image/jpeg',
          'x-amz-meta-token': 'signed',
        },
      },
    );
  });

  it('presigned 응답이 단일 업로드와 Content-Type을 제공하지 않으면 거부한다', async () => {
    const client = createClient();
    const uploadTransport = createUploadTransport();
    client.post.mockResolvedValueOnce(
      success(
        {
          uploads: [
            {
              expiresAt: '2026-08-01T08:10:00Z',
              fileUrl:
                'https://cdn.example.com/profile-image/profile-photo.jpg',
              headers: {'x-amz-meta-token': 'signed'},
              uploadUrl: 'https://s3.example.com/signed-upload',
            },
          ],
        },
        201,
      ),
    );
    uploadTransport.readFile.mockResolvedValueOnce({size: 1024} as Blob);
    const gateway = createProfileGateway({client, uploadTransport});

    await expect(
      gateway.uploadProfileImage({
        contentType: 'image/jpeg',
        fileName: 'profile-photo.jpg',
        sizeBytes: 1024,
        uri: 'content://profile-photo',
      }),
    ).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
    expect(uploadTransport.readFile).toHaveBeenCalledWith(
      'content://profile-photo',
    );
    expect(uploadTransport.put).not.toHaveBeenCalled();
  });

  it('허용되지 않은 프로필 이미지는 presigned 요청 전에 거부한다', async () => {
    const client = createClient();
    const gateway = createProfileGateway({client});

    await expect(
      gateway.uploadProfileImage({
        contentType: 'image/gif',
        fileName: 'profile.gif',
        sizeBytes: 1024,
        uri: 'content://profile-photo',
      }),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});
    expect(client.post).not.toHaveBeenCalled();
  });

  it('로컬 파일을 읽지 못하면 S3 업로드를 실행하지 않고 실패한다', async () => {
    const client = createClient();
    const uploadTransport = createUploadTransport();
    uploadTransport.readFile.mockRejectedValueOnce(new Error('read failed'));
    const gateway = createProfileGateway({client, uploadTransport});

    await expect(gateway.uploadProfileImage(validProfileAsset())).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'MEDIA_READ_FAILED'});
    expect(client.post).not.toHaveBeenCalled();
    expect(uploadTransport.put).not.toHaveBeenCalled();
  });

  it('S3 PUT이 실패하면 fileUrl을 반환하지 않는다', async () => {
    const client = createClient();
    const uploadTransport = createUploadTransport();
    client.post.mockResolvedValueOnce(profileImagePresignResponse());
    uploadTransport.readFile.mockResolvedValueOnce({size: 1024} as Blob);
    uploadTransport.put.mockRejectedValueOnce({
      isAxiosError: true,
      response: {data: '<Error><Code>AccessDenied</Code></Error>', status: 403},
    });
    const gateway = createProfileGateway({client, uploadTransport});

    await expect(gateway.uploadProfileImage(validProfileAsset())).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'MEDIA_UPLOAD_FAILED', status: 403});
    expect(uploadTransport.put).toHaveBeenCalledTimes(1);
  });

  it('실제 Blob이 비어 있으면 presigned URL을 요청하지 않는다', async () => {
    const client = createClient();
    const uploadTransport = createUploadTransport();
    uploadTransport.readFile.mockResolvedValueOnce({size: 0} as Blob);
    const gateway = createProfileGateway({client, uploadTransport});

    await expect(gateway.uploadProfileImage(validProfileAsset())).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_REQUEST'});
    expect(client.post).not.toHaveBeenCalled();
    expect(uploadTransport.put).not.toHaveBeenCalled();
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

function validProfileAsset() {
  return {
    contentType: 'image/jpeg',
    fileName: 'profile-photo.jpg',
    sizeBytes: 1024,
    uri: 'content://profile-photo',
  } as const;
}

function profileImagePresignResponse() {
  return success(
    {
      uploads: [
        {
          expiresAt: '2026-08-01T08:10:00Z',
          fileUrl: 'https://cdn.example.com/profile-image/profile-photo.jpg',
          headers: {'Content-Type': 'image/jpeg'},
          uploadUrl: 'https://s3.example.com/signed-upload',
        },
      ],
    },
    201,
  );
}
