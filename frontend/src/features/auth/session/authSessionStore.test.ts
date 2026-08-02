import * as Keychain from 'react-native-keychain';

import {
  AUTH_SESSION_SERVICE,
  AUTH_SESSION_VERSION,
  AuthSessionStorageError,
  KeychainAuthSessionStore,
  type AuthSessionRecord,
} from './authSessionStore';

const getGenericPassword = jest.mocked(Keychain.getGenericPassword);
const resetGenericPassword = jest.mocked(Keychain.resetGenericPassword);
const setGenericPassword = jest.mocked(Keychain.setGenericPassword);

const RECORD: AuthSessionRecord = {
  accessToken: 'access-token',
  accessTokenExpiresAt: 2_000,
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  user: {id: 7, name: '이종철'},
  version: AUTH_SESSION_VERSION,
};

describe('KeychainAuthSessionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getGenericPassword.mockResolvedValue(false);
    resetGenericPassword.mockResolvedValue(true);
    setGenericPassword.mockResolvedValue({
      service: AUTH_SESSION_SERVICE,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
  });

  it('stores the complete versioned session with Android Keystore storage', async () => {
    const store = new KeychainAuthSessionStore();

    await store.write(RECORD);

    expect(setGenericPassword).toHaveBeenCalledWith(
      'auth-session',
      JSON.stringify(RECORD),
      {
        service: AUTH_SESSION_SERVICE,
        storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      },
    );
  });

  it('reads a valid session and returns null when none exists', async () => {
    const store = new KeychainAuthSessionStore();
    await expect(store.read()).resolves.toBeNull();

    getGenericPassword.mockResolvedValueOnce({
      password: JSON.stringify(RECORD),
      service: AUTH_SESSION_SERVICE,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      username: 'auth-session',
    });

    await expect(store.read()).resolves.toEqual(RECORD);
  });

  it.each([
    'not-json',
    JSON.stringify({...RECORD, version: 2}),
    JSON.stringify({...RECORD, accessToken: ''}),
    JSON.stringify({...RECORD, user: {...RECORD.user, id: '7'}}),
  ])('clears malformed or unsupported records', async password => {
    getGenericPassword.mockResolvedValueOnce({
      password,
      service: AUTH_SESSION_SERVICE,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      username: 'auth-session',
    });
    const store = new KeychainAuthSessionStore();

    await expect(store.read()).resolves.toBeNull();

    expect(resetGenericPassword).toHaveBeenCalledWith({
      service: AUTH_SESSION_SERVICE,
    });
  });

  it('surfaces secure storage write and delete failures', async () => {
    const store = new KeychainAuthSessionStore();
    setGenericPassword.mockResolvedValueOnce(false);
    await expect(store.write(RECORD)).rejects.toBeInstanceOf(
      AuthSessionStorageError,
    );

    resetGenericPassword.mockResolvedValueOnce(false);
    await expect(store.clear()).rejects.toBeInstanceOf(
      AuthSessionStorageError,
    );
  });
});
