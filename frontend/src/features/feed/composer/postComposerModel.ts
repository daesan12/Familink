import type {ImageSourcePropType} from 'react-native';

import {MAX_POST_IMAGES, type FeedPost} from '../types';

export const MAX_POST_BODY_LENGTH = 140;
export {MAX_POST_IMAGES} from '../types';

// TODO(S15P11B104-177): 서버 정책이 확정되면 길이와 용량 제한을 추가한다.
export const MEDIA_LIMITS = {
  maxVideoDurationSeconds: null,
  maxVideoSizeBytes: null,
} as const;

export interface LocalMedia {
  durationSeconds?: number;
  fileName?: string;
  id: string;
  kind: 'image' | 'video';
  source: {uri: string};
  sourceType: 'local';
  // TODO(S15P11B104-177): 승인된 썸네일 추출기가 연결되면 선택 단계에서 채운다.
  thumbnailSource?: ImageSourcePropType;
}

export interface RemoteMedia {
  id: string;
  kind: 'image';
  source: ImageSourcePropType;
  sourceType: 'remote';
}

export type ComposerMedia = LocalMedia | RemoteMedia;

export interface PostComposerInitialValue {
  body: string;
  media: readonly ComposerMedia[];
  postId?: string;
}

export interface PostSubmitPayload {
  body: string;
  deletedMediaIds: readonly string[];
  newMedia: readonly LocalMedia[];
  postId?: string;
  retainedMediaIds: readonly string[];
}

export type UploadState =
  | {status: 'idle'}
  | {status: 'preparing'}
  | {progress: number; status: 'uploading'}
  | {status: 'success'}
  | {message: string; status: 'failure'}
  | {status: 'cancelled'};

export function createEditInitialValue(post: FeedPost): PostComposerInitialValue {
  return {
    body: post.body,
    media: post.images.map(image => ({
      id: image.id,
      kind: 'image',
      source: image.source,
      sourceType: 'remote',
    })),
    postId: post.id,
  };
}

export function hasComposerChanges(
  initialValue: PostComposerInitialValue,
  body: string,
  media: readonly ComposerMedia[],
): boolean {
  if (initialValue.body !== body || initialValue.media.length !== media.length) {
    return true;
  }

  return initialValue.media.some((item, index) => item.id !== media[index]?.id);
}

export function buildPostSubmitPayload(
  initialValue: PostComposerInitialValue,
  body: string,
  media: readonly ComposerMedia[],
): PostSubmitPayload {
  const retainedMediaIds = media
    .filter((item): item is RemoteMedia => item.sourceType === 'remote')
    .map(item => item.id);
  const initialRemoteIds = initialValue.media
    .filter((item): item is RemoteMedia => item.sourceType === 'remote')
    .map(item => item.id);

  return {
    body: body.trim(),
    deletedMediaIds: initialRemoteIds.filter(
      id => !retainedMediaIds.includes(id),
    ),
    newMedia: media.filter(
      (item): item is LocalMedia => item.sourceType === 'local',
    ),
    postId: initialValue.postId,
    retainedMediaIds,
  };
}

export function canAddMedia(
  current: readonly ComposerMedia[],
  requestedKind: ComposerMedia['kind'],
): 'allowed' | 'confirm-replace' | 'image-limit' {
  if (requestedKind === 'image') {
    if (current.some(item => item.kind === 'video')) {
      return 'confirm-replace';
    }
    return current.length >= MAX_POST_IMAGES ? 'image-limit' : 'allowed';
  }

  return current.length === 0 ? 'allowed' : 'confirm-replace';
}
