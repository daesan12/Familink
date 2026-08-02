import {ApiError, apiClient, type ApiSuccess} from '../../../shared/api';
import {parseApiEnvelope} from '../../group-info/api/groupApi';
import type {ArchiveMediaKind, ArchivePost} from '../types';

export interface ArchiveQuery {
  date?: string | null;
  memberId?: string | null;
  type?: ArchiveMediaKind;
}

export type ArchiveLoader = (
  groupId: string,
  query?: ArchiveQuery,
) => Promise<readonly ArchivePost[]>;

export async function loadArchive(
  groupId: string,
  query: ArchiveQuery = {},
): Promise<readonly ArchivePost[]> {
  assertPositiveId(groupId, '그룹');
  if (query.memberId != null) {
    assertPositiveId(query.memberId, '구성원');
  }
  if (query.date != null && !isDateKey(query.date)) {
    throwInvalidRequest('날짜 형식이 올바르지 않아요.');
  }

  const params = new URLSearchParams();
  if (query.date != null) {
    params.set('date', query.date);
  }
  if (query.type != null) {
    params.set('type', query.type.toUpperCase());
  }
  if (query.memberId != null) {
    params.set('memberId', query.memberId);
  }
  const queryString = params.toString();
  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/groups/${encodeURIComponent(groupId)}/archive${
      queryString.length > 0 ? `?${queryString}` : ''
    }`,
  );

  return parseApiEnvelope(
    response.data,
    response.status,
    value => parseArchiveResponse(value, groupId, query.memberId ?? null),
  );
}

function parseArchiveResponse(
  value: unknown,
  groupId: string,
  memberId: string | null,
): readonly ArchivePost[] | null {
  if (!isRecord(value) || !Array.isArray(value.dates)) {
    return null;
  }

  const posts: ArchivePost[] = [];
  for (const dateGroup of value.dates) {
    if (!isRecord(dateGroup) || !isDateKey(dateGroup.date)) {
      return null;
    }
    if (!Array.isArray(dateGroup.items)) {
      return null;
    }

    for (const item of dateGroup.items) {
      const parsed = parseArchiveItem(item, dateGroup.date, groupId, memberId);
      if (parsed === null) {
        return null;
      }
      posts.push(parsed);
    }
  }
  return posts;
}

function parseArchiveItem(
  value: unknown,
  dateKey: string,
  groupId: string,
  memberId: string | null,
): ArchivePost | null {
  if (!isRecord(value)) {
    return null;
  }

  const postId = parsePositiveId(value.postId);
  const mediaKind = parseMediaKind(value.type);
  const thumbnailUrl = parseNullableString(value.thumbnailUrl);
  const contentPreview = parseString(value.contentPreview);
  if (
    postId === null ||
    mediaKind === null ||
    thumbnailUrl === INVALID ||
    contentPreview === null
  ) {
    return null;
  }

  const preview = contentPreview.trim();
  const isText = mediaKind === 'text';
  return {
    dateKey,
    groupId,
    id: `${groupId}-${postId}`,
    mediaKind,
    memberId,
    postId,
    ...(isText
      ? {text: preview}
      : {
          thumbnail: thumbnailUrl == null ? undefined : {uri: thumbnailUrl},
          thumbnailAccessibilityLabel: `${mediaKind === 'video' ? '영상' : '사진'} 게시글${
            preview.length > 0 ? `: ${preview}` : ''
          }`,
        }),
  };
}

function parseMediaKind(value: unknown): ArchiveMediaKind | null {
  if (value === 'IMAGE') {
    return 'image';
  }
  if (value === 'VIDEO') {
    return 'video';
  }
  if (value === 'TEXT') {
    return 'text';
  }
  return null;
}

const INVALID = Symbol('invalid');

function parseNullableString(
  value: unknown,
): string | null | typeof INVALID {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : INVALID;
}

function parseString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parsePositiveId(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : null;
  }
  return null;
}

function assertPositiveId(value: string, label: string): void {
  if (parsePositiveId(value) === null) {
    throwInvalidRequest(`${label} 식별자가 올바르지 않아요.`);
  }
}

function throwInvalidRequest(message: string): never {
  throw new ApiError({
    code: 'INVALID_REQUEST',
    kind: 'invalidResponse',
    message,
  });
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
