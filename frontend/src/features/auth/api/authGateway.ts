import type {AxiosInstance} from 'axios';

import {
  ApiError,
  apiClient,
  isApiSuccess,
  type ApiSuccess,
} from '../../../shared/api';
import {
  authSessionManager,
  type AuthSessionUser,
  type LoginSessionInput,
} from '../session';
import type {
  AuthenticatedUser,
  AuthGateway,
  LoginCredentials,
} from '../types';
import {
  isAuthTokenPairResponse,
  type AuthTokenPairResponse,
} from './authSessionApi';

interface LoginResponse extends AuthTokenPairResponse {
  user: AuthSessionUser;
}

export interface AuthGatewaySession {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  saveSession(
    input: LoginSessionInput,
    receivedAt?: number,
  ): Promise<void>;
}

export function createAuthGateway(
  client: Pick<AxiosInstance, 'post'> = apiClient,
  session: AuthGatewaySession = authSessionManager,
  now: () => number = Date.now,
): AuthGateway {
  return {
    getAccessToken: () => session.getAccessToken(),
    async login(credentials: LoginCredentials): Promise<AuthenticatedUser> {
      const response = await client.post<ApiSuccess<unknown>>(
        '/auth/login',
        credentials,
      );
      const payload = isApiSuccess(response.data) ? response.data.data : null;

      if (!isLoginResponse(payload)) {
        throw createInvalidResponseError(response.status);
      }

      await session.saveSession(payload, now());

      return {
        activeGroupId: null,
        id: payload.user.id,
        name: payload.user.name,
      };
    },

    async logout(): Promise<void> {
      const refreshToken = session.getRefreshToken();
      if (refreshToken === null) {
        return;
      }

      const response = await client.post<void>('/auth/logout', {
        refreshToken,
      });
      if (response.status !== 204) {
        throw createInvalidResponseError(response.status);
      }
    },
  };
}

export const apiAuthGateway = createAuthGateway();

function isLoginResponse(value: unknown): value is LoginResponse {
  if (!isRecord(value) || !isAuthTokenPairResponse(value)) {
    return false;
  }

  const user = value.user;
  if (!isRecord(user)) {
    return false;
  }

  return (
    typeof user.id === 'number' &&
    Number.isSafeInteger(user.id) &&
    user.id > 0 &&
    typeof user.name === 'string' &&
    user.name.trim().length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createInvalidResponseError(status?: number): ApiError {
  return new ApiError({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    message: '서버가 예상하지 못한 응답을 반환했습니다.',
    status,
  });
}
