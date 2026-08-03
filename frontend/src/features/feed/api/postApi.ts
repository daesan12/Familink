import axios from 'axios';

import {
  ApiError,
  apiClient,
  normalizeApiError,
  type ApiSuccess,
} from '../../../shared/api';
import {
  BlobUploadError,
  uploadBlobWithXhr,
} from '../../../shared/api/blobUpload';
import {
  clientMediaProcessor,
  type ClientMediaProcessor,
  type ProcessedMediaAsset,
} from '../../../shared/media/clientMediaProcessor';
import {parseApiEnvelope} from '../../group-info/api/groupApi';
import {
  validatePickedMedia,
  type ComposerMedia,
  type LocalMedia,
  type PostSubmitPayload,
  type RemoteMedia,
} from '../composer/postComposerModel';
import {MAX_POST_IMAGES} from '../types';

const MAX_POST_BODY_LENGTH = 140;

export type PostUploadProgress = (progress: number) => void;

interface UploadRequestConfig {
  headers: Record<string, string>;
  onUploadProgress?: (event: {loaded: number; total?: number}) => void;
  signal?: AbortSignal;
}

export interface PostUploadTransport {
  readFile(uri: string, signal?: AbortSignal): Promise<Blob>;
  put(
    uploadUrl: string,
    data: Blob,
    config: UploadRequestConfig,
  ): Promise<void>;
}

const defaultUploadTransport: PostUploadTransport = {
  async readFile(uri, signal) {
    const response = await fetch(uri, {signal});
    if (!response.ok) {
      throw new ApiError({
        code: 'MEDIA_READ_FAILED',
        kind: 'network',
        message: '선택한 미디어를 읽지 못했습니다.',
        status: response.status,
      });
    }
    return response.blob();
  },
  async put(uploadUrl, data, config) {
    await uploadBlobWithXhr(uploadUrl, data, {
      headers: config.headers,
      signal: config.signal,
      onProgress: config.onUploadProgress,
    });
  },
};

interface SubmitPostOptions {
  mediaProcessor?: ClientMediaProcessor;
  transport?: PostUploadTransport;
}

interface PresignedUpload {
  expiresAt: string;
  fileUrl: string;
  headers: Record<string, string>;
  uploadUrl: string;
}

interface UploadedMedia {
  fileUrl: string;
  localId: string;
  thumbnailUrl?: string;
}

export interface CreatedPostResult {
  createdAt: string;
  groupId: string;
  postId: string;
}

export interface UpdatedPostResult {
  id: string;
  updatedAt: string;
}

export function isPostUploadCancelled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'UPLOAD_CANCELLED';
}

export async function submitPost(
  groupId: string,
  payload: PostSubmitPayload,
  onProgress?: PostUploadProgress,
  signal?: AbortSignal,
  options: SubmitPostOptions = {},
): Promise<CreatedPostResult | UpdatedPostResult> {
  try {
    const normalizedGroupId = toRequestId(groupId, 'groupId');
    const normalizedBody = validateBody(payload.body);
    const fallbackRetainedMedia = payload.retainedMedia ?? [];
    const orderedMedia =
      payload.orderedMedia ?? [...fallbackRetainedMedia, ...payload.newMedia];
    const newMedia = orderedMedia.filter(
      (item): item is LocalMedia => item.sourceType === 'local',
    );
    const allMedia = orderedMedia;
    const mediaType = validateMediaSelection(allMedia);
    assertNotAborted(signal);

    const uploadedMedia = await uploadNewMedia(
      newMedia,
      onProgress,
      signal,
      options.transport ?? defaultUploadTransport,
      options.mediaProcessor ?? clientMediaProcessor,
    );
    const media = buildMediaRequest(orderedMedia, uploadedMedia);

    if (payload.postId !== undefined) {
      return updatePost(
        payload.postId,
        normalizedBody,
        mediaType,
        media,
        signal,
      );
    }

    return createPost(
      normalizedGroupId,
      normalizedBody,
      mediaType,
      media,
      signal,
    );
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      throw new ApiError({
        code: 'UPLOAD_CANCELLED',
        kind: 'network',
        message: '미디어 업로드를 취소했습니다.',
        originalError: error,
      });
    }
    throw normalizePostError(error);
  }
}

