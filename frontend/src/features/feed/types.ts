import type {ImageSourcePropType} from 'react-native';

export const MAX_POST_IMAGES = 4;
export const MAX_COMMENT_LENGTH = 50;

// 백엔드 REACTION_TYPE(post_reactions.reaction_type)과 동일한 값을 사용해
// 반응은 별도 매핑 없이 API 응답을 그대로 주고받는다.
export type ReactionId =
  | 'HEART'
  | 'LAUGH'
  | 'SURPRISE'
  | 'SAD'
  | 'SUPPORT';

export interface FeedMember {
  avatarText: string;
  id: string;
  name: string;
}

export interface FeedImage {
  accessibilityLabel: string;
  id: string;
  source: ImageSourcePropType;
}

export interface FeedReaction {
  count: number;
  emoji: string;
  id: ReactionId;
  label: string;
}

export interface PostComment {
  author: FeedMember;
  body: string;
  // ISO-8601 UTC 절대 시각. 표시할 때 formatRelativeTime으로 변환한다.
  createdAt: string;
  id: string;
  postId: string;
}

export interface CreateCommentInput {
  body: string;
  postId: string;
}

export interface UpdateCommentInput extends CreateCommentInput {
  commentId: string;
}

export interface DeleteCommentInput {
  commentId: string;
  postId: string;
}

export interface ChangeReactionInput {
  nextReactionId: ReactionId | null;
  postId: string;
  previousReactionId: ReactionId | null;
}

export interface FeedPost {
  author: FeedMember;
  body: string;
  commentCount: number;
  currentUserReactionId?: ReactionId | null;
  // ISO-8601 UTC 절대 시각. 표시할 때 formatRelativeTime으로 변환한다.
  createdAt: string;
  groupId: string;
  id: string;
  images: readonly FeedImage[];
  isOwnedByCurrentUser: boolean;
  reactions: readonly FeedReaction[];
}

export type FeedLoadState =
  | {status: 'loading'}
  | {status: 'success'; posts: readonly FeedPost[]}
  | {message: string; status: 'error'};

export function limitPostImages(
  images: readonly FeedImage[],
): readonly FeedImage[] {
  return images.slice(0, MAX_POST_IMAGES);
}
