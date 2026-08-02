import React from 'react';
import {AccessibilityInfo, Keyboard, Modal} from 'react-native';
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

function render(initialLoginId?: string, onDismiss: () => void = jest.fn()) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <LoginBottomSheet
        initialLoginId={initialLoginId}
        onDismiss={onDismiss}
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

test('키보드가 열려 있으면 시스템 Back 1회는 시트를 닫지 않고 키보드만 닫는다', () => {
  const onDismiss = jest.fn();
  const isVisible = jest
    .spyOn(Keyboard, 'isVisible')
    .mockReturnValue(true);
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation();
  const renderer = render(undefined, onDismiss);
  const modal = renderer.root.findByType(Modal);

  TestRenderer.act(() => modal.props.onRequestClose());

  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).not.toHaveBeenCalled();

  isVisible.mockReturnValue(false);
  TestRenderer.act(() => modal.props.onRequestClose());

  expect(onDismiss).toHaveBeenCalledTimes(1);
  dismiss.mockRestore();
  isVisible.mockRestore();
});
