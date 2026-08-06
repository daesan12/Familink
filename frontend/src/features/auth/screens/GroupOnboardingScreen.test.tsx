import React from 'react';
import {AccessibilityInfo, Alert, StyleSheet, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {AUTH_COLORS} from '../theme';
import {GroupOnboardingScreen} from './GroupOnboardingScreen';

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
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
  expect(renderer!.root.findByProps({children: '대기 중'})).toBeTruthy();
  expect(
    renderer!.root.findByProps({children: '승인 요청 대기'}),
  ).toBeTruthy();
  expect(
    renderer!.root.findAllByProps({children: '그룹 참여 방법'}),
  ).toHaveLength(0);
  expect(
    renderer!.root.findByProps({testID: 'join-request-carousel'}).props
      .horizontal,
  ).toBe(true);
  expect(
    StyleSheet.flatten(
      renderer!.root.findByProps({testID: 'join-request-card-request-1'})
        .props.style,
    ).backgroundColor,
  ).toBe('#F5F5F5');
  expect(
    renderer!.root.findByProps({children: '우리 가족'}).props.numberOfLines,
  ).toBe(2);
  expect(
    renderer!.root.findAllByProps({name: 'clock-outline'}),
  ).toHaveLength(1);
  expect(
    renderer!.root.findAllByProps({name: 'chevron-right'}),
  ).toHaveLength(0);
});

test('그룹이 없는 사용자의 빈 상태는 참가 안내 문구를 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        onBack={jest.fn()}
        onCreateGroup={jest.fn()}
        onJoinByCode={jest.fn()}
        pendingRequests={[]}
      />,
    );
  });

  expect(JSON.stringify(renderer!.toJSON())).toContain(
    '아직 참가한 그룹이 없어요',
  );
});

test('그룹 보유 사용자의 빈 상태는 모순 없는 대기 문구를 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        hasJoinedGroups
        onBack={jest.fn()}
        onCreateGroup={jest.fn()}
        onJoinByCode={jest.fn()}
        pendingRequests={[]}
      />,
    );
  });

  const rendered = JSON.stringify(renderer!.toJSON());
  // 그룹 전환에서 진입한 사용자는 이미 그룹이 있으므로(F-20) 문구가 모순되지 않아야 한다.
  expect(rendered).not.toContain('아직 참가한 그룹이 없어요');
  expect(rendered).toContain('대기 중인 참여 요청이 없어요');
});

test('initialAction이 create면 생성 시트를 바로 연다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        initialAction="create"
        onBack={jest.fn()}
        onCreateGroup={jest.fn()}
        onJoinByCode={jest.fn()}
        pendingRequests={[]}
      />,
    );
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: '그룹 이름'}),
  ).toBeTruthy();
});

test('initialAction이 join이면 초대 코드 시트를 바로 연다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        initialAction="join"
        onBack={jest.fn()}
        onCreateGroup={jest.fn()}
        onJoinByCode={jest.fn()}
        pendingRequests={[]}
      />,
    );
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: '6자리 초대 코드'}),
  ).toBeTruthy();
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
  const guardianOption = renderer!.root.findByProps({
    accessibilityLabel: '보호자',
  });
  expect(groupNameInput.props.maxLength).toBe(10);
  expect(StyleSheet.flatten(guardianOption.props.style)).toEqual(
    expect.objectContaining({
      borderRadius: 24,
      overflow: 'hidden',
    }),
  );

  await TestRenderer.act(() => {
    groupNameInput.props.onChangeText('행복한 우리집');
    renderer!.root
      .findByProps({accessibilityLabel: '피보호자'})
      .props.onPress();
  });

  const careReceiverOption = renderer!.root.findByProps({
    accessibilityLabel: '피보호자',
  });
  expect(
    StyleSheet.flatten(careReceiverOption.props.style).backgroundColor,
  ).toBeDefined();

  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({accessibilityLabel: '생성하기'})
      .props.onPress();
  });

  expect(onCreateGroup).toHaveBeenCalledWith(
    {
      name: '행복한 우리집',
      role: 'careReceiver',
    },
    expect.any(Object),
  );
});

test('그룹 생성 중 중복 요청을 막고 실패하면 입력 화면을 유지한다', async () => {
  let rejectCreate: (reason?: unknown) => void = () => {};
  const onCreateGroup = jest.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectCreate = reject;
      }),
  );
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
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
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '그룹 이름'})
      .props.onChangeText('새 가족');
  });

  let submission: Promise<void> = Promise.resolve();
  await TestRenderer.act(async () => {
    const createButton = renderer!.root.findByProps({
      accessibilityLabel: '생성하기',
    });
    submission = createButton.props.onPress();
    createButton.props.onPress();
    await Promise.resolve();
  });

  expect(onCreateGroup).toHaveBeenCalledTimes(1);
  expect(
    renderer!.root.findByProps({accessibilityLabel: '생성하기'}).props
      .accessibilityState,
  ).toEqual(expect.objectContaining({busy: true, disabled: true}));

  await TestRenderer.act(async () => {
    rejectCreate(new Error('network'));
    await submission;
  });

  expect(alert).toHaveBeenCalledWith(
    '그룹을 만들지 못했어요',
    '잠시 후 다시 시도해 주세요.',
  );
  expect(
    renderer!.root.findByProps({accessibilityLabel: '그룹 이름'}).props.value,
  ).toBe('새 가족');
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
        accessibilityHint: '받은 코드로 기존 그룹에 참여해요',
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

  expect(onJoinByCode).toHaveBeenCalledWith('AB12C3', expect.any(Object));
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
        accessibilityHint: '받은 코드로 기존 그룹에 참여해요',
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
    myMemberId: 'member-1',
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

  expect(JSON.stringify(renderer!.toJSON())).toContain('환영해요!');
  expect(
    renderer!.root.findByProps({children: '승인 요청 대기'}),
  ).toBeTruthy();
  expect(
    renderer!.root.findAllByProps({name: 'check-circle-outline'}),
  ).toHaveLength(1);
  expect(
    StyleSheet.flatten(
      renderer!.root.findByProps({testID: 'join-request-card-request-1'})
        .props.style,
    ).backgroundColor,
  ).toBe(AUTH_COLORS.action);
  expect(onOpenApprovedGroup).toHaveBeenCalledWith(request);
});

test('진입 콜백이 없는 승인 카드도 승인 상태로 안내한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupOnboardingScreen
        onBack={jest.fn()}
        onCreateGroup={jest.fn()}
        onJoinByCode={jest.fn()}
        pendingRequests={[
          {
            groupId: 'group-1',
            groupName: '우리 가족',
            id: 'request-1',
            myMemberId: 'member-1',
            role: 'careReceiver',
            status: 'APPROVED',
          },
        ]}
      />,
    );
  });

  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '우리 가족, 환영해요!',
    }),
  ).toBeTruthy();
});
