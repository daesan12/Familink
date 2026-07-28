import React from 'react';
import TestRenderer from 'react-test-renderer';

import App from '../App';

jest.mock('react-native-safe-area-context', () => {
  const {View} = jest.requireActual('react-native');

  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
  };
});

test('Android 앱에서 그룹 없음 상태의 앱 셸을 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findByProps({
      children: '참여 중인 그룹이 없어요',
    }),
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({
      children: '그룹을 만들거나 초대 코드로 가입을 요청해 주세요.',
    }),
  ).toBeTruthy();
});
