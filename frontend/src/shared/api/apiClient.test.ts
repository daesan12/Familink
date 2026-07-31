jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    API_BASE_URL: 'http://10.0.2.2:8080',
  },
}));

import type {AxiosAdapter, AxiosResponse} from 'axios';

import {API_TIMEOUT_MS, createApiClient} from './apiClient';
import {ApiError} from './apiError';

function createAdapter(
  data: unknown,
  status = 200,
): AxiosAdapter {
  return async config =>
    ({
      config,
      data,
      headers: {},
      status,
      statusText: status === 204 ? 'No Content' : 'OK',
    }) satisfies AxiosResponse;
}

test('공통 Axios 설정을 적용한다', async () => {
  const client = createApiClient('https://api.example.com');
  let acceptHeader: unknown;
  let contentTypeHeader: unknown;

  expect(client.defaults.baseURL).toBe('https://api.example.com');
  expect(client.defaults.timeout).toBe(API_TIMEOUT_MS);

  await client.get('/configuration', {
    adapter: async config => {
      acceptHeader = config.headers.get('Accept');
      contentTypeHeader = config.headers.get('Content-Type');

      return {
        config,
        data: {data: {}, message: '설정 확인 성공', success: true},
        headers: {},
        status: 200,
        statusText: 'OK',
      };
    },
  });

  expect(acceptHeader).toBe('application/json');
  expect(contentTypeHeader).toBe('application/json');
});

test('계약에 맞는 성공 응답과 204 응답을 통과시킨다', async () => {
  const client = createApiClient();
  const success = await client.get('/auth/login-id/check', {
    adapter: createAdapter({
      data: {available: true},
      message: '로그인 아이디 중복 확인 성공',
      success: true,
    }),
  });
  const noContent = await client.post('/auth/logout', undefined, {
    adapter: createAdapter(undefined, 204),
  });

  expect(success.data).toMatchObject({success: true});
  expect(noContent.status).toBe(204);
});

test('계약과 다른 성공 응답을 거부한다', async () => {
  const client = createApiClient();

  await expect(
    client.get('/unexpected', {
      adapter: createAdapter({data: {available: true}}),
    }),
  ).rejects.toMatchObject<Partial<ApiError>>({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    status: 200,
  });
});

test('네트워크 실패를 공통 오류로 변환한다', async () => {
  const client = createApiClient();
  const adapter: AxiosAdapter = async () => {
    throw {isAxiosError: true};
  };

  await expect(
    client.get('/network-error', {adapter}),
  ).rejects.toMatchObject<Partial<ApiError>>({
    code: 'NETWORK_ERROR',
    kind: 'network',
  });
});
