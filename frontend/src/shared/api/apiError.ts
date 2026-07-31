import axios from 'axios';

import {isApiFailure, type ApiFieldError} from './apiTypes';

export type ApiErrorKind =
  | 'configuration'
  | 'invalidResponse'
  | 'network'
  | 'server'
  | 'timeout';

interface ApiErrorOptions {
  code: string;
  errors?: readonly ApiFieldError[];
  kind: ApiErrorKind;
  message: string;
  originalError?: unknown;
  status?: number;
}

export class ApiError extends Error {
  readonly code: string;
  readonly errors: readonly ApiFieldError[];
  readonly kind: ApiErrorKind;
  readonly originalError?: unknown;
  readonly status?: number;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.errors = options.errors ?? [];
    this.kind = options.kind;
    this.originalError = options.originalError;
    this.status = options.status;
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      message: 'API 응답을 처리하지 못했습니다.',
      originalError: error,
    });
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError({
      code: 'API_TIMEOUT',
      kind: 'timeout',
      message: '요청 시간이 초과되었습니다.',
      originalError: error,
    });
  }

  if (error.response === undefined) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      kind: 'network',
      message: '네트워크 연결을 확인해 주세요.',
      originalError: error,
    });
  }

  if (isApiFailure(error.response.data)) {
    return new ApiError({
      code: error.response.data.code,
      errors: error.response.data.errors,
      kind: 'server',
      message: error.response.data.message,
      originalError: error,
      status: error.response.status,
    });
  }

  return new ApiError({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    message: '서버가 예상하지 못한 응답을 반환했습니다.',
    originalError: error,
    status: error.response.status,
  });
}
