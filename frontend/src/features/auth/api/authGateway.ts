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
  type SaveSessionOptions,
} from '../session';
import type {
  AuthenticatedUser,
  AuthGateway,
  LoginCredentials,
  LoginRequestOptions,
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
    options?: SaveSessionOptions,
  ): Promise<void>;
}

export function createAuthGateway(
  client: Pick<AxiosInstance, 'post'> = apiClient,
  session: AuthGatewaySession = authSessionManager,
  now: () => number = Date.now,
): AuthGateway {
  return {
    getAccessToken: () => session.getAccessToken(),
    async login(
      credentials: LoginCredentials,
      options?: LoginRequestOptions,
    ): Promise<AuthenticatedUser> {
      const response =
        options?.signal === undefined
          ? await client.post<ApiSuccess<unknown>>(
              '/auth/login',
              credentials,
            )
          : await client.post<ApiSuccess<unknown>>(
              '/auth/login',
              credentials,
              {signal: options.signal},
            );
      const payload = isApiSuccess(response.data) ? response.data.data : null;

      if (!isLoginResponse(payload)) {
        throw createInvalidResponseError(response.status);
      }

      assertLoginRequestActive(options?.signal);
      if (options === undefined) {
        await session.saveSession(payload, now());
      } else {
        await session.saveSession(payload, now(), options);
      }
      assertLoginRequestActive(options?.signal);

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

function assertLoginRequestActive(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) {
    return;
  }

  const error = new Error('로그인 요청이 취소되었습니다.');
  error.name = 'AbortError';
  throw error;
}

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
