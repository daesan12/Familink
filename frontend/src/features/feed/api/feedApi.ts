import type {ImageSourcePropType} from 'react-native';

import {ApiError, apiClient, type ApiSuccess} from '../../../shared/api';
import {parseApiEnvelope} from '../../group-info/api/groupApi';
import {REACTION_OPTIONS} from '../interactions/postInteractions';
import type {
  FeedImage,
  FeedMediaType,
  FeedPost,
  ReactionId,
} from '../types';
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

export const FEED_PAGE_SIZE = 20;

export interface FeedPage {
  hasNext: boolean;
  posts: readonly FeedPost[];
}

export type FeedPageLoader = (
  groupId: string,
  page: number,
  size: number,
  currentMemberId?: string,
) => Promise<FeedPage>;

export type PostDetailLoader = (
  postId: string,
  currentMemberId?: string,
  expectedGroupId?: string,
) => Promise<FeedPost>;

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

export async function loadFeedPage(
  groupId: string,
  page = 0,
  size = FEED_PAGE_SIZE,
  currentMemberId?: string,
): Promise<FeedPage> {
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100
  ) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'invalidResponse',
      message: '페이지 요청 범위가 올바르지 않아요.',
    });
  }

  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/posts?page=${page}&size=${size}`,
  );

  return parseApiEnvelope(
    response.data,
    response.status,
    value => parseFeedPage(value, groupId, currentMemberId),
  );
}

export async function loadPostDetail(
  postId: string,
  currentMemberId?: string,
  expectedGroupId?: string,
): Promise<FeedPost> {
  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/posts/${encodeURIComponent(postId)}`,
  );

  return parseApiEnvelope(
    response.data,
    response.status,
    value => parsePostDetail(value, currentMemberId, postId, expectedGroupId),
  );
}

function parseFeedPage(
  value: unknown,
  groupId: string,
  currentMemberId?: string,
): FeedPage | null {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return null;
  }
  if (typeof value.hasNext !== 'boolean') {
    return null;
  }

  const posts = value.content.map(item =>
    parsePostListItem(item, groupId, currentMemberId),
  );
  if (!posts.every(isNotNull)) {
    return null;
  }

  return {hasNext: value.hasNext, posts};
}

function parsePostListItem(
  value: unknown,
  groupId: string,
  currentMemberId?: string,
): FeedPost | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseId(value.id);
  const author = parseAuthor(value.author);
  const media = parseMedia(value.media);
  const reactionCounts = parseReactionCounts(value.reactionCounts);
  const myReaction = parseReactionId(value.myReaction, true);
  const commentCount = parseNonNegativeInteger(value.commentCount);
  const createdAt = parseNonEmptyString(value.createdAt);

  if (
    id === null ||
    author === null ||
    typeof value.content !== 'string' ||
    media === null ||
    reactionCounts === null ||
    myReaction === INVALID_REACTION ||
    commentCount === null ||
    createdAt === null
  ) {
    return null;
  }

  return toFeedPost({
    author,
    body: value.content,
    commentCount,
    createdAt,
    currentMemberId,
    groupId,
    id,
    media,
    reactionCounts,
    currentUserReactionId: myReaction,
  });
}

function parsePostDetail(
  value: unknown,
  currentMemberId?: string,
  expectedPostId?: string,
  expectedGroupId?: string,
): FeedPost | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseId(value.id);
  const groupId = parseId(value.groupId);
  const author = parseAuthor(value.author);
  const media = parseMedia(value.media);
  const reactionCounts = parseReactionCounts(value.reactions);
  const commentCount = parseNonNegativeInteger(value.commentCount);
  const createdAt = parseNonEmptyString(value.createdAt);
  const updatedAt = parseNonEmptyString(value.updatedAt);

  if (
    id === null ||
    (expectedPostId !== undefined && id !== expectedPostId) ||
    groupId === null ||
    (expectedGroupId !== undefined && groupId !== expectedGroupId) ||
    author === null ||
    typeof value.content !== 'string' ||
    media === null ||
    reactionCounts === null ||
    commentCount === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return toFeedPost({
    author,
    body: value.content,
    commentCount,
    createdAt,
    currentMemberId,
    groupId,
    id,
    media,
    reactionCounts,
    currentUserReactionId: null,
  });
}

