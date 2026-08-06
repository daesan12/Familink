import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {ProfileTabScreen} from './ProfileTabScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
// 하위에서 알림 공개 진입점을 통해 NotificationsScreen이 로드되므로 lucide 아이콘을 mock 처리한다.
jest.mock('lucide-react-native/icons/bell-off', () => 'BellOff');
jest.mock('lucide-react-native/icons/check', () => 'Check');
jest.mock('lucide-react-native/icons/chevron-left', () => 'ChevronLeft');
jest.mock('lucide-react-native/icons/x', () => 'X');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../../auth', () => ({
  createInterestGateway: jest.fn(),
  DatePickerSheet: () => null,
  getInterestErrorMessage: (_error: unknown, fallback: string) => fallback,
  InterestSelectionScreen: () => null,
}));
jest.mock('react-native-safe-area-context', () => {
  const mockReact = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const insets = {bottom: 0, left: 0, right: 0, top: 0};

  return {
    // ProfileStack(native-stack)의 SafeAreaProviderCompat이 이 컨텍스트를 구독한다.
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    initialWindowMetrics: null,
    useSafeAreaInsets: () => insets,
  };
});

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
      // 역할별 마이페이지가 내부에 ProfileStack 내비게이터를 렌더한다.
      <NavigationContainer>
        <ProfileTabScreen {...baseProps} role={role} />
      </NavigationContainer>,
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
  expect(hasText(renderer, '효자 도장 현황')).toBe(true);
});

test('피보호자 역할이면 관심사 설정이 있는 마이페이지를 보여준다', () => {
  const renderer = render('careReceiver');
  expect(hasText(renderer, '손수호 님')).toBe(true);
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '관심사 설정'}).length,
  ).toBeGreaterThan(0);
});
