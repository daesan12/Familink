jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {changePostReaction} from './reactionApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

describe('reactionApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('반응 변경 결과의 선택 상태와 전체 집계를 변환한다', async () => {
    const putSpy = jest.spyOn(apiClient, 'put').mockResolvedValueOnce(
      success({
        counts: {HEART: 2, SUPPORT: 1},
        postId: 91,
        reactionType: 'HEART',
      }),
    );

    await expect(changePostReaction('91', 'HEART')).resolves.toEqual({
      postId: '91',
      reactionType: 'HEART',
      reactions: expect.arrayContaining([
        expect.objectContaining({count: 2, id: 'HEART'}),
        expect.objectContaining({count: 1, id: 'SUPPORT'}),
        expect.objectContaining({count: 0, id: 'LAUGH'}),
      ]),
    });
    expect(putSpy).toHaveBeenCalledWith('/posts/91/reaction', {
      reactionType: 'HEART',
    });
  });

  it('같은 반응을 다시 선택한 해제 응답의 null을 보존한다', async () => {
    jest.spyOn(apiClient, 'put').mockResolvedValueOnce(
      success({counts: {}, postId: 91, reactionType: null}),
    );

    await expect(changePostReaction('91', 'HEART')).resolves.toMatchObject({
      postId: '91',
      reactionType: null,
      reactions: expect.any(Array),
    });
  });

  it('반응 식별자와 집계 응답이 잘못되면 실패한다', async () => {
    const putSpy = jest.spyOn(apiClient, 'put');
    await expect(
      changePostReaction('post-1', 'HEART'),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});
    expect(putSpy).not.toHaveBeenCalled();

    putSpy.mockResolvedValueOnce(
      success({counts: {HEART: -1}, postId: 91, reactionType: 'HEART'}),
    );
    await expect(changePostReaction('91', 'HEART')).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_API_RESPONSE'});
  });
});
