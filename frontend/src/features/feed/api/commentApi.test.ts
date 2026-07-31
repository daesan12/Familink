jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {
  createComment,
  deleteComment,
  loadComments,
  updateComment,
} from './commentApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

describe('commentApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('댓글 목록 페이지와 수정 시각을 화면 모델로 변환한다', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        content: [
          {
            author: {displayName: 'Yura', memberId: 21},
            content: '첫 댓글',
            createdAt: '2026-08-01T00:00:00Z',
            id: 11,
            updatedAt: '2026-08-01T00:01:00Z',
          },
        ],
        hasNext: true,
      }),
    );

    await expect(loadComments('91', 2, 10)).resolves.toEqual({
      comments: [
        {
          author: {avatarText: 'Yu', id: '21', name: 'Yura'},
          body: '첫 댓글',
          createdAt: '2026-08-01T00:00:00Z',
          id: '11',
          postId: '91',
          updatedAt: '2026-08-01T00:01:00Z',
        },
      ],
      hasNext: true,
    });
    expect(getSpy).toHaveBeenCalledWith(
      '/posts/91/comments?page=2&size=10',
    );
  });

  it('댓글 생성·수정·삭제가 상태 코드와 요청 본문을 검증한다', async () => {
    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce(
        success(
          {
            content: '새 댓글',
            createdAt: '2026-08-01T00:00:00Z',
            id: 12,
            postId: 91,
          },
          201,
        ),
      );
    const patchSpy = jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({
        content: '수정 댓글',
        id: 12,
        updatedAt: '2026-08-01T00:02:00Z',
      }),
    );
    const deleteSpy = jest
      .spyOn(apiClient, 'delete')
      .mockResolvedValueOnce({status: 204} as never);

    await expect(createComment('91', '  새 댓글  ')).resolves.toEqual({
      content: '새 댓글',
      createdAt: '2026-08-01T00:00:00Z',
      id: '12',
      postId: '91',
    });
    await expect(updateComment('12', ' 수정 댓글 ')).resolves.toEqual({
      content: '수정 댓글',
      id: '12',
      updatedAt: '2026-08-01T00:02:00Z',
    });
    await expect(deleteComment('12')).resolves.toBeUndefined();

    expect(postSpy).toHaveBeenCalledWith('/posts/91/comments', {
      content: '새 댓글',
    });
    expect(patchSpy).toHaveBeenCalledWith('/comments/12', {
      content: '수정 댓글',
    });
    expect(deleteSpy).toHaveBeenCalledWith('/comments/12');
  });

  it('잘못된 입력과 불완전한 응답을 거부한다', async () => {
    const getSpy = jest.spyOn(apiClient, 'get');
    await expect(loadComments('91', -1, 20)).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_REQUEST'});
    await expect(createComment('91', ' ')).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_REQUEST'});
    expect(getSpy).not.toHaveBeenCalled();

    getSpy.mockResolvedValueOnce(
      success({content: [{id: 1}], hasNext: false}),
    );
    await expect(loadComments('91')).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
    });
  });
});
