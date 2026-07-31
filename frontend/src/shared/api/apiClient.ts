import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import {API_BASE_URL} from './apiConfig';
import {ApiError, normalizeApiError} from './apiError';
import {isApiSuccess} from './apiTypes';

export const API_TIMEOUT_MS = 10_000;

const ACCESS_TOKEN_FREE_PATHS = new Set([
  '/auth/login-id/check',
  '/auth/signup',
  '/auth/login',
  '/auth/reissue',
]);

export interface ApiAuthSession {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  refreshAccessToken(): Promise<string>;
}

type AuthRequestConfig = InternalAxiosRequestConfig & {
  authRetry?: boolean;
};

let configuredAuthSession: ApiAuthSession | null = null;

export function configureApiAuthSession(
  authSession: ApiAuthSession | null,
): () => void {
  const previous = configuredAuthSession;
  configuredAuthSession = authSession;

  return () => {
    if (configuredAuthSession === authSession) {
      configuredAuthSession = previous;
    }
  };
}

export function createApiClient(
  baseURL = API_BASE_URL,
  authSession?: ApiAuthSession,
): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: API_TIMEOUT_MS,
  });

  const resolveAuthSession = () => authSession ?? configuredAuthSession;

  client.interceptors.request.use(config => {
    if (isAccessTokenFree(config)) {
      return config;
    }

    const authConfig = config as AuthRequestConfig;
    if (
      authConfig.authRetry === true &&
      config.headers.has('Authorization')
    ) {
      return config;
    }

    const accessToken = resolveAuthSession()?.getAccessToken();
    if (accessToken !== null && accessToken !== undefined) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return config;
  });

  client.interceptors.response.use(
    response => {
      if (response.status === 204 || isApiSuccess(response.data)) {
        return response;
      }

      return Promise.reject(
        new ApiError({
          code: 'INVALID_API_RESPONSE',
          kind: 'invalidResponse',
          message: '서버가 예상하지 못한 응답을 반환했습니다.',
          status: response.status,
        }),
      );
    },
    async error => {
      const apiError = normalizeApiError(error);
      const config = axios.isAxiosError(error)
        ? (error.config as AuthRequestConfig | undefined)
        : undefined;
      const session = resolveAuthSession();

      if (
        config === undefined ||
        config.authRetry === true ||
        isAccessTokenFree(config) ||
        session === null ||
        apiError.status !== 401 ||
        apiError.code !== 'UNAUTHORIZED'
      ) {
        return Promise.reject(apiError);
      }

      config.authRetry = true;
      try {
        const currentAccessToken = session.getAccessToken();
        const failedAccessToken = readBearerToken(config);
        const accessToken =
          currentAccessToken !== null &&
          failedAccessToken !== null &&
          currentAccessToken !== failedAccessToken
            ? currentAccessToken
            : await session.refreshAccessToken();
        updateAuthRetryBody(config, session);
        config.headers = AxiosHeaders.from(config.headers);
        config.headers.set('Authorization', `Bearer ${accessToken}`);
        return client.request(config);
      } catch (refreshError) {
        return Promise.reject(normalizeApiError(refreshError));
      }
    },
  );

  return client;
}

export const apiClient = createApiClient();

function isAccessTokenFree(config: InternalAxiosRequestConfig): boolean {
  const path = resolveRequestPath(config);
  return path !== null && ACCESS_TOKEN_FREE_PATHS.has(path);
}

function updateAuthRetryBody(
  config: AuthRequestConfig,
  session: ApiAuthSession,
): void {
  if (resolveRequestPath(config) !== '/auth/logout') {
    return;
  }

  const refreshToken = session.getRefreshToken();
  if (refreshToken === null) {
    throw new ApiError({
      code: 'AUTH_SESSION_UNAVAILABLE',
      kind: 'invalidResponse',
      message: '로그아웃에 필요한 인증 정보가 없습니다.',
    });
  }

  config.data = {refreshToken};
}

function resolveRequestPath(
  config: InternalAxiosRequestConfig,
): string | null {
  const url = config.url;
  if (url === undefined) {
    return null;
  }

  try {
    return new URL(url, config.baseURL ?? API_BASE_URL).pathname;
  } catch {
    return url.split('?')[0] ?? null;
  }
}

function readBearerToken(config: InternalAxiosRequestConfig): string | null {
  const authorization = AxiosHeaders.from(config.headers).get('Authorization');
  if (
    typeof authorization !== 'string' ||
    !authorization.startsWith('Bearer ')
  ) {
    return null;
  }

  const token = authorization.slice('Bearer '.length);
  return token.length > 0 ? token : null;
}
