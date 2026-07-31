import type {AxiosInstance} from 'axios';

import {ApiError} from '../../../shared/api';
import {
  createAuthGateway,
  type AuthGatewaySession,
} from './authGateway';

const NOW = 10_000;
const CREDENTIALS = {
  loginId: 'CaseSensitive1',
  password: 'password1',
};
const LOGIN_DATA = {
  accessToken: 'access-token',
  accessTokenExpiresIn: 1_800,
  refreshToken: 'refresh-token',
  tokenType: 'Bearer' as const,
  user: {
    id: 7,
    name: '이종철',
  },
};

function createClient(): {
  client: Pick<AxiosInstance, 'post'>;
  post: jest.Mock;
} {
  const post = jest.fn();
  return {
    client: {post} as Pick<AxiosInstance, 'post'>,
    post,
  };
}

function createSession(): jest.Mocked<AuthGatewaySession> {
  return {
    getAccessToken: jest.fn().mockReturnValue('access-token'),
    getRefreshToken: jest.fn().mockReturnValue('refresh-token'),
    saveSession: jest.fn().mockResolvedValue(undefined),
  };
}

describe('apiAuthGateway', () => {
  it('exposes the current access token to authenticated feature gateways', () => {
    const {client} = createClient();
    const session = createSession();
    const gateway = createAuthGateway(client, session, () => NOW);

    expect(gateway.getAccessToken?.()).toBe('access-token');
    expect(session.getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('stores a validated login session before returning the user', async () => {
    const {client, post} = createClient();
    const session = createSession();
    post.mockResolvedValueOnce({
      data: {
        data: LOGIN_DATA,
        message: '로그인 성공',
        success: true,
      },
      status: 200,
    });
    const gateway = createAuthGateway(client, session, () => NOW);

    await expect(gateway.login(CREDENTIALS)).resolves.toEqual({
      activeGroupId: null,
      id: 7,
      name: '이종철',
    });

    expect(post).toHaveBeenCalledWith('/auth/login', CREDENTIALS);
    expect(session.saveSession).toHaveBeenCalledWith(LOGIN_DATA, NOW);
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(
      session.saveSession.mock.invocationCallOrder[0],
    );
  });

  it('does not authenticate when the login session cannot be stored', async () => {
    const {client, post} = createClient();
    const session = createSession();
    const storageFailure = new Error('storage failed');
    post.mockResolvedValueOnce({
      data: {
        data: LOGIN_DATA,
        message: '로그인 성공',
        success: true,
      },
      status: 200,
    });
    session.saveSession.mockRejectedValueOnce(storageFailure);
    const gateway = createAuthGateway(client, session, () => NOW);

    await expect(gateway.login(CREDENTIALS)).rejects.toBe(storageFailure);
  });

  it('rejects a malformed login response without storing it', async () => {
    const {client, post} = createClient();
    const session = createSession();
    post.mockResolvedValueOnce({
      data: {
        data: {...LOGIN_DATA, user: {id: 7, name: ''}},
        message: '로그인 성공',
        success: true,
      },
      status: 200,
    });
    const gateway = createAuthGateway(client, session, () => NOW);

    await expect(gateway.login(CREDENTIALS)).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      status: 200,
    });
    expect(session.saveSession).not.toHaveBeenCalled();
  });

  it('propagates a login API failure without storing a session', async () => {
    const {client, post} = createClient();
    const session = createSession();
    const invalidCredentials = new ApiError({
      code: 'INVALID_CREDENTIALS',
      kind: 'server',
      message: '아이디 또는 비밀번호가 일치하지 않습니다.',
      status: 401,
    });
    post.mockRejectedValueOnce(invalidCredentials);
    const gateway = createAuthGateway(client, session, () => NOW);

    await expect(gateway.login(CREDENTIALS)).rejects.toBe(
      invalidCredentials,
    );
    expect(session.saveSession).not.toHaveBeenCalled();
  });

  it('sends the stored refresh token when logging out', async () => {
    const {client, post} = createClient();
    const session = createSession();
    post.mockResolvedValueOnce({data: undefined, status: 204});
    const gateway = createAuthGateway(client, session, () => NOW);

    await expect(gateway.logout()).resolves.toBeUndefined();

    expect(session.getRefreshToken).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/auth/logout', {
      refreshToken: 'refresh-token',
    });
  });

  it('skips the server logout when no local session remains', async () => {
    const {client, post} = createClient();
    const session = createSession();
    session.getRefreshToken.mockReturnValueOnce(null);
    const gateway = createAuthGateway(client, session, () => NOW);

    await expect(gateway.logout()).resolves.toBeUndefined();

    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a logout response that is not 204', async () => {
    const {client, post} = createClient();
    const session = createSession();
    post.mockResolvedValueOnce({
      data: {data: null, message: '로그아웃 성공', success: true},
      status: 200,
    });
    const gateway = createAuthGateway(client, session, () => NOW);

    await expect(gateway.logout()).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      status: 200,
    });
  });

  it('propagates a server logout failure to the caller', async () => {
    const {client, post} = createClient();
    const session = createSession();
    const unauthorized = new ApiError({
      code: 'UNAUTHORIZED',
      kind: 'server',
      message: '인증이 필요합니다.',
      status: 401,
    });
    post.mockRejectedValueOnce(unauthorized);
    const gateway = createAuthGateway(client, session, () => NOW);

    await expect(gateway.logout()).rejects.toBe(unauthorized);
  });
});
