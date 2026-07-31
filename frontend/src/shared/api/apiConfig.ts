import Config from 'react-native-config';

import {ApiError} from './apiError';

export function resolveApiBaseUrl(
  value: string | undefined,
  isDevelopment: boolean,
): string {
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0) {
    throw new ApiError({
      code: 'API_CONFIGURATION_ERROR',
      kind: 'configuration',
      message: 'API_BASE_URL 환경변수가 설정되지 않았습니다.',
    });
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new ApiError({
      code: 'API_CONFIGURATION_ERROR',
      kind: 'configuration',
      message: 'API_BASE_URL은 올바른 HTTP 또는 HTTPS URL이어야 합니다.',
    });
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new ApiError({
      code: 'API_CONFIGURATION_ERROR',
      kind: 'configuration',
      message: 'API_BASE_URL은 HTTP 또는 HTTPS 프로토콜만 사용할 수 있습니다.',
    });
  }

  if (
    parsedUrl.username.length > 0 ||
    parsedUrl.password.length > 0 ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search.length > 0 ||
    parsedUrl.hash.length > 0
  ) {
    throw new ApiError({
      code: 'API_CONFIGURATION_ERROR',
      kind: 'configuration',
      message: 'API_BASE_URL에는 인증정보, 경로, 쿼리 또는 해시를 포함할 수 없습니다.',
    });
  }

  if (!isDevelopment && parsedUrl.protocol !== 'https:') {
    throw new ApiError({
      code: 'API_CONFIGURATION_ERROR',
      kind: 'configuration',
      message: '배포 환경의 API_BASE_URL은 HTTPS를 사용해야 합니다.',
    });
  }

  return parsedUrl.origin;
}

export const API_BASE_URL = resolveApiBaseUrl(
  Config.API_BASE_URL,
  __DEV__,
);
