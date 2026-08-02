import {ApiError, normalizeApiError} from './apiError';

test('서버 실패 봉투를 공통 오류로 변환한다', () => {
  const normalized = normalizeApiError({
    isAxiosError: true,
    response: {
      data: {
        code: 'INVALID_REQUEST',
        errors: [{field: 'loginId', message: '형식이 올바르지 않습니다.'}],
        message: '요청 형식 또는 검증 실패',
        success: false,
      },
      status: 400,
    },
  });

  expect(normalized).toMatchObject({
    code: 'INVALID_REQUEST',
    errors: [{field: 'loginId', message: '형식이 올바르지 않습니다.'}],
    kind: 'server',
    message: '요청 형식 또는 검증 실패',
    status: 400,
  });
});

test.each(['ECONNABORTED', 'ETIMEDOUT'])(
  '시간 초과 오류를 구분한다: %s',
  code => {
    expect(normalizeApiError({code, isAxiosError: true})).toMatchObject({
      code: 'API_TIMEOUT',
      kind: 'timeout',
    });
  },
);

test('응답이 없는 Axios 오류를 네트워크 오류로 변환한다', () => {
  expect(normalizeApiError({isAxiosError: true})).toMatchObject({
    code: 'NETWORK_ERROR',
    kind: 'network',
  });
});

test('계약과 다른 서버 응답을 비정상 응답으로 변환한다', () => {
  expect(
    normalizeApiError({
      isAxiosError: true,
      response: {data: {error: 'unexpected'}, status: 500},
    }),
  ).toMatchObject({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    status: 500,
  });
});

test('이미 정규화한 오류는 그대로 반환한다', () => {
  const error = new ApiError({
    code: 'API_CONFIGURATION_ERROR',
    kind: 'configuration',
    message: '잘못된 설정',
  });

  expect(normalizeApiError(error)).toBe(error);
});
