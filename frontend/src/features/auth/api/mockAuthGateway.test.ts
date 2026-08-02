import {
  InvalidCredentialsError,
  MOCK_LOGIN_CREDENTIALS,
  mockAuthGateway,
} from './mockAuthGateway';

describe('mockAuthGateway', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a mock user for the documented credentials', async () => {
    const login = mockAuthGateway.login(MOCK_LOGIN_CREDENTIALS);

    await jest.runAllTimersAsync();

    await expect(login).resolves.toEqual({
      activeGroupId: null,
      id: 1,
      name: '이종철',
    });
  });

  it('rejects other valid-format credentials as a login failure', async () => {
    let failure: unknown;
    const login = mockAuthGateway.login({
      loginId: 'wrong1',
      password: 'wrongpass1',
    }).catch(error => {
      failure = error;
    });

    await jest.runAllTimersAsync();
    await login;

    expect(failure).toBeInstanceOf(InvalidCredentialsError);
  });
});