export async function deletePost(postId: string): Promise<void> {
  const normalizedPostId = toRequestId(postId, 'postId');
  const response = await apiClient.delete(
    `/posts/${encodeURIComponent(normalizedPostId)}`,
  );
  if (response.status !== 204) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      message: '게시글 삭제 응답이 올바르지 않습니다.',
      status: response.status,
    });
  }
}

async function createPost(
  groupId: string,
  body: string,
  mediaType: 'IMAGE' | 'VIDEO' | null,
  media: readonly PostMediaRequest[],
  signal?: AbortSignal,
): Promise<CreatedPostResult> {
  assertNotAborted(signal);
  const request: Record<string, unknown> = {
    content: body,
    groupIds: [Number(groupId)],
    media,
  };
  if (mediaType !== null) {
    request.mediaType = mediaType;
  }

  const response = await apiClient.post<ApiSuccess<unknown>>('/posts', request, {
    signal,
  });
  assertStatus(response.status, 201);
  return parseApiEnvelope(
    response.data,
    response.status,
    value => parseCreatedPost(value, groupId),
  );
}

async function updatePost(
  postId: string,
  body: string,
  mediaType: 'IMAGE' | 'VIDEO' | null,
  media: readonly PostMediaRequest[],
  signal?: AbortSignal,
): Promise<UpdatedPostResult> {
  const normalizedPostId = toRequestId(postId, 'postId');
  assertNotAborted(signal);
  const request: Record<string, unknown> = {content: body, media};
  if (mediaType !== null) {
    request.mediaType = mediaType;
  }

  const response = await apiClient.patch<ApiSuccess<unknown>>(
    `/posts/${encodeURIComponent(normalizedPostId)}`,
    request,
    {signal},
  );
  assertStatus(response.status, 200);
  return parseApiEnvelope(
    response.data,
    response.status,
    value => parseUpdatedPost(value, normalizedPostId),
  );
}

interface PostMediaRequest {
  displayOrder: number;
  fileUrl: string;
  thumbnailUrl?: string;
}

function buildMediaRequest(
  orderedMedia: readonly ComposerMedia[],
  uploadedMedia: readonly UploadedMedia[],
): readonly PostMediaRequest[] {
  const uploadedById = new Map(
    uploadedMedia.map(media => [media.localId, media]),
  );
  return orderedMedia.map((media, displayOrder) => {
    if (media.sourceType === 'remote') {
      const request: PostMediaRequest = {
        displayOrder,
        fileUrl: requireFileUrl(media.fileUrl, media.id),
      };
      if (media.thumbnailUrl !== undefined && media.thumbnailUrl !== null) {
        request.thumbnailUrl = media.thumbnailUrl;
      }
      return request;
    }

    const uploaded = uploadedById.get(media.id);
    if (uploaded === undefined) {
      throw invalidRequest('업로드된 미디어를 찾지 못했습니다.');
    }
    return {
      displayOrder,
      fileUrl: uploaded.fileUrl,
      ...(uploaded.thumbnailUrl ? {thumbnailUrl: uploaded.thumbnailUrl} : {}),
    };
  });
}

