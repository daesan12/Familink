import type {AxiosInstance} from 'axios';

import {
  ApiError,
  apiClient,
  isApiSuccess,
  type ApiSuccess,
} from '../../../shared/api';
import type {Gender} from '../types';

export interface SignupInput {
  birthDate: string;
  gender: Gender;
  loginId: string;
  name: string;
  password: string;
}

export interface SignupResult {
  createdAt: string;
  loginId: string;
  name: string;
  userId: number;
}

export interface SignupGateway {
  checkLoginIdAvailability(loginId: string): Promise<boolean>;
  signup(input: SignupInput, signal?: AbortSignal): Promise<SignupResult>;
}

export type SignupHttpClient = Pick<AxiosInstance, 'get' | 'post'>;

export function createSignupGateway(
  client: SignupHttpClient = apiClient,
): SignupGateway {
  return {
    async checkLoginIdAvailability(loginId) {
      const response = await client.get<ApiSuccess<unknown>>(
        '/auth/login-id/check',
        {params: {loginId}},
      );
      const payload =
        response.status === 200 && isApiSuccess(response.data)
          ? response.data.data
          : null;

      if (!isRecord(payload) || typeof payload.available !== 'boolean') {
        throw invalidResponse(response.status);
      }

      return payload.available;
    },

    async signup(input, signal) {
      const response =
        signal === undefined
          ? await client.post<ApiSuccess<unknown>>('/auth/signup', input)
          : await client.post<ApiSuccess<unknown>>('/auth/signup', input, {
              signal,
            });
      const payload =
        response.status === 201 && isApiSuccess(response.data)
          ? parseSignupResult(response.data.data)
          : null;

      if (payload === null || payload.loginId !== input.loginId) {
        throw invalidResponse(response.status);
      }

      return payload;
    },
  };
}

export const signupGateway = createSignupGateway();

function parseSignupResult(value: unknown): SignupResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const {createdAt, loginId, name, userId} = value;
  if (
    typeof userId !== 'number' ||
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    typeof loginId !== 'string' ||
    loginId.length === 0 ||
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    typeof createdAt !== 'string' ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {createdAt, loginId, name, userId};
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
