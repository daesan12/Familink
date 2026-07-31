import {ApiError, apiClient} from '../../../shared/api';
import {reissueAuthTokenPair} from './authSessionApi';

describe('reissueAuthTokenPair', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a validated token pair from the success envelope', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'new-access',
          accessTokenExpiresIn: 1_800,
          refreshToken: 'new-refresh',
          tokenType: 'Bearer',
        },
        message: '토큰 재발급 성공',
        success: true,
      },
      status: 200,
    } as never);

    await expect(reissueAuthTokenPair('old-refresh')).resolves.toEqual({
      accessToken: 'new-access',
      accessTokenExpiresIn: 1_800,
      refreshToken: 'new-refresh',
      tokenType: 'Bearer',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/auth/reissue', {
      refreshToken: 'old-refresh',
    });
  });

  it('rejects a malformed success payload', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        data: {
          accessToken: '',
          accessTokenExpiresIn: 0,
          refreshToken: 'refresh',
          tokenType: 'Bearer',
        },
        message: '토큰 재발급 성공',
        success: true,
      },
      status: 200,
    } as never);

    await expect(reissueAuthTokenPair('old-refresh')).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });
});
