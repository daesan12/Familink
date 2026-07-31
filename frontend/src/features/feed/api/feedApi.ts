import type {ImageSourcePropType} from 'react-native';

import type {FeedImage, FeedPost} from '../types';
import {limitPostImages} from '../types';

const GYEONGJU_TEMPLE =
  require('../../../assets/images/feed-gyeongju-temple.png') as ImageSourcePropType;
const KOREAN_BARBECUE =
  require('../../../assets/images/feed-korean-barbecue.png') as ImageSourcePropType;
const GYEONGJU_BRIDGE =
  require('../../../assets/images/feed-gyeongju-bridge.png') as ImageSourcePropType;
const KOREAN_DESSERT =
  require('../../../assets/images/feed-korean-dessert.png') as ImageSourcePropType;

export const DEVELOPMENT_MEDIA_FIXTURE: readonly FeedImage[] = [
  {
    accessibilityLabel: '경주 불국사 다보탑과 전각 풍경',
    id: 'gyeongju-temple',
    source: GYEONGJU_TEMPLE,
  },
  {
    accessibilityLabel: '가족과 함께한 식사',
    id: 'family-barbecue',
    source: KOREAN_BARBECUE,
  },
  {
    accessibilityLabel: '야경 속 경주 월정교',
    id: 'gyeongju-bridge',
    source: GYEONGJU_BRIDGE,
  },
  {
    accessibilityLabel: '한식 디저트와 음료',
    id: 'korean-dessert',
    source: KOREAN_DESSERT,
  },
];

export const DEVELOPMENT_MEDIA_STATES = {
  fourImages: DEVELOPMENT_MEDIA_FIXTURE,
  oneImage: DEVELOPMENT_MEDIA_FIXTURE.slice(0, 1),
  twoImages: DEVELOPMENT_MEDIA_FIXTURE.slice(0, 2),
} as const;

const DEVELOPMENT_POSTS: readonly FeedPost[] = [
  {
    author: {avatarText: '유', id: 'member-yura', name: '유라'},
    body: '유라네 가족의 행복했던 경주여행 기록!',
    commentCount: 2,
    createdAt: '2026-07-30T11:30:00Z',
    groupId: 'development-guardian-group',
    id: 'post-gyeongju',
    images: limitPostImages(DEVELOPMENT_MEDIA_STATES.fourImages),
    isOwnedByCurrentUser: true,
    reactions: [
      {count: 2, emoji: '❤️', id: 'HEART', label: '사랑해요'},
      {count: 1, emoji: '😂', id: 'LAUGH', label: '웃겨요'},
    ],
  },
  {
    author: {avatarText: '대', id: 'member-daesan', name: '대산'},
    body: '할머니 사랑해요!! 내가 진짜 사랑해!!',
    commentCount: 3,
    createdAt: '2026-07-30T12:40:00Z',
    groupId: 'development-guardian-group',
    id: 'post-love',
    images: [],
    isOwnedByCurrentUser: false,
    reactions: [
      {count: 4, emoji: '👏', id: 'SUPPORT', label: '응원해요'},
    ],
  },
  {
    author: {avatarText: '종', id: 'member-jongcheol', name: '종철'},
    body: '어머니 손주 민수가 오늘 발표회에서 춤 춰서 영상 보여드리고 싶어서 올려봐요',
    commentCount: 0,
    createdAt: '2026-07-30T05:10:00Z',
    groupId: 'development-guardian-group',
    id: 'post-recital',
    images: [],
    isOwnedByCurrentUser: false,
    reactions: [],
  },
];

export type FeedLoader = (groupId: string) => Promise<readonly FeedPost[]>;

export function normalizeFeedPosts(
  posts: readonly FeedPost[],
): readonly FeedPost[] {
  return posts.map(post => {
    const images = limitPostImages(post.images);

    return images.length === post.images.length ? post : {...post, images};
  });
}

export async function loadFeed(
  groupId: string,
): Promise<readonly FeedPost[]> {
  await Promise.resolve();
  return normalizeFeedPosts(
    DEVELOPMENT_POSTS.filter(post => post.groupId === groupId),
  );
}
