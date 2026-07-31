import {ApiError, type ApiAuthSession} from '../../../shared/api';
import type {AuthTokenPairResponse} from '../api/authSessionApi';
import {
  AUTH_SESSION_VERSION,
  AuthSessionStorageError,
  type AuthSessionRecord,
  type AuthSessionStore,
  type AuthSessionUser,
} from './authSessionStore';

export type AuthRestoreResult =
  | {status: 'authenticated'; user: AuthSessionUser}
  | {status: 'retryableError'; error: unknown}
  | {status: 'signedOut'};

export interface LoginSessionInput extends AuthTokenPairResponse {
  user: AuthSessionUser;
}

export interface AuthSessionCoordinator {
  clearLocalSession(): Promise<void>;
  restore(): Promise<AuthRestoreResult>;
  subscribeAuthInvalidated(listener: AuthInvalidatedListener): () => void;
}

type AuthInvalidatedListener = (reason: unknown) => void;
type ReissueAuthTokenPair = (
  refreshToken: string,
) => Promise<AuthTokenPairResponse>;

class AuthSessionUnavailableError extends Error {
  constructor() {
    super('사용 가능한 인증 세션이 없습니다.');
    this.name = 'AuthSessionUnavailableError';
  }
}

class AuthSessionCancelledError extends Error {
  constructor() {
    super('인증 세션 작업이 취소되었습니다.');
    this.name = 'AuthSessionCancelledError';
  }
}

