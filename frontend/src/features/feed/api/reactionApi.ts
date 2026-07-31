import {ApiError, apiClient, type ApiSuccess} from '../../../shared/api';
import {parseApiEnvelope} from '../../group-info/api/groupApi';
import {
  REACTION_OPTIONS,
} from '../interactions/postInteractions';
import type {FeedReaction, ReactionId} from '../types';

export interface ReactionChangeResult {
  postId: string;
  reactionType: ReactionId | null;
  reactions: readonly FeedReaction[];
}

export async function changePostReaction(
  postId: string,
  reactionId: ReactionId,
): Promise<ReactionChangeResult> {
  const normalizedPostId = parsePositiveId(postId);
  if (normalizedPostId === null) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'invalidResponse',
      message: '게시글 식별자 형식이 올바르지 않습니다.',
    });
  }

  const response = await apiClient.put<ApiSuccess<unknown>>(
    `/posts/${encodeURIComponent(normalizedPostId)}/reaction`,
    {reactionType: reactionId},
  );
  if (response.status !== 200) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      message: '서버가 예상하지 못한 상태 코드를 반환했습니다.',
      status: response.status,
    });
  }

  return parseApiEnvelope(
    response.data,
    response.status,
    value => parseReactionResponse(value, normalizedPostId),
  );
}

function parseReactionResponse(
  value: unknown,
  expectedPostId: string,
): ReactionChangeResult | null {
  if (!isRecord(value)) {
    return null;
  }
  const postId = parsePositiveId(value.postId);
  const reactionType = parseReactionId(value.reactionType, true);
  const counts = parseReactionCounts(value.counts);
  if (
    postId === null ||
    postId !== expectedPostId ||
    reactionType === INVALID_REACTION ||
    counts === null
  ) {
    return null;
  }

  return {
    postId,
    reactionType,
    reactions: REACTION_OPTIONS.map(option => ({
      ...option,
      count: counts[option.id],
    })),
  };
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
    if (
      typeof raw !== 'number' ||
      !Number.isSafeInteger(raw) ||
      raw < 0
    ) {
      return null;
    }
    counts[option.id] = raw;
  }
  return counts;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
