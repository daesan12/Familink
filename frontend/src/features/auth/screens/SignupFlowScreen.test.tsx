import React from 'react';
import TestRenderer from 'react-test-renderer';

import {ApiError} from '../../../shared/api';
import type {
  SignupGateway,
  SignupResult,
} from '../api/signupApi';
import {SignupFlowScreen} from './SignupFlowScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../hooks/useScreenEntrance', () => ({
  useScreenEntrance: () => ({}),
}));
jest.mock('../components/FloatingIllustration', () => {
  const ReactModule = require('react');
  const {View} = require('react-native');
  return {
    FloatingIllustration: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, props),
  };
});
jest.mock('../components/DatePickerSheet', () => {
  const ReactModule = require('react');
  const {Pressable} = require('react-native');
  return {
    DatePickerSheet: ({
      onConfirm,
      visible,
    }: {
      onConfirm: (value: string) => void;
      visible: boolean;
    }) =>
      visible
        ? ReactModule.createElement(Pressable, {
            accessibilityLabel: '생년월일 확정',
            onPress: () => onConfirm('1995-03-17'),
          })
        : null,
  };
});

const SIGNUP_RESULT: SignupResult = {
  createdAt: '2026-08-01T00:00:00Z',
  loginId: 'CaseUser1',
  name: '이경호',
  userId: 7,
};
const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function createGateway(): jest.Mocked<SignupGateway> {
  return {
    checkLoginIdAvailability: jest.fn().mockResolvedValue(true),
    signup: jest.fn().mockResolvedValue(SIGNUP_RESULT),
  };
}

function render(gateway = createGateway()): {
  gateway: jest.Mocked<SignupGateway>;
  renderer: TestRenderer.ReactTestRenderer;
} {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <SignupFlowScreen
        gateway={gateway}
        onCancel={jest.fn()}
        onComplete={jest.fn()}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return {gateway, renderer: renderer!};
}

function change(
  renderer: TestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
  value: string,
): void {
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel})
      .props.onChangeText(value);
  });
}

function press(
  renderer: TestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
): void {
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel}).props.onPress();
  });
}

async function pressAsync(
  renderer: TestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
): Promise<void> {
  await TestRenderer.act(async () => {
    await renderer.root.findByProps({accessibilityLabel}).props.onPress();
    await Promise.resolve();
  });
}

async function advanceToPassword(
  renderer: TestRenderer.ReactTestRenderer,
): Promise<void> {
  change(renderer, '회원가입 이름', '이경호');
  change(renderer, '회원가입 아이디', 'CaseUser1');
  await pressAsync(renderer, '아이디 중복 확인');
  press(renderer, '다음');
}

async function advanceToGender(
  renderer: TestRenderer.ReactTestRenderer,
): Promise<void> {
  await advanceToPassword(renderer);
  change(renderer, '회원가입 비밀번호', 'password123');
  change(renderer, '회원가입 비밀번호 확인', 'password123');
  press(renderer, '다음');
  press(renderer, '생년월일 선택');
  press(renderer, '생년월일 확정');
  press(renderer, '다음');
  press(renderer, '성별 남자');
}

function hasText(
  renderer: TestRenderer.ReactTestRenderer,
  text: string,
): boolean {
  return renderer.root.findAllByProps({children: text}).length > 0;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>(resolve => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: value => resolvePromise?.(value),
  };
}

test('로그인 ID 중복 확인 결과를 화면에 표시한다', async () => {
  const {gateway, renderer} = render();
  change(renderer, '회원가입 아이디', 'CaseUser1');

  await pressAsync(renderer, '아이디 중복 확인');

  expect(gateway.checkLoginIdAvailability).toHaveBeenCalledWith('CaseUser1');
  expect(hasText(renderer, '사용 가능한 아이디입니다')).toBe(true);
});

test('늦게 끝난 이전 중복 확인 응답이 최신 입력 결과를 덮어쓰지 않는다', async () => {
  const gateway = createGateway();
  const first = deferred<boolean>();
  const second = deferred<boolean>();
  gateway.checkLoginIdAvailability
    .mockReset()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const {renderer} = render(gateway);

  change(renderer, '회원가입 아이디', 'First1');
  press(renderer, '아이디 중복 확인');
  change(renderer, '회원가입 아이디', 'Second2');
  press(renderer, '아이디 중복 확인');

  await TestRenderer.act(async () => {
    second.resolve(true);
    await second.promise;
  });
  await TestRenderer.act(async () => {
    first.resolve(false);
    await first.promise;
  });

  expect(hasText(renderer, '사용 가능한 아이디입니다')).toBe(true);
  expect(hasText(renderer, '사용이 불가능한 아이디입니다')).toBe(false);
});