interface ParsedAuthor {
  displayName: string;
  memberId: string;
}

interface ParsedMedia {
  displayOrder: number;
  fileUrl: string;
  id: string;
  thumbnailUrl: string | null;
  type: FeedMediaType;
}

function toFeedPost(input: {
  author: ParsedAuthor;
  body: string;
  commentCount: number;
  createdAt: string;
  currentMemberId?: string;
  currentUserReactionId: ReactionId | null;
  groupId: string;
  id: string;
  media: readonly ParsedMedia[];
  reactionCounts: Record<ReactionId, number>;
}): FeedPost {
  return {
    author: {
      avatarText: avatarText(input.author.displayName),
      id: input.author.memberId,
      name: input.author.displayName,
    },
    body: input.body,
    commentCount: input.commentCount,
    createdAt: input.createdAt,
    currentUserReactionId: input.currentUserReactionId,
    groupId: input.groupId,
    id: input.id,
    images: limitPostImages(
      input.media.map(item => ({
        accessibilityLabel: `${input.author.displayName}의 게시글 미디어`,
        fileUrl: item.fileUrl,
        hasPoster: item.type === 'IMAGE' || item.thumbnailUrl !== null,
        id: item.id,
        mediaType: item.type,
        source: {uri: item.thumbnailUrl ?? item.fileUrl},
        thumbnailUrl: item.thumbnailUrl,
      })),
    ),
    isOwnedByCurrentUser:
      input.currentMemberId !== undefined &&
      input.currentMemberId === input.author.memberId,
    reactions: REACTION_OPTIONS.map(option => ({
      ...option,
      count: input.reactionCounts[option.id],
    })),
  };
}

function parseAuthor(value: unknown): ParsedAuthor | null {
  if (!isRecord(value)) {
    return null;
  }
  const memberId = parseId(value.memberId);
  const displayName = parseNonEmptyString(value.displayName);
  return memberId !== null && displayName !== null
    ? {displayName, memberId}
    : null;
}

function parseMedia(value: unknown): readonly ParsedMedia[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const media = value.map(item => {
    if (!isRecord(item)) {
      return null;
    }
    const id = parseId(item.id);
    const type: ParsedMedia['type'] | null =
      item.type === 'IMAGE' || item.type === 'VIDEO' ? item.type : null;
    const fileUrl = parseNonEmptyString(item.fileUrl);
    const thumbnailUrl =
      item.thumbnailUrl === undefined || item.thumbnailUrl === null
        ? null
        : parseNonEmptyString(item.thumbnailUrl);
    const displayOrder = parseNonNegativeInteger(item.displayOrder);
    if (
      id === null ||
      type === null ||
      fileUrl === null ||
      displayOrder === null
    ) {
      return null;
    }
    return {displayOrder, fileUrl, id, thumbnailUrl, type};
  });

  const parsedMedia = media.filter(isNotNull);
  return parsedMedia.length === media.length
    ? parsedMedia.sort((left, right) => left.displayOrder - right.displayOrder)
    : null;
}

const INVALID_REACTION = Symbol('invalid-reaction');

function parseReactionId(
  value: unknown,
  allowNull = false,
): ReactionId | null | typeof INVALID_REACTION {
  if (value === null && allowNull) {
    return null;
  }
  if (
    value === 'HEART' ||
    value === 'LAUGH' ||
    value === 'SURPRISE' ||
    value === 'SAD' ||
    value === 'SUPPORT'
  ) {
    return value;
  }
  return INVALID_REACTION;
}

function parseReactionCounts(
  value: unknown,
): Record<ReactionId, number> | null {
  if (!isRecord(value)) {
    return null;
  }
  const counts = {} as Record<ReactionId, number>;
  for (const option of REACTION_OPTIONS) {
    const raw = value[option.id];
    if (raw === undefined) {
      counts[option.id] = 0;
      continue;
    }
    const count = parseNonNegativeInteger(raw);
    if (count === null) {
      return null;
    }
    counts[option.id] = count;
  }
  return counts;
}

function avatarText(name: string): string {
  return [...name.trim()].slice(0, 2).join('') || '?';
}

function parseId(value: unknown): string | null {
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : null;
  }
  return null;
}

function parseNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
