jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import type {
  LocalMedia,
  PostSubmitPayload,
  RemoteMedia,
} from '../composer/postComposerModel';
import {
  deletePost,
  isPostUploadCancelled,
  submitPost,
  type PostUploadTransport,
} from './postApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

const remoteImage: RemoteMedia = {
  fileUrl: 'https://cdn.example.com/old.jpg',
  id: 'media-1',
  kind: 'image',
  source: {uri: 'https://cdn.example.com/old.jpg'},
  sourceType: 'remote',
};

const localImage: LocalMedia = {
  contentType: 'image/jpeg',
  fileName: 'new.jpg',
  fileSizeBytes: 4,
  id: 'local-1',
  kind: 'image',
  source: {uri: 'file://new.jpg'},
  sourceType: 'local',
};

const localVideo: LocalMedia = {
  contentType: 'video/mp4',
  durationSeconds: 30,
  fileName: 'large.mp4',
  id: 'local-video-1',
  kind: 'video',
  source: {uri: 'content://large.mp4'},
  sourceType: 'local',
};

function payload(
  overrides: Partial<PostSubmitPayload> = {},
): PostSubmitPayload {
  return {
    body: '새 게시글',
    deletedMediaIds: [],
    newMedia: [],
    retainedMedia: [],
    retainedMediaIds: [],
    ...overrides,
  };
}

function transport(
  put = jest.fn().mockResolvedValue(undefined),
): PostUploadTransport {
  return {put};
}

