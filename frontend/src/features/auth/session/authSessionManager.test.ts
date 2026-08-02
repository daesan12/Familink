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

  it('clears a login record when its request is aborted during persistence', async () => {
    const store = createStore(null);
    const controller = new AbortController();
    let resolveWrite!: () => void;
    let markWriteStarted!: () => void;
    const writeStarted = new Promise<void>(resolve => {
      markWriteStarted = resolve;
    });
    store.write.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveWrite = resolve;
          markWriteStarted();
        }),
    );
    const manager = new AuthSessionManager(store, jest.fn(), () => NOW);
    const login: LoginSessionInput = {...ROTATED_TOKENS, user: USER};

    const saving = manager.saveSession(login, NOW, {
      signal: controller.signal,
    });
    await writeStarted;
    controller.abort();
    resolveWrite();

    await expect(saving).rejects.toMatchObject({
      name: 'AuthSessionCancelledError',
    });
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(manager.getAccessToken()).toBeNull();
  });

  it('clears a login record when its request is aborted after persistence', async () => {
    const store = createStore(null);
    const controller = new AbortController();
    let markCleared!: () => void;
    const cleared = new Promise<void>(resolve => {
      markCleared = resolve;
    });
    store.clear.mockImplementationOnce(async () => {
      markCleared();
    });
    const manager = new AuthSessionManager(store, jest.fn(), () => NOW);
    const login: LoginSessionInput = {...ROTATED_TOKENS, user: USER};

    await manager.saveSession(login, NOW, {signal: controller.signal});
    expect(manager.getAccessToken()).toBe('new-access');

    controller.abort();
    await cleared;

    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(manager.getAccessToken()).toBeNull();
  });

  it('keeps the newest login record when an older save is aborted', async () => {
    const store = createStore(null);
    const controller = new AbortController();
    let persisted: AuthSessionRecord | null = null;
    let resolveFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    const firstWriteStarted = new Promise<void>(resolve => {
      markFirstWriteStarted = resolve;
    });
    store.write
      .mockImplementationOnce(
        record =>
          new Promise<void>(resolve => {
            resolveFirstWrite = () => {
              persisted = record;
              resolve();
            };
            markFirstWriteStarted();
          }),
      )
      .mockImplementationOnce(async record => {
        persisted = record;
      });
    store.clear.mockImplementation(async () => {
      persisted = null;
    });
    const manager = new AuthSessionManager(store, jest.fn(), () => NOW);
    const firstLogin: LoginSessionInput = {
      ...ROTATED_TOKENS,
      accessToken: 'first-access',
      refreshToken: 'first-refresh',
      user: {id: 1, name: '이전 사용자'},
    };
    const latestLogin: LoginSessionInput = {
      ...ROTATED_TOKENS,
      accessToken: 'latest-access',
      refreshToken: 'latest-refresh',
      user: {id: 2, name: '최신 사용자'},
    };

    const firstSaving = manager.saveSession(firstLogin, NOW, {
      signal: controller.signal,
    });
    await firstWriteStarted;
    controller.abort();
    const latestSaving = manager.saveSession(latestLogin, NOW + 1);
    resolveFirstWrite();

    await expect(firstSaving).rejects.toMatchObject({
      name: 'AuthSessionCancelledError',
    });
    await expect(latestSaving).resolves.toBeUndefined();
    expect(store.clear).not.toHaveBeenCalled();
    expect(persisted).toEqual(
      expect.objectContaining({
        accessToken: 'latest-access',
        refreshToken: 'latest-refresh',
        user: latestLogin.user,
      }),
    );
    expect(manager.getAccessToken()).toBe('latest-access');
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