test('중복 확인 네트워크 실패를 표시하고 같은 입력으로 재시도한다', async () => {
  const gateway = createGateway();
  gateway.checkLoginIdAvailability
    .mockRejectedValueOnce(
      new ApiError({
        code: 'NETWORK_ERROR',
        kind: 'network',
        message: 'network failed',
      }),
    )
    .mockResolvedValueOnce(true);
  const {renderer} = render(gateway);
  change(renderer, '회원가입 아이디', 'CaseUser1');

  await pressAsync(renderer, '아이디 중복 확인');
  expect(
    hasText(renderer, '네트워크 연결을 확인하고 다시 시도해주세요.'),
  ).toBe(true);

  await pressAsync(renderer, '아이디 중복 확인');
  expect(hasText(renderer, '사용 가능한 아이디입니다')).toBe(true);
  expect(gateway.checkLoginIdAvailability).toHaveBeenCalledTimes(2);
});

test('계약 필드로 회원가입하고 성공한 경우에만 완료 단계를 표시한다', async () => {
  const {gateway, renderer} = render();
  await advanceToGender(renderer);

  await pressAsync(renderer, '다음');

  expect(gateway.signup).toHaveBeenCalledWith({
    birthDate: '1995-03-17',
    gender: 'MALE',
    loginId: 'CaseUser1',
    name: '이경호',
    password: 'password123',
  });
  expect(hasText(renderer, '회원가입이\n완료되었습니다!')).toBe(true);
});

test('가입 시점의 로그인 ID 중복은 입력을 보존한 채 1단계로 돌려보낸다', async () => {
  const gateway = createGateway();
  gateway.signup.mockRejectedValueOnce(
    new ApiError({
      code: 'LOGIN_ID_DUPLICATED',
      kind: 'server',
      message: '이미 사용 중인 로그인 아이디',
      status: 409,
    }),
  );
  const {renderer} = render(gateway);
  await advanceToGender(renderer);

  await pressAsync(renderer, '다음');

  expect(hasText(renderer, '기본 정보를\n입력해주세요')).toBe(true);
  expect(hasText(renderer, '사용이 불가능한 아이디입니다')).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '회원가입 아이디'}).props
      .value,
  ).toBe('CaseUser1');
});

test.each([
  ['name', '기본 정보를\n입력해주세요', '이름은 2 ~ 10자로 입력해주세요.'],
  [
    'loginId',
    '기본 정보를\n입력해주세요',
    '아이디는 영문·숫자 5 ~ 15자로 입력해주세요.',
  ],
  [
    'password',
    '비밀번호를\n설정해주세요',
    '비밀번호는 영문·숫자 8 ~ 16자로 입력해주세요.',
  ],
  [
    'birthDate',
    '생년월일을\n선택해주세요',
    '생년월일을 다시 선택해주세요.',
  ],
  ['gender', '성별을\n선택해주세요', '성별을 선택해주세요.'],
])('서버의 %s 검증 오류를 해당 단계에 표시한다', async (
  field,
  title,
  message,
) => {
  const gateway = createGateway();
  gateway.signup.mockRejectedValueOnce(
    new ApiError({
      code: 'INVALID_REQUEST',
      errors: [{field, message: 'server validation failed'}],
      kind: 'server',
      message: '요청 형식 또는 검증 실패',
      status: 400,
    }),
  );
  const {renderer} = render(gateway);
  await advanceToGender(renderer);

  await pressAsync(renderer, '다음');

  expect(hasText(renderer, title)).toBe(true);
  expect(hasText(renderer, message)).toBe(true);
});

test('가입 네트워크 실패 시 입력을 유지하고 마지막 단계에서 재시도한다', async () => {
  const gateway = createGateway();
  gateway.signup
    .mockRejectedValueOnce(
      new ApiError({
        code: 'API_TIMEOUT',
        kind: 'timeout',
        message: 'timeout',
      }),
    )
    .mockResolvedValueOnce(SIGNUP_RESULT);
  const {renderer} = render(gateway);
  await advanceToGender(renderer);

  await pressAsync(renderer, '다음');
  expect(hasText(renderer, '성별을\n선택해주세요')).toBe(true);
  expect(
    hasText(renderer, '네트워크 연결을 확인하고 다시 시도해주세요.'),
  ).toBe(true);

  await pressAsync(renderer, '다음');
  expect(hasText(renderer, '회원가입이\n완료되었습니다!')).toBe(true);
  expect(gateway.signup).toHaveBeenCalledTimes(2);
});