describe('postApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('presigned URL의 헤더를 그대로 사용해 업로드하고 생성 요청을 보낸다', async () => {
    const mediaWithStaleSize = {...localImage, fileSizeBytes: 999};
    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce(
        success(
          {
            uploads: [
              {
                expiresAt: '2026-08-01T00:00:00Z',
                fileUrl: 'https://cdn.example.com/new.jpg',
                headers: {
                  'Content-Length': '4',
                  'Content-Type': 'image/jpeg',
                  'x-amz-meta-token': 'signed',
                },
                uploadUrl: 'https://s3.example.com/upload',
              },
            ],
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        success(
          {
            uploads: [
              {
                expiresAt: '2026-08-01T00:00:00Z',
                fileUrl: 'https://cdn.example.com/new-thumbnail.jpg',
                headers: {
                  'Content-Length': '4',
                  'Content-Type': 'image/jpeg',
                },
                uploadUrl: 'https://s3.example.com/upload-thumbnail',
              },
            ],
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        success(
          {
            createdAt: '2026-08-01T00:01:00Z',
            posts: [{groupId: 11, postId: 91}],
          },
          201,
        ),
      );
    const progress: number[] = [];
    const put = jest.fn();
    const uploadTransport = transport(put);
    put.mockImplementation(async (_url, _file, config) => {
      config.onUploadProgress?.({loaded: 2, total: 4} as never);
    });

    await expect(
      submitPost(
        '11',
        payload({
          newMedia: [mediaWithStaleSize],
          orderedMedia: [mediaWithStaleSize],
        }),
        value => progress.push(value),
        undefined,
        {transport: uploadTransport},
      ),
    ).resolves.toEqual({
      createdAt: '2026-08-01T00:01:00Z',
      groupId: '11',
      postId: '91',
    });

    expect(postSpy.mock.calls[0]?.[0]).toBe('/files/presigned-urls');
    expect(postSpy.mock.calls[0]?.[1]).toEqual({
      files: [
        {
          contentType: 'image/jpeg',
          fileName: 'new.jpg',
          sizeBytes: 4,
        },
      ],
      purpose: 'post-media',
    });
    expect(put).toHaveBeenCalledWith(
      'https://s3.example.com/upload',
      {
        contentType: 'image/jpeg',
        fileName: 'new.jpg',
        sizeBytes: 4,
        uri: 'file://new.jpg',
      },
      expect.objectContaining({
        headers: {
          'Content-Length': '4',
          'Content-Type': 'image/jpeg',
          'x-amz-meta-token': 'signed',
        },
      }),
    );
    expect(postSpy.mock.calls[2]?.[1]).toEqual({
      content: '새 게시글',
      groupIds: [11],
      media: [
        {
          displayOrder: 0,
          fileUrl: 'https://cdn.example.com/new.jpg',
          thumbnailUrl: 'https://cdn.example.com/new-thumbnail.jpg',
        },
      ],
      mediaType: 'IMAGE',
    });
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('수정 요청은 기존 미디어와 새 미디어의 화면 순서를 유지한다', async () => {
    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce(
        success(
          {
            uploads: [
              {
                expiresAt: '2026-08-01T00:00:00Z',
                fileUrl: 'https://cdn.example.com/new.jpg',
                headers: {},
                uploadUrl: 'https://s3.example.com/upload',
              },
            ],
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        success(
          {
            uploads: [
              {
                expiresAt: '2026-08-01T00:00:00Z',
                fileUrl: 'https://cdn.example.com/new-thumbnail.jpg',
                headers: {},
                uploadUrl: 'https://s3.example.com/upload-thumbnail',
              },
            ],
          },
          201,
        ),
      );
    const patchSpy = jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({id: 91, updatedAt: '2026-08-01T00:02:00Z'}),
    );

    await expect(
      submitPost(
        '11',
        payload({
          newMedia: [localImage],
          orderedMedia: [remoteImage, localImage],
          postId: '91',
          retainedMedia: [remoteImage],
          retainedMediaIds: [remoteImage.id],
        }),
        undefined,
        undefined,
        {transport: transport()},
      ),
    ).resolves.toEqual({id: '91', updatedAt: '2026-08-01T00:02:00Z'});

    expect(patchSpy).toHaveBeenCalledWith(
      '/posts/91',
      {
        content: '새 게시글',
        media: [
          {displayOrder: 0, fileUrl: remoteImage.fileUrl},
          {
            displayOrder: 1,
            fileUrl: 'https://cdn.example.com/new.jpg',
            thumbnailUrl: 'https://cdn.example.com/new-thumbnail.jpg',
          },
        ],
        mediaType: 'IMAGE',
      },
      expect.objectContaining({signal: undefined}),
    );
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('텍스트 게시글은 mediaType 없이 빈 미디어 배열로 생성한다', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(
      success(
        {
          createdAt: '2026-08-01T00:01:00Z',
          posts: [{groupId: 11, postId: 92}],
        },
        201,
      ),
    );

    await submitPost('11', payload());

    expect(postSpy).toHaveBeenCalledWith(
      '/posts',
      {content: '새 게시글', groupIds: [11], media: []},
      expect.objectContaining({signal: undefined}),
    );
  });

  it('미디어 파일명이나 MIME 정보가 없으면 업로드하지 않고 명시적 오류를 반환한다', async () => {
    const postSpy = jest.spyOn(apiClient, 'post');

    await expect(
      submitPost(
        '11',
        payload({
          newMedia: [{...localImage, fileName: undefined}],
          orderedMedia: [{...localImage, fileName: undefined}],
        }),
        undefined,
        undefined,
        {
          mediaProcessor: {
            preparePostOriginal: jest.fn().mockResolvedValue({
              contentType: 'image/jpeg',
              fileName: '',
              uri: 'file://new.jpg',
            }),
            preparePostThumbnail: jest.fn().mockResolvedValue({
              contentType: 'image/jpeg',
              fileName: 'new-thumbnail.jpg',
              uri: 'file://new.jpg',
            }),
            prepareProfileImage: jest.fn(),
          },
          transport: transport(),
        },
      ),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('처리된 파일 크기가 0이면 presigned URL을 요청하지 않는다', async () => {
    const postSpy = jest.spyOn(apiClient, 'post');

    await expect(
      submitPost(
        '11',
        payload({newMedia: [localImage], orderedMedia: [localImage]}),
        undefined,
        undefined,
        {
          mediaProcessor: {
            preparePostOriginal: jest.fn().mockResolvedValue({
              contentType: 'image/jpeg',
              fileName: 'new.jpg',
              sizeBytes: 0,
              uri: 'file://new.jpg',
            }),
            preparePostThumbnail: jest.fn(),
            prepareProfileImage: jest.fn(),
          },
          transport: transport(),
        },
      ),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('100MiB 초과 영상은 Blob을 읽거나 썸네일을 만들기 전에 거부한다', async () => {
    const postSpy = jest.spyOn(apiClient, 'post');
    const uploadTransport = transport();
    const preparePostThumbnail = jest.fn();

    await expect(
      submitPost(
        '11',
        payload({newMedia: [localVideo], orderedMedia: [localVideo]}),
        undefined,
        undefined,
        {
          mediaProcessor: {
            preparePostOriginal: jest.fn().mockResolvedValue({
              contentType: 'video/mp4',
              fileName: 'large.mp4',
              sizeBytes: 100 * 1024 * 1024 + 1,
              uri: 'content://large.mp4',
            }),
            preparePostThumbnail,
            prepareProfileImage: jest.fn(),
          },
          transport: uploadTransport,
        },
      ),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});

    expect(preparePostThumbnail).not.toHaveBeenCalled();
    expect(uploadTransport.put).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('S3가 XML 오류를 반환해도 미디어 업로드 오류로 정규화한다', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce(
      success(
        {
          uploads: [
            {
              expiresAt: '2026-08-01T00:00:00Z',
              fileUrl: 'https://cdn.example.com/new.jpg',
              headers: {
                'Content-Length': '4',
                'Content-Type': 'image/jpeg',
              },
              uploadUrl: 'https://s3.example.com/upload',
            },
          ],
        },
        201,
      ),
    );
    const put = jest.fn().mockRejectedValue({
      isAxiosError: true,
      response: {data: '<Error><Code>AccessDenied</Code></Error>', status: 403},
    });

    await expect(
      submitPost(
        '11',
        payload({newMedia: [localImage], orderedMedia: [localImage]}),
        undefined,
        undefined,
        {transport: transport(put)},
      ),
    ).rejects.toMatchObject<Partial<ApiError>>({
      code: 'MEDIA_UPLOAD_FAILED',
      message: '미디어 업로드에 실패했습니다. 다시 시도해 주세요.',
      status: 403,
    });
  });

  it('취소된 업로드는 UPLOAD_CANCELLED로 식별할 수 있다', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      submitPost('11', payload(), undefined, controller.signal),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'UPLOAD_CANCELLED'});
    expect(isPostUploadCancelled(new ApiError({
      code: 'UPLOAD_CANCELLED',
      kind: 'network',
      message: 'cancelled',
    }))).toBe(true);
  });

  it('INVALID_REQUEST의 필드 오류를 사용자에게 보여 줄 메시지로 유지한다', async () => {
    jest.spyOn(apiClient, 'post').mockRejectedValueOnce(
      new ApiError({
        code: 'INVALID_REQUEST',
        errors: [
          {field: 'media.fileUrl', message: '사진은 파일당 10MB 이하만 올릴 수 있습니다.'},
          {field: 'media.fileUrl', message: '사진은 파일당 10MB 이하만 올릴 수 있습니다.'},
        ],
        kind: 'server',
        message: '요청 형식 또는 검증 실패',
        status: 400,
      }),
    );

    const error = await submitPost('11', payload()).catch(reason => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});
    expect(error.message).toBe('사진은 파일당 10MB 이하만 올릴 수 있습니다.');
  });

  it('삭제 API는 204 응답만 성공으로 처리한다', async () => {
    const deleteSpy = jest
      .spyOn(apiClient, 'delete')
      .mockResolvedValueOnce({status: 204} as never);

    await expect(deletePost('91')).resolves.toBeUndefined();
    expect(deleteSpy).toHaveBeenCalledWith('/posts/91');

    deleteSpy.mockResolvedValueOnce({status: 200} as never);
    await expect(deletePost('91')).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
    });
  });
});
