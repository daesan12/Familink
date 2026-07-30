import type {
  AuthenticatedUser,
  AuthGateway,
  LoginCredentials,
} from '../types';

const MOCK_DELAY_MS = 350;

export const MOCK_LOGIN_CREDENTIALS: LoginCredentials = {
  loginId: 'familink',
  password: 'familink123',
};

const MOCK_USER: AuthenticatedUser = {
  activeGroupId: null,
  id: 'mock-user-1',
  name: '이종철',
};

function wait(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, MOCK_DELAY_MS));
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('아이디 또는 비밀번호가 일치하지 않습니다.');
    this.name = 'InvalidCredentialsError';
  }
}

export const mockAuthGateway: AuthGateway = {
  async login(credentials) {
    await wait();

    if (
      credentials.loginId !== MOCK_LOGIN_CREDENTIALS.loginId ||
      credentials.password !== MOCK_LOGIN_CREDENTIALS.password
    ) {
      throw new InvalidCredentialsError();
    }

    return MOCK_USER;
  },
  async logout() {
    await wait();
  },
};
