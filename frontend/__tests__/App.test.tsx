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
      children: '부모님 가족',
    })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({accessibilityRole: 'tablist'})
  ).toBeTruthy();
});
