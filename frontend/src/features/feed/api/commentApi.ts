import {ApiError, apiClient, type ApiSuccess} from '../../../shared/api';
import {parseApiEnvelope} from '../../group-info/api/groupApi';
import type {FeedMember, PostComment} from '../types';
import {MAX_COMMENT_LENGTH, WITHDRAWN_MEMBER_NAME} from '../types';

export const COMMENT_PAGE_SIZE = 20;

export interface CommentPage {
  comments: readonly PostComment[];
  hasNext: boolean;
}

export type CommentPageLoader = (
  postId: string,
  page: number,
  size: number,
) => Promise<CommentPage>;

export interface CreatedComment {
  // 프로필 이미지는 서버 서명 URL이라 클라이언트가 만들 수 없어 생성 응답에서 받는다.
  // author를 내려주지 않는 이전 서버와도 동작해야 해서 선택 값이다.
  author?: FeedMember;
  content: string;
  createdAt: string;
  id: string;
  postId: string;
}

export type CommentCreateResult = CreatedComment;

export interface UpdatedComment {
  content: string;
  id: string;
  updatedAt: string;
}

export async function loadComments(
  postId: string,
  page = 0,
  size = COMMENT_PAGE_SIZE,
): Promise<CommentPage> {
  assertPositiveId(postId);
  assertPage(page, size);

  const response = await apiClient.get<ApiSuccess<unknown>>(
    `/posts/${encodeURIComponent(postId)}/comments?page=${page}&size=${size}`,
  );
  assertStatus(response.status, 200);
  return parseApiEnvelope(
    response.data,
    response.status,
    value => parseCommentPage(value, postId),
  );
}

export async function createComment(
  postId: string,
  body: string,
): Promise<CreatedComment> {
  assertPositiveId(postId);
  const content = normalizeCommentBody(body);
  const response = await apiClient.post<ApiSuccess<unknown>>(
    `/posts/${encodeURIComponent(postId)}/comments`,
    {content},
  );
  assertStatus(response.status, 201);
  return parseApiEnvelope(
    response.data,
    response.status,
    value => parseCreatedComment(value, postId),
  );
}

export async function updateComment(
  commentId: string,
  body: string,
): Promise<UpdatedComment> {
  assertPositiveId(commentId);
  const content = normalizeCommentBody(body);
  const response = await apiClient.patch<ApiSuccess<unknown>>(
    `/comments/${encodeURIComponent(commentId)}`,
    {content},
  );
  assertStatus(response.status, 200);
  return parseApiEnvelope(
    response.data,
    response.status,
    parseUpdatedComment,
  );
}

export async function deleteComment(commentId: string): Promise<void> {
  assertPositiveId(commentId);
  const response = await apiClient.delete(
    `/comments/${encodeURIComponent(commentId)}`,
  );
  assertStatus(response.status, 204);
}

function parseCommentPage(
  value: unknown,
  postId: string,
): CommentPage | null {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return null;
  }
  if (typeof value.hasNext !== 'boolean') {
    return null;
  }

  const comments = value.content.map(item => parseComment(item, postId));
  return comments.every(isNotNull)
    ? {comments, hasNext: value.hasNext}
    : null;
}

function parseComment(value: unknown, postId: string): PostComment | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = parsePositiveId(value.id);
  const author = parseAuthor(value.author);
  const content = parseNonEmptyString(value.content);
  const createdAt = parseInstant(value.createdAt);
  const updatedAt = parseInstant(value.updatedAt);
  if (
    id === null ||
    author === null ||
    content === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    author,
    body: content,
    createdAt,
    id,
    postId,
    updatedAt,
  };
}

function parseCreatedComment(
  value: unknown,
  expectedPostId: string,
): CreatedComment | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = parsePositiveId(value.id);
  const postId = parsePositiveId(value.postId);
  // author를 아직 내려주지 않는 서버와도 동작해야 하므로 누락은 허용한다.
  // 다만 값이 있는데 형식이 깨졌다면 그대로 거부한다.
  const author =
    value.author === undefined ? undefined : parseAuthor(value.author);
  const content = parseNonEmptyString(value.content);
  const createdAt = parseInstant(value.createdAt);
  if (
    id === null ||
    postId === null ||
    postId !== expectedPostId ||
    author === null ||
    content === null ||
    createdAt === null
  ) {
    return null;
  }
  return {author, content, createdAt, id, postId};
}

function parseUpdatedComment(value: unknown): UpdatedComment | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = parsePositiveId(value.id);
  const content = parseNonEmptyString(value.content);
  const updatedAt = parseInstant(value.updatedAt);
  return id !== null && content !== null && updatedAt !== null
    ? {content, id, updatedAt}
    : null;
}

function parseAuthor(value: unknown): FeedMember | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = parsePositiveId(value.memberId);
  const name = parseAuthorDisplayName(value.displayName);
  const profileImageUrl = parseNullableUrl(value.profileImageUrl);
  return id !== null && name !== null && profileImageUrl !== undefined
    ? {avatarText: avatarText(name), id, name, profileImageUrl}
    : null;
}

// 탈퇴로 이름이 익명화된 작성자만 대체한다. 이름이 다른 타입으로 오는 계약 위반은 그대로
// 거부해야 잘못된 응답이 전부 탈퇴 작성자로 조용히 렌더링되지 않는다.
function parseAuthorDisplayName(value: unknown): string | null {
  if (value === null || value === undefined) {
    return WITHDRAWN_MEMBER_NAME;
  }
  return parseNonEmptyString(value);
}

function parseNullableUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  return parseNonEmptyString(value) ?? undefined;
}

function normalizeCommentBody(body: string): string {
  const content = body.trim();
  if (content.length === 0 || content.length > MAX_COMMENT_LENGTH) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'invalidResponse',
      message: '댓글은 1자 이상 50자 이하로 입력해야 합니다.',
    });
  }
  return content;
}

function assertPositiveId(value: string): void {
  if (parsePositiveId(value) === null) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'invalidResponse',
      message: '식별자 형식이 올바르지 않습니다.',
    });
  }
}

function assertPage(page: number, size: number): void {
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
      message: '페이지 요청 범위가 올바르지 않습니다.',
    });
  }
}

function assertStatus(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      message: '서버가 예상하지 못한 상태 코드를 반환했습니다.',
      status: actual,
    });
  }
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

function parseNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseInstant(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function avatarText(name: string): string {
  return [...name.trim()].slice(0, 2).join('') || '?';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
