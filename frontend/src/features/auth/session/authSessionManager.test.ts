import {ApiError} from '../../../shared/api';
import type {AuthTokenPairResponse} from '../api/authSessionApi';
import {
  AuthSessionManager,
  type LoginSessionInput,
} from './authSessionManager';
import {
  AUTH_SESSION_VERSION,
  AuthSessionStorageError,
  type AuthSessionRecord,
  type AuthSessionStore,
} from './authSessionStore';

const NOW = 10_000;
const USER = {id: 7, name: '이종철'};
const VALID_RECORD: AuthSessionRecord = {
  accessToken: 'old-access',
  accessTokenExpiresAt: NOW + 10_000,
  refreshToken: 'old-refresh',
  tokenType: 'Bearer',
  user: USER,
  version: AUTH_SESSION_VERSION,
};
const ROTATED_TOKENS: AuthTokenPairResponse = {
  accessToken: 'new-access',
  accessTokenExpiresIn: 1_800,
  refreshToken: 'new-refresh',
  tokenType: 'Bearer',
};

function createStore(
  record: AuthSessionRecord | null,
): jest.Mocked<AuthSessionStore> {
  return {
    clear: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(record),
    write: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AuthSessionManager', () => {
  it('restores a valid access token without reissuing', async () => {
    const store = createStore(VALID_RECORD);
    const reissue = jest.fn();
    const manager = new AuthSessionManager(store, reissue, () => NOW);

    await expect(manager.restore()).resolves.toEqual({
      status: 'authenticated',
      user: USER,
    });

    expect(manager.getAccessToken()).toBe('old-access');
    expect(reissue).not.toHaveBeenCalled();
  });

  it('reissues an expired token and replaces the complete record', async () => {
    const store = createStore({...VALID_RECORD, accessTokenExpiresAt: NOW});
    const reissue = jest.fn().mockResolvedValue(ROTATED_TOKENS);
    const manager = new AuthSessionManager(store, reissue, () => NOW);

    await expect(manager.restore()).resolves.toEqual({
      status: 'authenticated',
      user: USER,
    });

    expect(reissue).toHaveBeenCalledWith('old-refresh');
    expect(store.write).toHaveBeenCalledWith({
      accessToken: 'new-access',
      accessTokenExpiresAt: NOW + 1_800_000,
      refreshToken: 'new-refresh',
      tokenType: 'Bearer',
      user: USER,
      version: AUTH_SESSION_VERSION,
    });
    expect(manager.getAccessToken()).toBe('new-access');
  });

  it('keeps the stored session for retryable restore failures', async () => {
    const store = createStore({...VALID_RECORD, accessTokenExpiresAt: NOW});
    const networkError = new ApiError({
      code: 'NETWORK_ERROR',
      kind: 'network',
      message: 'network',
    });
    const manager = new AuthSessionManager(
      store,
      jest.fn().mockRejectedValue(networkError),
      () => NOW,
    );

    await expect(manager.restore()).resolves.toEqual({
      error: networkError,
      status: 'retryableError',
    });

    expect(store.clear).not.toHaveBeenCalled();
    expect(manager.getAccessToken()).toBe('old-access');
  });

  it('clears once and emits once for a definitive refresh failure', async () => {
    const store = createStore({...VALID_RECORD, accessTokenExpiresAt: NOW});
    const invalidRefresh = new ApiError({
      code: 'INVALID_REFRESH_TOKEN',
      kind: 'server',
      message: 'invalid',
      status: 401,
    });
    const manager = new AuthSessionManager(
      store,
      jest.fn().mockRejectedValue(invalidRefresh),
      () => NOW,
    );
    const listener = jest.fn();
    manager.subscribeAuthInvalidated(listener);

    await expect(manager.restore()).resolves.toEqual({status: 'signedOut'});

    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(invalidRefresh);
    expect(manager.getAccessToken()).toBeNull();
  });

  it('also invalidates a session rejected as an invalid reissue request', async () => {
    const store = createStore({...VALID_RECORD, accessTokenExpiresAt: NOW});
    const invalidRequest = new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'server',
      message: 'invalid',
      status: 400,
    });
    const manager = new AuthSessionManager(
      store,
      jest.fn().mockRejectedValue(invalidRequest),
      () => NOW,
    );
    const listener = jest.fn();
    manager.subscribeAuthInvalidated(listener);

    await expect(manager.restore()).resolves.toEqual({status: 'signedOut'});

    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(invalidRequest);
    expect(manager.getAccessToken()).toBeNull();
  });

  it('shares one reissue and one safe write across simultaneous refreshes', async () => {
    const store = createStore(VALID_RECORD);
    let resolveReissue!: (tokens: AuthTokenPairResponse) => void;
    const reissue = jest.fn(
      () =>
        new Promise<AuthTokenPairResponse>(resolve => {
          resolveReissue = resolve;
        }),
    );
    const manager = new AuthSessionManager(store, reissue, () => NOW);
    await manager.restore();

    const first = manager.refreshAccessToken();
    const second = manager.refreshAccessToken();
    resolveReissue(ROTATED_TOKENS);

    await expect(Promise.all([first, second])).resolves.toEqual([
      'new-access',
      'new-access',
    ]);
    expect(reissue).toHaveBeenCalledTimes(1);
    expect(store.write).toHaveBeenCalledTimes(1);
  });

  it('invalidates when a rotated token pair cannot be stored', async () => {
    const store = createStore({...VALID_RECORD, accessTokenExpiresAt: NOW});
    const writeFailure = new Error('write failed');
    store.write.mockRejectedValueOnce(writeFailure);
    const manager = new AuthSessionManager(
      store,
      jest.fn().mockResolvedValue(ROTATED_TOKENS),
      () => NOW,
    );
    const listener = jest.fn();
    manager.subscribeAuthInvalidated(listener);

    await expect(manager.restore()).resolves.toEqual({status: 'signedOut'});

    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.any(AuthSessionStorageError),
    );
  });

  it('does not persist an in-flight refresh after local logout', async () => {
    const store = createStore(VALID_RECORD);
    let resolveReissue!: (tokens: AuthTokenPairResponse) => void;
    const manager = new AuthSessionManager(
      store,
      jest.fn(
        () =>
          new Promise<AuthTokenPairResponse>(resolve => {
            resolveReissue = resolve;
          }),
      ),
      () => NOW,
    );
    await manager.restore();

    const refresh = manager.refreshAccessToken();
    await manager.clearLocalSession();
    resolveReissue(ROTATED_TOKENS);

    await expect(refresh).rejects.toThrow('인증 세션 작업이 취소되었습니다.');
    expect(store.write).not.toHaveBeenCalled();
    expect(manager.getAccessToken()).toBeNull();
  });

  it('stores login token expiry from the response receive time', async () => {
    const store = createStore(null);
    const manager = new AuthSessionManager(store, jest.fn(), () => NOW);
    const login: LoginSessionInput = {...ROTATED_TOKENS, user: USER};

    await manager.saveSession(login, NOW + 500);

    expect(store.write).toHaveBeenCalledWith(
      expect.objectContaining({
        accessTokenExpiresAt: NOW + 500 + 1_800_000,
        user: USER,
      }),
    );
    expect(manager.getRefreshToken()).toBe('new-refresh');
  });
});
