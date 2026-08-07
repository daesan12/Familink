import type {ImageSourcePropType} from 'react-native';

import {MAX_POST_IMAGES, type FeedPost} from '../types';

export const MAX_POST_BODY_LENGTH = 140;
export {MAX_POST_IMAGES} from '../types';

// 제한값은 백엔드 환경변수와 동일하게 유지한다. 공식 스펙 반영은 pending 제안 승인 후 진행한다.
export const MEDIA_LIMITS = {
  maxImageSizeBytes: 10 * 1024 * 1024,
  maxVideoDurationSeconds: 60,
  maxVideoSizeBytes: 100 * 1024 * 1024,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedVideoTypes: ['video/mp4'],
} as const;

export type PickedMediaValidationError = 'duration' | 'size' | 'type';

export interface PickedMediaMetadata {
  contentType?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
}

export function validatePickedMedia(
  kind: LocalMedia['kind'],
  metadata: PickedMediaMetadata,
): PickedMediaValidationError | null {
  const contentType = metadata.contentType?.split(';', 1)[0].toLowerCase();
  const allowedTypes: readonly string[] =
    kind === 'image'
      ? MEDIA_LIMITS.allowedImageTypes
      : MEDIA_LIMITS.allowedVideoTypes;

  if (contentType && !allowedTypes.includes(contentType)) {
    return 'type';
  }

  const maxSizeBytes =
    kind === 'image'
      ? MEDIA_LIMITS.maxImageSizeBytes
      : MEDIA_LIMITS.maxVideoSizeBytes;
  if (
    metadata.fileSizeBytes !== undefined &&
    metadata.fileSizeBytes > maxSizeBytes
  ) {
    return 'size';
  }

  if (
    kind === 'video' &&
    metadata.durationSeconds !== undefined &&
    metadata.durationSeconds > MEDIA_LIMITS.maxVideoDurationSeconds
  ) {
    return 'duration';
  }

  return null;
}

export interface LocalMedia {
  contentType?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  fileName?: string;
  id: string;
  kind: 'image' | 'video';
  source: {uri: string};
  sourceType: 'local';
  // TODO(S15P11B104-177): 승인된 썸네일 추출기가 연결되면 선택 단계에서 채운다.
  thumbnailSource?: ImageSourcePropType;
}

export interface RemoteMedia {
  fileUrl?: string;
  id: string;
  kind: 'image' | 'video';
  source: ImageSourcePropType;
  sourceType: 'remote';
  thumbnailSource?: ImageSourcePropType;
  thumbnailUrl?: string | null;
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
  orderedMedia?: readonly ComposerMedia[];
  postId?: string;
  retainedMedia?: readonly RemoteMedia[];
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
      fileUrl: image.fileUrl,
      id: image.id,
      kind: image.mediaType === 'VIDEO' ? 'video' : 'image',
      source: image.source,
      sourceType: 'remote',
      thumbnailSource:
        image.thumbnailUrl !== null && image.thumbnailUrl !== undefined
          ? {uri: image.thumbnailUrl}
          : undefined,
      thumbnailUrl: image.thumbnailUrl,
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
    orderedMedia: media,
    postId: initialValue.postId,
    retainedMedia: media.filter(
      (item): item is RemoteMedia => item.sourceType === 'remote',
    ),
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

/**
 * 교체 확인 문구는 요청한 종류가 아니라 현재 선택된 종류를 기준으로 만든다.
 * 영상이 선택된 상태에서 영상을 다시 고르는 경우도 확인 대상이므로,
 * 요청 종류만 보면 선택한 적 없는 사진을 지운다고 안내하게 된다.
 */
export function describeMediaReplace(
  current: readonly ComposerMedia[],
  requestedKind: ComposerMedia['kind'],
): {message: string; title: string} {
  // 확인이 필요한 상태에서는 사진과 영상이 섞여 있을 수 없다.
  const hasVideo = current.some(item => item.kind === 'video');

  if (hasVideo) {
    return {
      message: '교체하면 현재 선택한 영상이 제거돼요.',
      title:
        requestedKind === 'video'
          ? '선택한 영상을 교체할까요?'
          : '영상을 사진으로 교체할까요?',
    };
  }

  return {
    message: '교체하면 현재 선택한 사진이 제거돼요.',
    title: '사진을 영상으로 교체할까요?',
  };
}
