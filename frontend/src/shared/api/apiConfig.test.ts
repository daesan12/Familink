jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    API_BASE_URL: 'http://10.0.2.2:8080',
  },
}));

import {API_BASE_URL, resolveApiBaseUrl} from './apiConfig';
import {ApiError} from './apiError';

test('개발 환경 API 주소를 origin 형태로 정규화한다', () => {
  expect(resolveApiBaseUrl('  http://10.0.2.2:8080/  ', true)).toBe(
    'http://10.0.2.2:8080',
  );
  expect(API_BASE_URL).toBe('http://10.0.2.2:8080');
});

test.each([undefined, '', '   '])(
  'API 주소가 없으면 설정 오류를 반환한다: %s',
  value => {
    expect(() => resolveApiBaseUrl(value, true)).toThrow(
      new ApiError({
        code: 'API_CONFIGURATION_ERROR',
        kind: 'configuration',
        message: 'API_BASE_URL 환경변수가 설정되지 않았습니다.',
      }),
    );
  },
);

test.each([
  'ftp://api.example.com',
  'https://user:password@api.example.com',
  'https://api.example.com/api/v1',
  'https://api.example.com?version=1',
  'https://api.example.com#status',
])('허용하지 않는 API 주소 형식을 거부한다: %s', value => {
  expect(() => resolveApiBaseUrl(value, true)).toThrow(ApiError);
});

test('배포 환경에서는 HTTPS 주소만 허용한다', () => {
  expect(() =>
    resolveApiBaseUrl('http://api.example.com', false),
  ).toThrow('배포 환경의 API_BASE_URL은 HTTPS를 사용해야 합니다.');
  expect(resolveApiBaseUrl('https://api.example.com', false)).toBe(
    'https://api.example.com',
  );
});
