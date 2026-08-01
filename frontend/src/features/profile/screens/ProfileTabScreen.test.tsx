import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {ProfileTabScreen} from './ProfileTabScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
// 하위에서 알림 공개 진입점을 통해 NotificationsScreen이 로드되므로 lucide 아이콘을 mock 처리한다.
jest.mock('lucide-react-native/icons/bell-off', () => 'BellOff');
jest.mock('lucide-react-native/icons/check', () => 'Check');
jest.mock('lucide-react-native/icons/chevron-left', () => 'ChevronLeft');
jest.mock('lucide-react-native/icons/x', () => 'X');
jest.mock('../../auth', () => ({
  createInterestGateway: jest.fn(),
  DatePickerSheet: () => null,
  getInterestErrorMessage: (_error: unknown, fallback: string) => fallback,
  InterestSelectionScreen: () => null,
}));

const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'guardian'} as const,
};

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function render(role: 'guardian' | 'careReceiver') {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ProfileTabScreen {...baseProps} role={role} />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some(node => {
    const {children} = node.props;
    const text = Array.isArray(children) ? children.join('') : children;
    return text === value;
  });
}

test('보호자 역할이면 효자 도장이 있는 마이페이지를 보여준다', () => {
  const renderer = render('guardian');
  expect(hasText(renderer, '이종철 님')).toBe(true);
  expect(hasText(renderer, GUARDIAN_STAMP_TITLE)).toBe(true);
});

test('피보호자 역할이면 관심사 설정이 있는 마이페이지를 보여준다', () => {
  const renderer = render('careReceiver');
  expect(hasText(renderer, '손수호 님')).toBe(true);
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '관심사 설정'}).length,
  ).toBeGreaterThan(0);
});

const GUARDIAN_STAMP_TITLE = '2026년 7월 3째주 효자도장 현황';
