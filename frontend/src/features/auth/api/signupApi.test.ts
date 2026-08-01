import type {AxiosInstance} from 'axios';

import {ApiError} from '../../../shared/api';
import {
  createSignupGateway,
  type SignupHttpClient,
  type SignupInput,
} from './signupApi';

const SIGNUP_INPUT: SignupInput = {
  birthDate: '1995-03-17',
  gender: 'MALE',
  loginId: 'CaseUser1',
  name: '이경호',
  password: 'password123',
};

function createClient(): {
  client: SignupHttpClient;
  get: jest.Mock;
  post: jest.Mock;
} {
  const get = jest.fn();
  const post = jest.fn();
  return {
    client: {get, post} as Pick<AxiosInstance, 'get' | 'post'>,
    get,
    post,
  };
}

describe('signupGateway', () => {
  it('sends the login ID as a query and returns its availability', async () => {
    const {client, get} = createClient();
    get.mockResolvedValueOnce({
      data: {
        data: {available: true},
        message: '로그인 아이디 중복 확인 성공',
        success: true,
      },
      status: 200,
    });
    const gateway = createSignupGateway(client);

    await expect(
      gateway.checkLoginIdAvailability('CaseUser1'),
    ).resolves.toBe(true);

    expect(get).toHaveBeenCalledWith('/auth/login-id/check', {
      params: {loginId: 'CaseUser1'},
    });
  });

  it('keeps an unavailable login ID as a successful false result', async () => {
    const {client, get} = createClient();
    get.mockResolvedValueOnce({
      data: {
        data: {available: false},
        message: '로그인 아이디 중복 확인 성공',
        success: true,
      },
      status: 200,
    });
    const gateway = createSignupGateway(client);

    await expect(
      gateway.checkLoginIdAvailability('CaseUser1'),
    ).resolves.toBe(false);
  });

  it('sends only the signup contract fields and parses the created account', async () => {
    const {client, post} = createClient();
    post.mockResolvedValueOnce({
      data: {
        data: {
          createdAt: '2026-08-01T00:00:00Z',
          loginId: 'CaseUser1',
          name: '이경호',
          userId: 7,
        },
        message: '회원가입 성공',
        success: true,
      },
      status: 201,
    });
    const gateway = createSignupGateway(client);

    await expect(gateway.signup(SIGNUP_INPUT)).resolves.toEqual({
      createdAt: '2026-08-01T00:00:00Z',
      loginId: 'CaseUser1',
      name: '이경호',
      userId: 7,
    });

    expect(post).toHaveBeenCalledWith('/auth/signup', SIGNUP_INPUT);
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('passwordConfirmation');
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('profileImageUri');
  });

  it.each([
    [
      'an unexpected status',
      {
        data: {
          data: {available: true},
          message: '로그인 아이디 중복 확인 성공',
          success: true,
        },
        status: 201,
      },
    ],
    [
      'a malformed availability payload',
      {
        data: {
          data: {available: 'yes'},
          message: '로그인 아이디 중복 확인 성공',
          success: true,
        },
        status: 200,
      },
    ],
  ])('rejects %s', async (_label, response) => {
    const {client, get} = createClient();
    get.mockResolvedValueOnce(response);
    const gateway = createSignupGateway(client);

    await expect(
      gateway.checkLoginIdAvailability('CaseUser1'),
    ).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it.each([
    ['an unexpected status', 200, 'CaseUser1'],
    ['a mismatched case-sensitive login ID', 201, 'caseuser1'],
    ['an invalid created timestamp', 201, 'CaseUser1'],
  ])('rejects %s in a signup response', async (label, status, loginId) => {
    const {client, post} = createClient();
    post.mockResolvedValueOnce({
      data: {
        data: {
          createdAt:
            label === 'an invalid created timestamp'
              ? 'not-an-instant'
              : '2026-08-01T00:00:00Z',
          loginId,
          name: '이경호',
          userId: 7,
        },
        message: '회원가입 성공',
        success: true,
      },
      status,
    });
    const gateway = createSignupGateway(client);

    await expect(gateway.signup(SIGNUP_INPUT)).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it('propagates a normalized API failure', async () => {
    const {client, post} = createClient();
    const duplicated = new ApiError({
      code: 'LOGIN_ID_DUPLICATED',
      kind: 'server',
      message: '이미 사용 중인 로그인 아이디',
      status: 409,
    });
    post.mockRejectedValueOnce(duplicated);
    const gateway = createSignupGateway(client);

    await expect(gateway.signup(SIGNUP_INPUT)).rejects.toBe(duplicated);
  });
});
