import type {AxiosInstance} from 'axios';

import {
  ApiError,
  apiClient,
  createApiClient,
  isApiSuccess,
  type ApiAuthSession,
  type ApiSuccess,
} from '../../../shared/api';
import type {Gender} from '../types';

export interface UserProfile {
  birthDate: string;
  gender: Gender;
  loginId: string;
  name: string;
  profileImageUrl: string | null;
}

export interface ProfileUpdateInput {
  birthDate?: string;
  gender?: 'FEMALE' | 'MALE';
  loginId?: string;
  name?: string;
  profileImageUrl?: string | null;
}

export interface ProfileUpdateResult {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ProfileGateway {
  loadCurrentProfile(): Promise<UserProfile>;
  updateCurrentProfile(input: ProfileUpdateInput): Promise<ProfileUpdateResult>;
  withdrawCurrentUser(): Promise<void>;
}

export type ProfileHttpClient = Pick<AxiosInstance, 'delete' | 'get' | 'patch'>;

export interface ProfileGatewayOptions {
  authSession?: ApiAuthSession;
  baseUrl?: string;
  client?: ProfileHttpClient;
}

export function createProfileGateway(
  options: ProfileGatewayOptions = {},
): ProfileGateway {
  const client =
    options.client ??
    (options.baseUrl === undefined && options.authSession === undefined
      ? apiClient
      : createApiClient(options.baseUrl, options.authSession));

  return {
    async loadCurrentProfile() {
      const response = await client.get<ApiSuccess<unknown>>('/users/me');
      return parseApiEnvelope(response.data, response.status, parseUserProfile);
    },

    async updateCurrentProfile(input) {
      const response = await client.patch<ApiSuccess<unknown>>(
        '/users/me',
        input,
      );
      return parseApiEnvelope(
        response.data,
        response.status,
        parseProfileUpdateResult,
      );
    },

    async withdrawCurrentUser() {
      const response = await client.delete('/users/me');
      if (response.status !== 204) {
        throw invalidResponse(response.status);
      }
    },
  };
}

export const profileGateway = createProfileGateway();

export function getProfileWithdrawErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '잠시 후 다시 시도해 주세요.';
  }

  switch (error.code) {
    case 'MANAGER_TRANSFER_REQUIRED':
      return '회원 탈퇴 전에 먼저 그룹 관리자를 다른 구성원에게 위임해 주세요.';
    case 'UNAUTHORIZED':
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    case 'FORBIDDEN':
      return '회원 탈퇴 권한이 없습니다.';
    case 'NETWORK_ERROR':
    case 'API_TIMEOUT':
      return '네트워크 연결을 확인하고 다시 시도해 주세요.';
    default:
      return error.message || '잠시 후 다시 시도해 주세요.';
  }
}

function parseApiEnvelope<T>(
  envelope: unknown,
  status: number,
  parseData: (value: unknown) => T | null,
): T {
  const data = isApiSuccess(envelope) ? parseData(envelope.data) : null;
  if (data !== null) {
    return data;
  }

  throw invalidResponse(status);
}

function parseUserProfile(value: unknown): UserProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const birthDate = readIsoDate(value.birthDate);
  const gender = readGender(value.gender);
  const loginId = readNonEmptyString(value.loginId);
  const name = readNonEmptyString(value.name);
  const profileImageUrl = readNullableString(value.profileImageUrl);
  if (
    birthDate === null ||
    gender === null ||
    loginId === null ||
    name === null ||
    profileImageUrl === undefined
  ) {
    return null;
  }

  return {birthDate, gender, loginId, name, profileImageUrl};
}

function parseProfileUpdateResult(value: unknown): ProfileUpdateResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readPositiveId(value.id);
  const name = readNonEmptyString(value.name);
  const updatedAt = readInstant(value.updatedAt);
  if (id === null || name === null || updatedAt === null) {
    return null;
  }

  return {id, name, updatedAt};
}

function readGender(value: unknown): Gender | null {
  if (value === 'MALE') {
    return 'male';
  }
  if (value === 'FEMALE') {
    return 'female';
  }
  return null;
}

function readIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10) === value ? value : null;
}

function readInstant(value: unknown): string | null {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return null;
  }
  return value;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return readNonEmptyString(value) ?? undefined;
}

function readPositiveId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? value : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(status?: number): ApiError {
  return new ApiError({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    message: '서버가 예상하지 못한 응답을 반환했습니다.',
    status,
  });
}