async function uploadNewMedia(
  media: readonly LocalMedia[],
  onProgress: PostUploadProgress | undefined,
  signal: AbortSignal | undefined,
  transport: PostUploadTransport,
  mediaProcessor: ClientMediaProcessor,
): Promise<readonly UploadedMedia[]> {
  if (media.length === 0) {
    onProgress?.(1);
    return [];
  }

  const processedAssets: ProcessedMediaAsset[] = [];
  try {
    const originalFiles: UploadFile[] = [];
    const thumbnailFiles: UploadFile[] = [];
    for (const item of media) {
      assertNotAborted(signal);
      let originalAsset: ProcessedMediaAsset;
      let thumbnailAsset: ProcessedMediaAsset;
      try {
        originalAsset = await mediaProcessor.preparePostOriginal({
          contentType: item.contentType,
          fileName: item.fileName,
          kind: item.kind,
          uri: item.source.uri,
        });
        processedAssets.push(originalAsset);
        thumbnailAsset = await mediaProcessor.preparePostThumbnail({
          contentType: item.contentType,
          fileName: item.fileName,
          kind: item.kind,
          uri: item.source.uri,
        });
        processedAssets.push(thumbnailAsset);
      } catch (error) {
        throw mediaProcessingFailed(error);
      }
      const blob = await transport.readFile(originalAsset.uri, signal);
      const thumbnailBlob = await transport.readFile(
        thumbnailAsset.uri,
        signal,
      );
      assertNotAborted(signal);
      originalFiles.push(toUploadFile(item, originalAsset, blob));
      thumbnailFiles.push(toThumbnailUploadFile(thumbnailAsset, thumbnailBlob));
    }
    const allFiles = [...originalFiles, ...thumbnailFiles];
    const totalBytes = allFiles.reduce(
      (total, file) => total + file.sizeBytes,
      0,
    );
    let uploadedBytes = 0;
    onProgress?.(0);

    const originalUploads = await requestPresignedUploads(originalFiles, signal);
    uploadedBytes = await uploadFiles(
    originalFiles,
    originalUploads,
    uploadedBytes,
    totalBytes,
    onProgress,
    signal,
    transport,
    );
    const thumbnailUploads = await requestPresignedUploads(
      thumbnailFiles,
      signal,
    );
    await uploadFiles(
    thumbnailFiles,
    thumbnailUploads,
    uploadedBytes,
    totalBytes,
    onProgress,
    signal,
    transport,
    );

    onProgress?.(1);
    return media.map((item, index) => ({
      fileUrl: originalUploads[index].fileUrl,
      localId: item.id,
      thumbnailUrl: thumbnailUploads[index].fileUrl,
    }));
  } finally {
    await clearTemporaryMediaFiles(mediaProcessor, processedAssets);
  }
}

async function clearTemporaryMediaFiles(
  mediaProcessor: ClientMediaProcessor,
  assets: readonly ProcessedMediaAsset[],
): Promise<void> {
  try {
    await mediaProcessor.clearTemporaryFiles?.(assets);
  } catch {
    // 캐시 정리 실패가 이미 끝난 업로드 결과를 실패로 바꾸지 않게 한다.
  }
}

interface UploadFile {
  blob: Blob;
  contentType: string;
  fileName: string;
  sizeBytes: number;
}

function toUploadFile(
  media: LocalMedia,
  asset: ProcessedMediaAsset,
  blob: Blob,
): UploadFile {
  const contentType = normalizeContentType(asset.contentType);
  const fileName = normalizeFileName(asset.fileName);
  const sizeBytes = blob.size;
  if (contentType === null || fileName === null || !isPositiveSafeInteger(sizeBytes)) {
    throw invalidRequest('미디어 파일명, MIME 타입, 크기 정보가 필요합니다.');
  }

  const reason = validatePickedMedia(media.kind, {
    contentType,
    durationSeconds: media.durationSeconds,
    fileSizeBytes: sizeBytes,
  });
  if (reason !== null) {
    throw invalidRequest(mediaValidationMessage(reason));
  }

  return {blob, contentType, fileName, sizeBytes};
}

function toThumbnailUploadFile(
  asset: ProcessedMediaAsset,
  blob: Blob,
): UploadFile {
  const contentType = normalizeContentType(asset.contentType);
  const fileName = normalizeFileName(asset.fileName);
  const sizeBytes = blob.size;
  if (contentType === null || fileName === null || !isPositiveSafeInteger(sizeBytes)) {
    throw invalidRequest('썸네일 파일 정보가 올바르지 않습니다.');
  }
  const reason = validatePickedMedia('image', {
    contentType,
    fileSizeBytes: sizeBytes,
  });
  if (reason !== null) {
    throw invalidRequest(mediaValidationMessage(reason));
  }
  return {blob, contentType, fileName, sizeBytes};
}

