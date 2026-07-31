jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    API_BASE_URL: 'http://10.0.2.2:8080',
  },
}));

import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import {
  API_TIMEOUT_MS,
  createApiClient,
  type ApiAuthSession,
} from './apiClient';
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

test('보호 요청에만 현재 Access Token을 첨부한다', async () => {
  const authSession: ApiAuthSession = {
    getAccessToken: jest.fn().mockReturnValue('access-token'),
    refreshAccessToken: jest.fn(),
  };
  const client = createApiClient('https://api.example.com', authSession);
  const authorizationHeaders: unknown[] = [];
  const adapter: AxiosAdapter = async config => {
    authorizationHeaders.push(config.headers.get('Authorization'));
    return {
      config,
      data: {data: {}, message: '성공', success: true},
      headers: {},
      status: 200,
      statusText: 'OK',
    };
  };

  await client.get('/notifications', {adapter});
  await client.post('/auth/logout', {}, {adapter});
  await client.post('/auth/login', {}, {adapter});
  await client.post('/auth/reissue', {}, {adapter});

  expect(authorizationHeaders).toEqual([
    'Bearer access-token',
    'Bearer access-token',
    undefined,
    undefined,
  ]);
});

test('보호 API의 401만 재발급 후 새 토큰으로 한 번 재시도한다', async () => {
  const authSession: ApiAuthSession = {
    getAccessToken: jest.fn().mockReturnValue('old-access'),
    refreshAccessToken: jest.fn().mockResolvedValue('new-access'),
  };
  const client = createApiClient('https://api.example.com', authSession);
  const seenHeaders: unknown[] = [];
  const adapter: AxiosAdapter = async config => {
    const authorization = config.headers.get('Authorization');
    seenHeaders.push(authorization);
    if (authorization !== 'Bearer new-access') {
      throwApiFailure(config, 401, 'UNAUTHORIZED');
    }
    return {
      config,
      data: {data: {ok: true}, message: '성공', success: true},
      headers: {},
      status: 200,
      statusText: 'OK',
    };
  };

  await expect(client.get('/notifications', {adapter})).resolves.toMatchObject({
    status: 200,
  });

  expect(authSession.refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(seenHeaders).toEqual([
    'Bearer old-access',
    'Bearer new-access',
  ]);
});

test('403과 공개 인증 API의 401에는 재발급하지 않는다', async () => {
  const authSession: ApiAuthSession = {
    getAccessToken: jest.fn().mockReturnValue('access-token'),
    refreshAccessToken: jest.fn(),
  };
  const client = createApiClient('https://api.example.com', authSession);
  const forbidden: AxiosAdapter = async config => {
    throwApiFailure(config, 403, 'FORBIDDEN');
  };
  const invalidCredentials: AxiosAdapter = async config => {
    throwApiFailure(config, 401, 'INVALID_CREDENTIALS');
  };

  await expect(
    client.get('/notifications', {adapter: forbidden}),
  ).rejects.toMatchObject({code: 'FORBIDDEN', status: 403});
  await expect(
    client.post('/auth/login', {}, {adapter: invalidCredentials}),
  ).rejects.toMatchObject({code: 'INVALID_CREDENTIALS', status: 401});
  expect(authSession.refreshAccessToken).not.toHaveBeenCalled();
});

test('재시도 요청의 두 번째 401은 다시 재발급하지 않는다', async () => {
  const authSession: ApiAuthSession = {
    getAccessToken: jest.fn().mockReturnValue('old-access'),
    refreshAccessToken: jest.fn().mockResolvedValue('new-access'),
  };
  const client = createApiClient('https://api.example.com', authSession);
  let requestCount = 0;
  const adapter: AxiosAdapter = async config => {
    requestCount += 1;
    throwApiFailure(config, 401, 'UNAUTHORIZED');
  };

  await expect(
    client.get('/notifications', {adapter}),
  ).rejects.toMatchObject({code: 'UNAUTHORIZED', status: 401});

  expect(requestCount).toBe(2);
  expect(authSession.refreshAccessToken).toHaveBeenCalledTimes(1);
});

test('늦게 도착한 동시 401은 이미 갱신된 토큰으로 재시도한다', async () => {
  let accessToken = 'old-access';
  let resolveSecondRequest!: () => void;
  let resolveRefresh!: () => void;
  const secondRequestStarted = new Promise<void>(resolve => {
    resolveSecondRequest = resolve;
  });
  const refreshFinished = new Promise<void>(resolve => {
    resolveRefresh = resolve;
  });
  const authSession: ApiAuthSession = {
    getAccessToken: jest.fn(() => accessToken),
    refreshAccessToken: jest.fn(async () => {
      accessToken = 'new-access';
      resolveRefresh();
      return accessToken;
    }),
  };
  const client = createApiClient('https://api.example.com', authSession);
  const seenHeaders: unknown[] = [];
  const adapter: AxiosAdapter = async config => {
    const authorization = config.headers.get('Authorization');
    seenHeaders.push(authorization);
    if (authorization === 'Bearer new-access') {
      return {
        config,
        data: {data: {ok: true}, message: '성공', success: true},
        headers: {},
        status: 200,
        statusText: 'OK',
      };
    }

    if (config.url === '/notifications/first') {
      await secondRequestStarted;
    } else {
      resolveSecondRequest();
      await refreshFinished;
    }
    throwApiFailure(config, 401, 'UNAUTHORIZED');
  };

  await expect(
    Promise.all([
      client.get('/notifications/first', {adapter}),
      client.get('/notifications/second', {adapter}),
    ]),
  ).resolves.toHaveLength(2);

  expect(authSession.refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(seenHeaders).toEqual([
    'Bearer old-access',
    'Bearer old-access',
    'Bearer new-access',
    'Bearer new-access',
  ]);
});

function throwApiFailure(
  config: InternalAxiosRequestConfig,
  status: number,
  code: string,
): never {
  throw {
    config,
    isAxiosError: true,
    response: {
      config,
      data: {
        code,
        errors: [],
        message: code,
        success: false,
      },
      headers: {},
      status,
      statusText: 'Error',
    },
  };
}
