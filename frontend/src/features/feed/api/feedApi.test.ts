jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {
  DEVELOPMENT_MEDIA_STATES,
  loadFeedPage,
  loadPostDetail,
  normalizeFeedPosts,
} from './feedApi';
import type {FeedImage, FeedPost} from '../types';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

function createImage(index: number): FeedImage {
  return {
    accessibilityLabel: `${index}번째 이미지`,
    id: `image-${index}`,
    source: index,
  };
}

test('API 경계에서 게시글 이미지를 최대 4장으로 제한한다', () => {
  const post: FeedPost = {
    author: {avatarText: '홍', id: 'member-yura', name: '홍유라'},
    body: '가족 여행 기록',
    commentCount: 0,
    createdAt: '2026-07-30T12:00:00Z',
    groupId: 'family-group',
    id: 'post-1',
    images: Array.from({length: 6}, (_, index) => createImage(index + 1)),
    isOwnedByCurrentUser: true,
    reactions: [],
  };

  const [result] = normalizeFeedPosts([post]);

  expect(result.images.map(image => image.id)).toEqual([
    'image-1',
    'image-2',
    'image-3',
    'image-4',
  ]);
});

test('개발 fixture가 1·2·4장 미디어 상태를 제공한다', () => {
  expect(DEVELOPMENT_MEDIA_STATES.oneImage.map(image => image.id)).toEqual([
    'gyeongju-temple',
  ]);
  expect(DEVELOPMENT_MEDIA_STATES.twoImages.map(image => image.id)).toEqual([
    'gyeongju-temple',
    'family-barbecue',
  ]);
  expect(DEVELOPMENT_MEDIA_STATES.fourImages.map(image => image.id)).toEqual([
    'gyeongju-temple',
    'family-barbecue',
    'gyeongju-bridge',
    'korean-dessert',
  ]);
});

describe('family feed API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('목록 API를 페이지 계약과 화면 모델로 변환한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        content: [
          {
            author: {
              displayName: '홍유라',
              memberId: 21,
              profileImageUrl: null,
              role: 'GUARDIAN',
              userId: 31,
            },
            commentCount: 2,
            content: '가족 소식',
            createdAt: '2026-07-31T01:02:03Z',
            id: 11,
            media: [
              {
                displayOrder: 1,
                fileUrl: 'https://cdn/image-2.jpg',
                id: 102,
                thumbnailUrl: null,
                type: 'IMAGE',
              },
              {
                displayOrder: 0,
                fileUrl: 'https://cdn/image-1.jpg',
                id: 101,
                thumbnailUrl: 'https://cdn/thumb-1.jpg',
                type: 'IMAGE',
              },
            ],
            myReaction: 'HEART',
            reactionCounts: {HEART: 3, SUPPORT: 1},
          },
        ],
        hasNext: true,
      }),
    );

    await expect(loadFeedPage('group/1', 2, 10, '21')).resolves.toEqual({
      hasNext: true,
      posts: [
        expect.objectContaining({
          author: {avatarText: '홍유', id: '21', name: '홍유라'},
          currentUserReactionId: 'HEART',
          groupId: 'group/1',
          id: '11',
          images: [
            expect.objectContaining({
              id: '101',
              source: {uri: 'https://cdn/thumb-1.jpg'},
            }),
            expect.objectContaining({
              id: '102',
              source: {uri: 'https://cdn/image-2.jpg'},
            }),
          ],
          isOwnedByCurrentUser: true,
          reactions: expect.arrayContaining([
            expect.objectContaining({count: 3, id: 'HEART'}),
            expect.objectContaining({count: 1, id: 'SUPPORT'}),
          ]),
        }),
      ],
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/groups/group%2F1/posts?page=2&size=10',
    );
  });

  it('상세 API는 groupId와 반응 수를 게시글 모델에 연결한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        author: {
          displayName: '강다영',
          memberId: 22,
          profileImageUrl: null,
          role: 'CARE_RECEIVER',
          userId: 32,
        },
        commentCount: 0,
        content: '상세 내용',
        createdAt: '2026-07-31T01:02:03Z',
        groupId: 12,
        id: 13,
        media: [
          {
            displayOrder: 0,
            fileUrl: 'https://cdn/video.mp4',
            id: 201,
            thumbnailUrl: null,
            type: 'VIDEO',
          },
        ],
        reactions: {SURPRISE: 2},
        updatedAt: '2026-07-31T01:03:03Z',
      }),
    );

    await expect(loadPostDetail('13', '21')).resolves.toEqual(
      expect.objectContaining({
        author: {avatarText: '강다', id: '22', name: '강다영'},
        body: '상세 내용',
        groupId: '12',
        id: '13',
        isOwnedByCurrentUser: false,
        images: [
          expect.objectContaining({
            hasPoster: false,
            mediaType: 'VIDEO',
          }),
        ],
        reactions: expect.arrayContaining([
          expect.objectContaining({count: 2, id: 'SURPRISE'}),
        ]),
      }),
    );
    expect(apiClient.get).toHaveBeenCalledWith('/posts/13');
  });

  it('상세 API 응답의 groupId가 현재 그룹과 다르면 거부한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        author: {displayName: '홍유라', memberId: 21},
        commentCount: 0,
        content: '다른 그룹 글',
        createdAt: '2026-07-31T01:02:03Z',
        groupId: 99,
        id: 13,
        media: [],
        reactions: {},
        updatedAt: '2026-07-31T01:03:03Z',
      }),
    );

    await expect(loadPostDetail('13', '21', '12')).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_API_RESPONSE'});
  });

  it('상세 API 응답의 게시글 ID가 요청과 다르면 거부한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({
        author: {displayName: '홍유라', memberId: 21},
        commentCount: 0,
        content: '다른 글',
        createdAt: '2026-07-31T01:02:03Z',
        groupId: 12,
        id: 99,
        media: [],
        reactions: {},
        updatedAt: '2026-07-31T01:03:03Z',
      }),
    );

    await expect(loadPostDetail('13')).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
    });
  });

  it('목록 봉투가 깨지면 공통 invalid response 오류를 반환한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({content: [{id: 1}], hasNext: false}),
    );

    await expect(loadFeedPage('11')).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it('페이지 범위를 벗어나면 API를 호출하지 않는다', async () => {
    const getSpy = jest.spyOn(apiClient, 'get');

    await expect(loadFeedPage('11', -1, 20)).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_REQUEST'});
    await expect(loadFeedPage('11', 0, 101)).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_REQUEST'});

    expect(getSpy).not.toHaveBeenCalled();
  });
});
