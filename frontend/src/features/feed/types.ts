import type {ImageSourcePropType} from 'react-native';

export const MAX_POST_IMAGES = 4;

export interface FeedImage {
  accessibilityLabel: string;
  id: string;
  source: ImageSourcePropType;
}

export interface FeedReaction {
  count: number;
  emoji: string;
  id: string;
}

export interface FeedPost {
  author: {
    avatarText: string;
    id: string;
    name: string;
  };
  body: string;
  commentCount: number;
  createdAtLabel: string;
  groupId: string;
  id: string;
  images: readonly FeedImage[];
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
