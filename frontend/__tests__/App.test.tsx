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

test('Android 실행 환경 준비 안내를 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(<App />);
  });

  expect(renderer!.root.findByProps({children: 'S15P11B104'})).toBeTruthy();
  expect(
    renderer!.root.findByProps({
      children: 'React Native Android 실행 환경이 준비되었습니다.',
    }),
  ).toBeTruthy();
});
