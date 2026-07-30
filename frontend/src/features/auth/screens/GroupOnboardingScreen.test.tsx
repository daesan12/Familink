import React from 'react';
import {AccessibilityInfo, StyleSheet, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {AUTH_COLORS} from '../theme';
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

test('초대 코드를 입력하면 칸을 채우고 영문 대문자와 숫자 6자리로 전달한다', async () => {
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
  expect(inviteCodeInput.props.keyboardType).toBe('visible-password');

  await TestRenderer.act(() => {
    inviteCodeInput.props.onChangeText('ab-12c3');
  });

  const firstCodeCell = renderer!.root.findByProps({
    testID: 'invite-code-cell-0',
  });
  expect(firstCodeCell.findByType(Text).props.children).toBe('A');
  expect(StyleSheet.flatten(firstCodeCell.props.style).backgroundColor).toBe(
    AUTH_COLORS.primarySoft,
  );

  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({accessibilityLabel: '참여 요청 보내기'})
      .props.onPress();
  });

  expect(onJoinByCode).toHaveBeenCalledWith('AB12C3');
});

test('참여 요청 중에는 로딩을 표시하고 실패하면 입력을 유지한 채 오류를 안내한다', async () => {
  let rejectRequest: (reason?: unknown) => void = () => {};
  const onJoinByCode = jest.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectRequest = reject;
      }),
  );
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
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '6자리 초대 코드'})
      .props.onChangeText('123456');
  });

  let submission: Promise<void> = Promise.resolve();
  await TestRenderer.act(async () => {
    submission = renderer!.root
      .findByProps({accessibilityLabel: '참여 요청 보내기'})
      .props.onPress();
    await Promise.resolve();
  });

  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '참여 요청 보내기',
    }).props.accessibilityState,
  ).toEqual(expect.objectContaining({busy: true, disabled: true}));
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '6자리 초대 코드',
    }).props.editable,
  ).toBe(false);

  await TestRenderer.act(async () => {
    rejectRequest(new Error('invalid invite code'));
    await submission;
  });

  expect(
    renderer!.root.findByProps({
      children: '초대 코드를 확인하고 다시 시도해주세요.',
    }),
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '6자리 초대 코드',
    }).props.value,
  ).toBe('123456');
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

  expect(JSON.stringify(renderer!.toJSON())).toContain('가입이 승인되었어요');
  expect(JSON.stringify(renderer!.toJSON())).toContain('눌러서 입장하기');
  expect(onOpenApprovedGroup).toHaveBeenCalledWith(request);
});
