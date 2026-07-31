import axios, {type AxiosInstance} from 'axios';

import {API_BASE_URL} from './apiConfig';
import {ApiError, normalizeApiError} from './apiError';
import {isApiSuccess} from './apiTypes';

export const API_TIMEOUT_MS = 10_000;

export function createApiClient(baseURL = API_BASE_URL): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: API_TIMEOUT_MS,
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
    error => Promise.reject(normalizeApiError(error)),
  );

  return client;
}

export const apiClient = createApiClient();
