import React from 'react';
import TestRenderer from 'react-test-renderer';

import {GroupOnboardingScreen} from './GroupOnboardingScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => {
  const {View} = jest.requireActual('react-native');

  return {
    SafeAreaView: View,
  };
});

test('가입 승인 대기 요청이 있으면 대기 카드를 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        onBack={jest.fn()}
        onCreateGroup={jest.fn()}
        onJoinByCode={jest.fn()}
        pendingRequests={[
          {
            groupName: '우리 가족',
            id: 'request-1',
          },
        ]}
      />,
    );
  });

  expect(renderer!.root.findByProps({children: '우리 가족'})).toBeTruthy();
  expect(
    renderer!.root.findByProps({
      children: '관리자 승인을 기다리고 있어요',
    }),
  ).toBeTruthy();
  expect(renderer!.root.findByProps({children: '대기 중'})).toBeTruthy();
});
