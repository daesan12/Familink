import React from 'react';
import TestRenderer from 'react-test-renderer';

import App from '../App';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
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
    renderer = TestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: 'Familink'}),
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({children: '회원가입'}),
  ).toBeTruthy();
});

test('앱 셸에 참여 중인 그룹이 없으면 빈 상태를 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="appShell" groups={[]} />,
    );
  });

  expect(
    renderer!.root.findByProps({
      children: '참여 중인 그룹이 없어요',
    }),
  ).toBeTruthy();
});
