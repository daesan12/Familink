import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {MyPageScreen} from './MyPageScreen';
import type {ProfileGateway} from '../api/profileApi';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
// 알림 공개 진입점을 통해 NotificationsScreen이 함께 로드되므로 lucide 아이콘을 mock 처리한다.
jest.mock('lucide-react-native/icons/bell-off', () => 'BellOff');
jest.mock('lucide-react-native/icons/check', () => 'Check');
jest.mock('lucide-react-native/icons/chevron-left', () => 'ChevronLeft');
jest.mock('lucide-react-native/icons/x', () => 'X');
// 프로필 편집 진입 시 로드되는 생년월일 스크롤 선택기는 스텁으로 대체한다.
jest.mock('../../auth', () => ({DatePickerSheet: () => null}));

const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'guardian'} as const,
  role: 'guardian' as const,
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
      <MyPageScreen {...baseProps} {...extra} />,
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

test('프로필 이름·나이·성별을 표시한다', () => {
  const renderer = render();
  expect(hasText(renderer, '이종철 님')).toBe(true);
  expect(hasText(renderer, '만 27세')).toBe(true);
  expect(hasText(renderer, '남자')).toBe(true);
});

test('더보기를 누르면 프로필 편집으로 이동한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 편집'})
      .props.onPress();
  });
  expect(hasText(renderer, '프로필 편집')).toBe(true);
});

test('알림 설정 메뉴로 이동한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '알림 설정'})
      .props.onPress();
  });
  expect(hasText(renderer, '앱 푸시 알림')).toBe(true);
});

test('이용가이드 메뉴로 이동한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '이용가이드'})
      .props.onPress();
  });
  expect(hasText(renderer, '처음 시작하시나요?')).toBe(true);
});

test('로그아웃을 누르면 onRequestLogout을 호출한다', () => {
  const onRequestLogout = jest.fn();
  const renderer = render({onRequestLogout});
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '로그아웃'}).props.onPress();
  });
  expect(onRequestLogout).toHaveBeenCalledTimes(1);
});

test('renders the profile returned by the API gateway', async () => {
  const profileGateway: ProfileGateway = {
    loadCurrentProfile: jest.fn().mockResolvedValue({
      birthDate: '1995-03-17',
      gender: 'male',
      loginId: 'api-user',
      name: 'API User',
      profileImageUrl: null,
    }),
    updateCurrentProfile: jest.fn(),
    withdrawCurrentUser: jest.fn(),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <MyPageScreen {...baseProps} profileGateway={profileGateway} />,
    );
  });
  await TestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  expect(profileGateway.loadCurrentProfile).toHaveBeenCalledTimes(1);
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => String(node.props.children).includes('API User')),
  ).toBe(true);
});
