import React from 'react';
import {AccessibilityInfo} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {LoginBottomSheet} from './LoginBottomSheet';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
});

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function render(initialLoginId?: string) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <LoginBottomSheet
        initialLoginId={initialLoginId}
        onDismiss={jest.fn()}
        onLogin={jest.fn()}
        visible
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function fieldValue(
  renderer: TestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
): string {
  return renderer.root.findByProps({accessibilityLabel}).props.value;
}

test('가입 직후 전달된 로그인 ID를 미리 채운다', () => {
  const renderer = render('CaseUser1');

  expect(fieldValue(renderer, '로그인 아이디')).toBe('CaseUser1');
  // 비밀번호는 채우지 않는다.
  expect(fieldValue(renderer, '로그인 비밀번호')).toBe('');
});

test('미리 채울 값이 없으면 빈 입력으로 시작한다', () => {
  const renderer = render();

  expect(fieldValue(renderer, '로그인 아이디')).toBe('');
});
