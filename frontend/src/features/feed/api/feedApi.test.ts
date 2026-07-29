import {normalizeFeedPosts} from './feedApi';
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