async function requestPresignedUploads(
  files: readonly UploadFile[],
  signal?: AbortSignal,
): Promise<readonly PresignedUpload[]> {
  const response = await apiClient.post<ApiSuccess<unknown>>(
    '/files/presigned-urls',
    {
      files: files.map(file => ({
        contentType: file.contentType,
        fileName: file.fileName,
        sizeBytes: file.sizeBytes,
      })),
      purpose: 'post-media',
    },
    {signal},
  );
  assertStatus(response.status, 201);
  return parseApiEnvelope(
    response.data,
    response.status,
    value => parsePresignedUploads(value, files.length),
  );
}

async function uploadFiles(
  files: readonly UploadFile[],
  uploads: readonly PresignedUpload[],
  initialUploadedBytes: number,
  totalBytes: number,
  onProgress: PostUploadProgress | undefined,
  signal: AbortSignal | undefined,
  transport: PostUploadTransport,
): Promise<number> {
  let uploadedBytes = initialUploadedBytes;
  for (const [index, upload] of uploads.entries()) {
    assertNotAborted(signal);
    const file = files[index];
    try {
      await transport.put(upload.uploadUrl, file.blob, {
        headers: upload.headers,
        signal,
        onUploadProgress: event => {
          const eventLoaded =
            typeof event.loaded === 'number'
              ? Math.min(event.loaded, file.sizeBytes)
              : 0;
          onProgress?.(
            Math.min(1, (uploadedBytes + eventLoaded) / totalBytes),
          );
        },
      });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw error;
      }
      throw mediaUploadFailed(error);
    }
    uploadedBytes += file.sizeBytes;
    onProgress?.(Math.min(1, uploadedBytes / totalBytes));
  }
  return uploadedBytes;
}

function validateMediaSelection(
  media: readonly (LocalMedia | RemoteMedia)[],
): 'IMAGE' | 'VIDEO' | null {
  if (media.length === 0) {
    return null;
  }

  if (media.length > MAX_POST_IMAGES) {
    throw invalidRequest('게시글 미디어는 최대 4개까지 선택할 수 있습니다.');
  }
  const kinds = new Set(media.map(item => item.kind));
  if (kinds.size !== 1) {
    throw invalidRequest('사진과 영상은 함께 선택할 수 없습니다.');
  }
  const kind = media[0].kind;
  if (kind === 'video' && media.length !== 1) {
    throw invalidRequest('영상은 게시글당 1개만 선택할 수 있습니다.');
  }
  return kind === 'image' ? 'IMAGE' : 'VIDEO';
}

function validateBody(body: string): string {
  const normalized = body.trim();
  if (normalized.length === 0 || normalized.length > MAX_POST_BODY_LENGTH) {
    throw invalidRequest('게시글 본문은 1~140자로 입력해야 합니다.');
  }
  return normalized;
}

function parsePresignedUploads(
  value: unknown,
  expectedCount: number,
): readonly PresignedUpload[] | null {
  if (!isRecord(value) || !Array.isArray(value.uploads) || value.uploads.length !== expectedCount) {
    return null;
  }
  const uploads = value.uploads.map(item => {
    if (!isRecord(item)) {
      return null;
    }
    const uploadUrl = parseNonEmptyString(item.uploadUrl);
    const fileUrl = parseNonEmptyString(item.fileUrl);
    const expiresAt = parseInstant(item.expiresAt);
    const headers = parseHeaders(item.headers);
    return uploadUrl !== null && fileUrl !== null && expiresAt !== null && headers !== null
      ? {expiresAt, fileUrl, headers, uploadUrl}
      : null;
  });
  return uploads.every(isNotNull) ? uploads : null;
}