export class AuthSessionManager
  implements ApiAuthSession, AuthSessionCoordinator
{
  private currentSession: AuthSessionRecord | null = null;
  private generation = 0;
  private invalidationHandled = false;
  private readonly invalidatedListeners = new Set<AuthInvalidatedListener>();
  private persistenceQueue: Promise<void> = Promise.resolve();
  private refreshInFlight: Promise<string> | null = null;

  constructor(
    private readonly store: AuthSessionStore,
    private readonly reissue: ReissueAuthTokenPair,
    private readonly now: () => number = Date.now,
  ) {}

  getAccessToken(): string | null {
    return this.currentSession?.accessToken ?? null;
  }

  getRefreshToken(): string | null {
    return this.currentSession?.refreshToken ?? null;
  }

  async saveSession(
    input: LoginSessionInput,
    receivedAt = this.now(),
  ): Promise<void> {
    const generation = ++this.generation;
    this.invalidationHandled = false;
    const record = createRecord(input, input.user, receivedAt);

    try {
      await this.runPersistence(() => this.store.write(record));
      if (this.generation !== generation) {
        throw new AuthSessionCancelledError();
      }
      this.currentSession = record;
    } catch (error) {
      if (error instanceof AuthSessionCancelledError) {
        throw error;
      }
      const storageError = toStorageError(
        '인증 세션을 안전하게 저장하지 못했습니다.',
        error,
      );
      await this.invalidate(storageError);
      throw storageError;
    }
  }

  async restore(): Promise<AuthRestoreResult> {
    let stored: AuthSessionRecord | null;
    try {
      stored = await this.runPersistence(() => this.store.read());
    } catch (error) {
      return {error, status: 'retryableError'};
    }

    if (stored === null) {
      this.currentSession = null;
      this.invalidationHandled = false;
      return {status: 'signedOut'};
    }

    this.currentSession = stored;
    this.invalidationHandled = false;
    if (stored.accessTokenExpiresAt > this.now()) {
      return {status: 'authenticated', user: stored.user};
    }

    try {
      await this.refreshAccessToken();
      const user = this.currentSession?.user;
      return user === undefined
        ? {status: 'signedOut'}
        : {status: 'authenticated', user};
    } catch (error) {
      if (this.invalidationHandled) {
        return {status: 'signedOut'};
      }
      return {error, status: 'retryableError'};
    }
  }

  refreshAccessToken(): Promise<string> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }

    const refresh = this.performRefresh().finally(() => {
      if (this.refreshInFlight === refresh) {
        this.refreshInFlight = null;
      }
    });
    this.refreshInFlight = refresh;
    return refresh;
  }

  async clearLocalSession(): Promise<void> {
    ++this.generation;
    this.currentSession = null;
    this.invalidationHandled = false;

    try {
      await this.runPersistence(() => this.store.clear());
    } catch (error) {
      const storageError = toStorageError(
        '인증 세션을 안전하게 삭제하지 못했습니다.',
        error,
      );
      this.invalidationHandled = true;
      this.emitInvalidated(storageError);
      throw storageError;
    }
  }

  subscribeAuthInvalidated(listener: AuthInvalidatedListener): () => void {
    this.invalidatedListeners.add(listener);
    return () => this.invalidatedListeners.delete(listener);
  }

  private async performRefresh(): Promise<string> {
    const generation = this.generation;
    let session = this.currentSession;
    if (session === null) {
      session = await this.runPersistence(() => this.store.read());
      if (this.generation !== generation) {
        throw new AuthSessionCancelledError();
      }
      this.currentSession = session;
    }

    if (session === null) {
      const error = new AuthSessionUnavailableError();
      await this.invalidate(error);
      throw error;
    }

    let response: AuthTokenPairResponse;
    try {
      response = await this.reissue(session.refreshToken);
    } catch (error) {
      if (this.generation !== generation) {
        throw new AuthSessionCancelledError();
      }
      if (isDefinitiveReissueFailure(error)) {
        await this.invalidate(error);
      }
      throw error;
    }

    if (this.generation !== generation) {
      throw new AuthSessionCancelledError();
    }

    const next = createRecord(response, session.user, this.now());
    try {
      await this.runPersistence(() => this.store.write(next));
    } catch (error) {
      const storageError = toStorageError(
        '재발급된 인증 세션을 안전하게 저장하지 못했습니다.',
        error,
      );
      await this.invalidate(storageError);
      throw storageError;
    }

    if (this.generation !== generation) {
      throw new AuthSessionCancelledError();
    }
    this.currentSession = next;
    this.invalidationHandled = false;
    return next.accessToken;
  }

  private async invalidate(reason: unknown): Promise<void> {
    if (this.invalidationHandled) {
      return;
    }

    this.invalidationHandled = true;
    ++this.generation;
    this.currentSession = null;
    let clearFailure: unknown;
    try {
      await this.runPersistence(() => this.store.clear());
    } catch (error) {
      clearFailure = error;
    } finally {
      this.emitInvalidated(reason);
    }

    if (clearFailure !== undefined) {
      throw toStorageError(
        '무효한 인증 세션을 안전하게 삭제하지 못했습니다.',
        clearFailure,
      );
    }
  }

  private emitInvalidated(reason: unknown): void {
    this.invalidatedListeners.forEach(listener => {
      try {
        listener(reason);
      } catch {
        // 한 구독자의 오류가 다른 인증 상태 정리를 막지 않게 한다.
      }
    });
  }

  private runPersistence<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.persistenceQueue.then(operation, operation);
    this.persistenceQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function createRecord(
  tokens: AuthTokenPairResponse,
  user: AuthSessionUser,
  receivedAt: number,
): AuthSessionRecord {
  return {
    accessToken: tokens.accessToken,
    accessTokenExpiresAt:
      receivedAt + tokens.accessTokenExpiresIn * 1_000,
    refreshToken: tokens.refreshToken,
    tokenType: tokens.tokenType,
    user,
    version: AUTH_SESSION_VERSION,
  };
}

function isDefinitiveReissueFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ((error.status === 400 && error.code === 'INVALID_REQUEST') ||
      (error.status === 401 && error.code === 'INVALID_REFRESH_TOKEN'))
  );
}

function toStorageError(
  message: string,
  cause: unknown,
): AuthSessionStorageError {
  return cause instanceof AuthSessionStorageError
    ? cause
    : new AuthSessionStorageError(message, cause);
}
