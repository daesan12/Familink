import * as Keychain from 'react-native-keychain';

export const AUTH_SESSION_VERSION = 1 as const;
export const AUTH_SESSION_SERVICE = 'com.s15p11b104app.auth-session';

const AUTH_SESSION_USERNAME = 'auth-session';

export interface AuthSessionUser {
  id: number;
  name: string;
}

export interface AuthSessionRecord {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  tokenType: 'Bearer';
  user: AuthSessionUser;
  version: typeof AUTH_SESSION_VERSION;
}

export interface AuthSessionStore {
  clear(): Promise<void>;
  read(): Promise<AuthSessionRecord | null>;
  write(record: AuthSessionRecord): Promise<void>;
}

export class AuthSessionStorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AuthSessionStorageError';
    this.cause = cause;
  }
}

export class KeychainAuthSessionStore implements AuthSessionStore {
  async read(): Promise<AuthSessionRecord | null> {
    const credentials = await Keychain.getGenericPassword({
      service: AUTH_SESSION_SERVICE,
    });
    if (credentials === false) {
      return null;
    }

    if (credentials.username !== AUTH_SESSION_USERNAME) {
      await this.clear();
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(credentials.password);
    } catch {
      await this.clear();
      return null;
    }

    if (!isAuthSessionRecord(parsed)) {
      await this.clear();
      return null;
    }
    return parsed;
  }

  async write(record: AuthSessionRecord): Promise<void> {
    const result = await Keychain.setGenericPassword(
      AUTH_SESSION_USERNAME,
      JSON.stringify(record),
      {
        service: AUTH_SESSION_SERVICE,
        storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      },
    );
    if (result === false) {
      throw new AuthSessionStorageError('인증 세션을 안전하게 저장하지 못했습니다.');
    }
  }

  async clear(): Promise<void> {
    const cleared = await Keychain.resetGenericPassword({
      service: AUTH_SESSION_SERVICE,
    });
    if (!cleared) {
      throw new AuthSessionStorageError('인증 세션을 안전하게 삭제하지 못했습니다.');
    }
  }
}

function isAuthSessionRecord(value: unknown): value is AuthSessionRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.version === AUTH_SESSION_VERSION &&
    record.tokenType === 'Bearer' &&
    isNonEmptyString(record.accessToken) &&
    typeof record.accessTokenExpiresAt === 'number' &&
    Number.isFinite(record.accessTokenExpiresAt) &&
    record.accessTokenExpiresAt > 0 &&
    isNonEmptyString(record.refreshToken) &&
    isAuthSessionUser(record.user)
  );
}

function isAuthSessionUser(value: unknown): value is AuthSessionUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'number' &&
    Number.isSafeInteger(user.id) &&
    user.id > 0 &&
    isNonEmptyString(user.name)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
