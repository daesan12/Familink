import React from 'react';
import TestRenderer from 'react-test-renderer';

import App from '../App';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('lucide-react-native/icons/calendar', () => 'Icon');
jest.mock('lucide-react-native/icons/circle-user-round', () => 'Icon');
jest.mock('lucide-react-native/icons/file-chart-column', () => 'Icon');
jest.mock('lucide-react-native/icons/house', () => 'Icon');
jest.mock('lucide-react-native/icons/phone-call', () => 'Icon');
jest.mock('lucide-react-native/icons/users-round', () => 'Icon');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const {View} = jest.requireActual('react-native');

  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
  };
});

test('회원가입 시작 화면을 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(<App initialRootRoute="welcome" />);
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: 'Familink'})
  ).toBeTruthy();
  expect(renderer!.root.findByProps({children: '회원가입'})).toBeTruthy();
});

test('앱 셸에 참여 중인 그룹이 없으면 빈 상태를 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="appShell" groups={[]} />
    );
  });

  expect(
    renderer!.root.findByProps({
      children: '참여 중인 그룹이 없어요',
    })
  ).toBeTruthy();
});

test('개발 실행 기본값으로 앱 셸과 하단 탭을 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findByProps({
      children: '우리 가족의 이야기',
    })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({accessibilityRole: 'tablist'})
  ).toBeTruthy();
});

test('그룹 선택 바텀시트에서 빈 피드 그룹으로 전환한다', async () => {
  jest.useFakeTimers();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<App />);
    jest.runOnlyPendingTimers();
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({accessibilityHint: '다른 가족 그룹으로 전환합니다'})
      .props.onPress();
    jest.runOnlyPendingTimers();
  });

  expect(renderer!.root.findByProps({children: '그룹 선택'})).toBeTruthy();

  const emptyGroupOption = renderer!.root
    .findAllByProps({accessibilityRole: 'menuitem'})
    .find(
      option =>
        option.findAllByProps({children: '교회 소모임'}).length > 0
    );

  expect(emptyGroupOption).toBeTruthy();

  await TestRenderer.act(async () => {
    emptyGroupOption!.props.onPress();
    jest.runOnlyPendingTimers();
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: '게시물이 없는 피드'})
  ).toBeTruthy();

  await TestRenderer.act(() => renderer!.unmount());
  jest.useRealTimers();
});