function parseCreatedPost(
  value: unknown,
  expectedGroupId: string,
): CreatedPostResult | null {
  if (!isRecord(value) || !Array.isArray(value.posts)) {
    return null;
  }
  const createdAt = parseInstant(value.createdAt);
  const posts = value.posts.map(item => {
    if (!isRecord(item)) {
      return null;
    }
    const postId = parseId(item.postId);
    const groupId = parseId(item.groupId);
    return postId !== null && groupId !== null ? {groupId, postId} : null;
  });
  if (!posts.every(isNotNull)) {
    return null;
  }
  const created = posts.find(
    (item): item is {groupId: string; postId: string} =>
      item !== null && item.groupId === expectedGroupId,
  );
  return created !== undefined && createdAt !== null
    ? {...created, createdAt}
    : null;
}

function parseUpdatedPost(
  value: unknown,
  expectedPostId: string,
): UpdatedPostResult | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = parseId(value.id);
  const updatedAt = parseInstant(value.updatedAt);
  return id === expectedPostId && updatedAt !== null ? {id, updatedAt} : null;
}

function parseHeaders(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }
  const entries = Object.entries(value);
  return entries.every(
    ([key, item]) => key.trim().length > 0 && typeof item === 'string',
  )
    ? Object.fromEntries(entries) as Record<string, string>
    : null;
}

function parseInstant(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function parseNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseId(value: unknown): string | null {
  if (typeof value === 'number' && isPositiveSafeInteger(value)) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return isPositiveSafeInteger(parsed) ? String(parsed) : null;
  }
  return null;
}

function toRequestId(value: string, field: string): string {
  const id = parseId(value);
  if (id === null) {
    throw invalidRequest(`${field}가 올바르지 않습니다.`);
  }
  return id;
}

function requireFileUrl(value: string | undefined, mediaId: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidRequest(`기존 미디어(${mediaId})의 파일 URL이 없습니다.`);
  }
  return value;
}

function normalizeContentType(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeFileName(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 255 && !/[\\/\u0000-\u001f]/.test(normalized)
    ? normalized
    : null;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new ApiError({
      code: 'UPLOAD_CANCELLED',
      kind: 'network',
      message: '미디어 업로드를 취소했습니다.',
    });
  }
}

function invalidRequest(message: string): ApiError {
  return new ApiError({code: 'INVALID_REQUEST', kind: 'invalidResponse', message});
}

function mediaUploadFailed(error: unknown): ApiError {
  return new ApiError({
    code: 'MEDIA_UPLOAD_FAILED',
    kind:
      (axios.isAxiosError(error) && error.response !== undefined) ||
      (error instanceof BlobUploadError && error.status !== undefined)
        ? 'server'
        : 'network',
    message: '미디어 업로드에 실패했습니다. 다시 시도해 주세요.',
    originalError: error,
    status:
      error instanceof BlobUploadError
        ? error.status
        : axios.isAxiosError(error)
        ? error.response?.status
        : undefined,
  });
}

function mediaProcessingFailed(error: unknown): ApiError {
  return new ApiError({
    code: 'MEDIA_PROCESSING_FAILED',
    kind: 'network',
    message: '미디어 압축 또는 썸네일 생성에 실패했습니다.',
    originalError: error,
  });
}

function assertStatus(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      message: '서버 응답 상태 코드가 올바르지 않습니다.',
      status: actual,
    });
  }
}

function mediaValidationMessage(reason: 'duration' | 'size' | 'type'): string {
  if (reason === 'duration') {
    return '영상은 최대 60초까지 선택할 수 있습니다.';
  }
  if (reason === 'size') {
    return '사진은 10MiB, 영상은 100MiB 이하만 선택할 수 있습니다.';
  }
  return '지원하지 않는 미디어 형식입니다.';
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    axios.isCancel(error)
  );
}

function normalizePostError(error: unknown): ApiError {
  if (error instanceof ApiError || axios.isAxiosError(error)) {
    return normalizeApiError(error);
  }
  return new ApiError({
    code: 'MEDIA_UPLOAD_FAILED',
    kind: 'network',
    message: '미디어 업로드에 실패했습니다. 네트워크를 확인해 주세요.',
    originalError: error,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
