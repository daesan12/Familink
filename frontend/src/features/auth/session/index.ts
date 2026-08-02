import {configureApiAuthSession} from '../../../shared/api';
import {reissueAuthTokenPair} from '../api/authSessionApi';
import {AuthSessionManager} from './authSessionManager';
import {KeychainAuthSessionStore} from './authSessionStore';

export const authSessionManager = new AuthSessionManager(
  new KeychainAuthSessionStore(),
  reissueAuthTokenPair,
);

configureApiAuthSession(authSessionManager);

export {
  AuthSessionManager,
  type AuthRestoreResult,
  type AuthSessionCoordinator,
  type LoginSessionInput,
  type SaveSessionOptions,
} from './authSessionManager';
export {
  AUTH_SESSION_SERVICE,
  AUTH_SESSION_VERSION,
  AuthSessionStorageError,
  KeychainAuthSessionStore,
  type AuthSessionRecord,
  type AuthSessionStore,
  type AuthSessionUser,
} from './authSessionStore';
