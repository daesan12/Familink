import {isApiFailure, isApiSuccess} from './apiTypes';

test('성공 응답 공통 봉투를 확인한다', () => {
  expect(
    isApiSuccess({
      data: {available: true},
      message: '로그인 아이디 중복 확인 성공',
      success: true,
    }),
  ).toBe(true);
  expect(isApiSuccess({message: 'data 누락', success: true})).toBe(false);
});

test('실패 응답 공통 봉투를 확인한다', () => {
  expect(
    isApiFailure({
      code: 'INVALID_REQUEST',
      errors: [{field: 'loginId', message: '형식이 올바르지 않습니다.'}],
      message: '요청 형식 또는 검증 실패',
      success: false,
    }),
  ).toBe(true);
});

test('실패 응답에 data 또는 잘못된 필드 오류가 있으면 거부한다', () => {
  expect(
    isApiFailure({
      code: 'INVALID_REQUEST',
      data: null,
      errors: [],
      message: '요청 형식 또는 검증 실패',
      success: false,
    }),
  ).toBe(false);
  expect(
    isApiFailure({
      code: 'INVALID_REQUEST',
      errors: [{field: 'loginId'}],
      message: '요청 형식 또는 검증 실패',
      success: false,
    }),
  ).toBe(false);
});
