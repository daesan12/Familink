import React from 'react';
import {AccessibilityInfo} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {GroupOnboardingScreen} from './GroupOnboardingScreen';

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => new Promise<boolean>(() => {}));
});

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => {
  const {View} = jest.requireActual('react-native');

  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    }),
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
            status: 'PENDING_ADMIN',
          },
        ]}
      />,
    );
  });

  expect(renderer!.root.findByProps({children: '우리 가족'})).toBeTruthy();
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    '관리자 승인을 기다리고 있어요',
  );
});

test('새 그룹 이름과 역할을 입력해 생성 요청을 전달한다', async () => {
  const onCreateGroup = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        onBack={jest.fn()}
        onCreateGroup={onCreateGroup}
        onJoinByCode={jest.fn()}
        pendingRequests={[]}
      />,
    );
  });

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: '우리 가족만의 공간을 시작해요',
      })
      .props.onPress();
  });

  const groupNameInput = renderer!.root.findByProps({
    accessibilityLabel: '그룹 이름',
  });
  expect(groupNameInput.props.maxLength).toBe(10);

  await TestRenderer.act(() => {
    groupNameInput.props.onChangeText('행복한 우리집');
    renderer!.root
      .findByProps({accessibilityLabel: '피보호자'})
      .props.onPress();
  });

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '생성하기'})
      .props.onPress();
  });

  expect(onCreateGroup).toHaveBeenCalledWith({
    name: '행복한 우리집',
    role: 'careReceiver',
  });
});

test('초대 코드를 영문 대문자와 숫자 6자리로 정리해 전달한다', async () => {
  const onJoinByCode = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        onBack={jest.fn()}
        onCreateGroup={jest.fn()}
        onJoinByCode={onJoinByCode}
        pendingRequests={[]}
      />,
    );
  });

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: '받은 코드로 기존 그룹에 들어가요',
      })
      .props.onPress();
  });

  const inviteCodeInput = renderer!.root.findByProps({
    accessibilityLabel: '6자리 초대 코드',
  });
  expect(inviteCodeInput.props.maxLength).toBeUndefined();

  await TestRenderer.act(() => {
    inviteCodeInput.props.onChangeText('ab-12c3');
  });

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '참여 요청 보내기'})
      .props.onPress();
  });

  expect(onJoinByCode).toHaveBeenCalledWith('AB12C3');
});

test('승인된 그룹 카드를 누르면 해당 그룹 진입을 요청한다', async () => {
  const onOpenApprovedGroup = jest.fn();
  const request = {
    groupId: 'group-1',
    groupName: '우리 가족',
    id: 'request-1',
    role: 'careReceiver' as const,
    status: 'APPROVED' as const,
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        onBack={jest.fn()}
        onCreateGroup={jest.fn()}
        onJoinByCode={jest.fn()}
        onOpenApprovedGroup={onOpenApprovedGroup}
        pendingRequests={[request]}
      />,
    );
  });

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '우리 가족 열기'})
      .props.onPress();
  });

  expect(onOpenApprovedGroup).toHaveBeenCalledWith(request);
});
