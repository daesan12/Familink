import {
  ApiError,
  apiClient,
  isApiSuccess,
  type ApiSuccess,
} from '../../../shared/api';

export interface AuthTokenPairResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  tokenType: 'Bearer';
}

export async function reissueAuthTokenPair(
  refreshToken: string,
): Promise<AuthTokenPairResponse> {
  const response = await apiClient.post<ApiSuccess<unknown>>('/auth/reissue', {
    refreshToken,
  });
  const payload = isApiSuccess(response.data) ? response.data.data : null;

  if (!isAuthTokenPairResponse(payload)) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      message: '서버가 예상하지 못한 응답을 반환했습니다.',
      status: response.status,
    });
  }

  return payload;
}

function isAuthTokenPairResponse(
  value: unknown,
): value is AuthTokenPairResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    payload.tokenType === 'Bearer' &&
    typeof payload.accessToken === 'string' &&
    payload.accessToken.length > 0 &&
    typeof payload.accessTokenExpiresIn === 'number' &&
    Number.isFinite(payload.accessTokenExpiresIn) &&
    payload.accessTokenExpiresIn > 0 &&
    typeof payload.refreshToken === 'string' &&
    payload.refreshToken.length > 0
  );
}
