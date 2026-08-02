jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {loadArchive} from './archiveApi';

function success(data: unknown) {
  return {
    data: {data, message: 'ok', success: true},
    status: 200,
  } as never;
}

describe('archiveApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('보관함 날짜 그룹과 미디어 종류를 화면 모델로 변환한다', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        dates: [
          {
            date: '2026-08-01',
            items: [
              {
                contentPreview: '가족 사진',
                postId: 91,
                thumbnailUrl: 'https://cdn.example/thumb.jpg',
                type: 'IMAGE',
              },
              {
                contentPreview: '오늘도 사랑해요',
                postId: 92,
                thumbnailUrl: null,
                type: 'TEXT',
              },
            ],
          },
        ],
      }),
    );

    await expect(
      loadArchive('7', {date: '2026-08-01', memberId: '12'}),
    ).resolves.toEqual([
      expect.objectContaining({
        dateKey: '2026-08-01',
        groupId: '7',
        id: '7-91',
        mediaKind: 'image',
        memberId: '12',
        postId: '91',
        thumbnail: {uri: 'https://cdn.example/thumb.jpg'},
      }),
      expect.objectContaining({
        dateKey: '2026-08-01',
        groupId: '7',
        id: '7-92',
        mediaKind: 'text',
        memberId: '12',
        postId: '92',
        text: '오늘도 사랑해요',
      }),
    ]);
    expect(getSpy).toHaveBeenCalledWith(
      '/groups/7/archive?date=2026-08-01&memberId=12',
    );
  });

  it('전체 조회 결과의 작성자 미지 식별자를 null로 둔다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        dates: [
          {
            date: '2026-08-01',
            items: [
              {
                contentPreview: '영상',
                postId: '91',
                thumbnailUrl: null,
                type: 'VIDEO',
              },
            ],
          },
        ],
      }),
    );

    await expect(loadArchive('7')).resolves.toEqual([
      expect.objectContaining({memberId: null, mediaKind: 'video'}),
    ]);
  });

  it('잘못된 입력과 응답을 거부한다', async () => {
    const getSpy = jest.spyOn(apiClient, 'get');
    await expect(loadArchive('group-1')).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_REQUEST',
    });
    await expect(
      loadArchive('7', {date: '2026-02-30'}),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});
    expect(getSpy).not.toHaveBeenCalled();

    getSpy.mockResolvedValueOnce(
      success({dates: [{date: '2026-08-01', items: [{postId: 91}]}]}),
    );
    await expect(loadArchive('7')).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
    });
  });
});
