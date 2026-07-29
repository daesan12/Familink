import {DEVELOPMENT_MEDIA_STATES, normalizeFeedPosts} from './feedApi';
import type {FeedImage, FeedPost} from '../types';

function createImage(index: number): FeedImage {
  return {
    accessibilityLabel: `${index}번째 이미지`,
    id: `image-${index}`,
    source: index,
  };
}

test('API 경계에서 게시물 이미지를 최대 4장으로 제한한다', () => {
  const post: FeedPost = {
    author: {
      avatarText: '유',
      id: 'member-yura',
      name: '유라',
    },
    body: '가족 여행 기록',
    commentCount: 0,
    createdAtLabel: '방금 전',
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

test('개발 fixture가 같은 순서로 사진 1장, 2장, 4장 상태를 제공한다', () => {
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
