import type {AxiosInstance} from 'axios';

import {
  ApiError,
  apiClient,
  createApiClient,
  type ApiAuthSession,
  type ApiSuccess,
} from '../../../shared/api';
import {parseApiEnvelope} from '../../group-info/api/groupApi';

export interface MemberInterests {
  interests: readonly string[];
  memberId: string;
}

export type InterestsLoader = (
  groupId: string,
  memberId: string,
) => Promise<MemberInterests>;

export type InterestsReplacer = (
  groupId: string,
  memberId: string,
  interests: readonly string[],
) => Promise<MemberInterests>;

export interface InterestGateway {
  loadInterests: InterestsLoader;
  replaceInterests: InterestsReplacer;
}

export type InterestHttpClient = Pick<AxiosInstance, 'get' | 'put'>;

export interface InterestGatewayOptions {
  authSession?: ApiAuthSession;
  baseUrl?: string;
  client?: InterestHttpClient;
}

/** API-INTERESTS-001: 피보호자 본인 또는 같은 그룹 보호자의 관심사를 조회한다. */
export async function loadInterests(
  groupId: string,
  memberId: string,
): Promise<MemberInterests> {
  return loadInterestsWithClient(apiClient, groupId, memberId);
}

async function loadInterestsWithClient(
  client: InterestHttpClient,
  groupId: string,
  memberId: string,
): Promise<MemberInterests> {
  const response = await client.get<ApiSuccess<unknown>>(
    interestPath(groupId, memberId),
  );
  const result = parseApiEnvelope(
    response.data,
    response.status,
    parseMemberInterests,
  );
  ensureRequestedMember(result, memberId, response.status);
  return result;
}

/** API-INTERESTS-002: 피보호자 본인의 관심사 목록을 전체 교체한다. */
export async function replaceInterests(
  groupId: string,
  memberId: string,
  interests: readonly string[],
): Promise<MemberInterests> {
  return replaceInterestsWithClient(apiClient, groupId, memberId, interests);
}

async function replaceInterestsWithClient(
  client: InterestHttpClient,
  groupId: string,
  memberId: string,
  interests: readonly string[],
): Promise<MemberInterests> {
  const normalizedInterests = normalizeInterests(interests);
  const response = await client.put<ApiSuccess<unknown>>(
    interestPath(groupId, memberId),
    {interests: normalizedInterests},
  );
  const result = parseApiEnvelope(
    response.data,
    response.status,
    parseMemberInterests,
  );
  ensureRequestedMember(result, memberId, response.status);
  return result;
}

export function createInterestGateway(
  options: InterestGatewayOptions = {},
): InterestGateway {
  const client =
    options.client ??
    (options.baseUrl === undefined && options.authSession === undefined
      ? apiClient
      : createApiClient(options.baseUrl, options.authSession));

  return {
    loadInterests: (groupId, memberId) =>
      loadInterestsWithClient(client, groupId, memberId),
    replaceInterests: (groupId, memberId, interests) =>
      replaceInterestsWithClient(client, groupId, memberId, interests),
  };
}

export const familyInterestGateway: InterestGateway = createInterestGateway();

export function getInterestErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  switch (error.code) {
    case 'UNAUTHORIZED':
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    case 'FORBIDDEN':
      return '현재 그룹에서 관심사를 조회하거나 수정할 권한이 없습니다.';
    case 'INVALID_REQUEST':
      return '관심사는 0~10개이며 각 값은 1~10자로 입력해 주세요.';
    case 'NETWORK_ERROR':
    case 'API_TIMEOUT':
      return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
    default:
      return error.message || fallback;
  }
}

interface MemberInterestsResponse {
  interests: readonly string[];
  memberId: string;
}

function interestPath(groupId: string, memberId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
    memberId,
  )}/interests`;
}

function parseMemberInterests(value: unknown): MemberInterestsResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const memberId = parseId(value.memberId);
  const interests = parseInterestList(value.interests);
  if (memberId === null || interests === null) {
    return null;
  }

  return {interests, memberId};
}

function parseInterestList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > 10) {
    return null;
  }

  const normalized = new Set<string>();
  for (const interest of value) {
    if (typeof interest !== 'string') {
      return null;
    }

    const trimmed = interest.trim();
    if (
      trimmed.length === 0 ||
      Array.from(trimmed).length > 10 ||
      normalized.has(trimmed)
    ) {
      return null;
    }
    normalized.add(trimmed);
  }

  return [...normalized];
}

function normalizeInterests(interests: readonly string[]): readonly string[] {
  if (!Array.isArray(interests)) {
    throwInvalidRequest();
  }

  const normalized = new Set<string>();
  for (const interest of interests) {
    if (typeof interest !== 'string') {
      throwInvalidRequest();
    }

    const trimmed = interest.trim();
    if (trimmed.length === 0 || Array.from(trimmed).length > 10) {
      throwInvalidRequest();
    }

    normalized.add(trimmed);
    if (normalized.size > 10) {
      throwInvalidRequest();
    }
  }

  return [...normalized];
}

function ensureRequestedMember(
  result: MemberInterestsResponse,
  requestedMemberId: string,
  status: number,
): void {
  if (result.memberId !== requestedMemberId) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      message: '서버 응답의 구성원 식별자가 요청과 일치하지 않습니다.',
      status,
    });
  }
}

function throwInvalidRequest(): never {
  throw new ApiError({
    code: 'INVALID_REQUEST',
    kind: 'invalidResponse',
    message: '관심사는 0~10개이며 각 값은 1~10자로 입력해 주세요.',
  });
}

function parseId(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
