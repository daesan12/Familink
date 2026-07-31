import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {CareReceiverMyPageScreen} from './CareReceiverMyPageScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
// 알림 공개 진입점을 통해 NotificationsScreen이 함께 로드되므로 lucide 아이콘을 mock 처리한다.
jest.mock('lucide-react-native/icons/bell-off', () => 'BellOff');
jest.mock('lucide-react-native/icons/check', () => 'Check');
jest.mock('lucide-react-native/icons/chevron-left', () => 'ChevronLeft');
jest.mock('lucide-react-native/icons/x', () => 'X');
// auth 공개 진입점(생년월일 선택기·관심사 화면)은 스텁으로 대체한다.
jest.mock('../../auth', () => {
  const ReactModule = require('react');
  const {Pressable, Text: RNText} = require('react-native');
  return {
    DatePickerSheet: () => null,
    InterestSelectionScreen: ({
      initialInterests,
      onComplete,
    }: {
      initialInterests?: readonly string[];
      onComplete: () => void;
    }) =>
      ReactModule.createElement(
        Pressable,
        {accessibilityLabel: '관심사 화면 완료', onPress: onComplete},
        ReactModule.createElement(
          RNText,
          null,
          `관심사:${(initialInterests ?? []).join(',')}`,
        ),
      ),
  };
});

const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'careReceiver'} as const,
  role: 'careReceiver' as const,
};

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function render(extra: Record<string, unknown> = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <CareReceiverMyPageScreen {...baseProps} {...extra} />,
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

test('피보호자 프로필 이름·나이·성별을 표시한다', () => {
  const renderer = render();
  expect(hasText(renderer, '손수호 님')).toBe(true);
  expect(hasText(renderer, '만 67세')).toBe(true);
  expect(hasText(renderer, '남자')).toBe(true);
});

test('설정 메뉴에 관심사 설정이 포함된다', () => {
  const renderer = render();
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '관심사 설정'}).length,
  ).toBeGreaterThan(0);
});

test('관심사 설정으로 이동하며 현재 관심사를 전달한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '관심사 설정'})
      .props.onPress();
  });
  expect(hasText(renderer, '관심사:가족과 일상,산책과 운동,역사와 추억,임영웅,츄')).toBe(
    true,
  );

  // 완료하면 J-1로 돌아온다.
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '관심사 화면 완료'})
      .props.onPress();
  });
  expect(hasText(renderer, '손수호 님')).toBe(true);
});

test('알림 설정·이용가이드로 이동한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '알림 설정'}).props.onPress();
  });
  expect(hasText(renderer, '앱 푸시 알림')).toBe(true);
});

test('로그아웃을 누르면 onRequestLogout을 호출한다', () => {
  const onRequestLogout = jest.fn();
  const renderer = render({onRequestLogout});
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '로그아웃'}).props.onPress();
  });
  expect(onRequestLogout).toHaveBeenCalledTimes(1);
});
