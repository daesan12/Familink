import React from 'react';
import {Alert, FlatList, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {ApiError} from '../../../shared/api';
import {
  DEVELOPMENT_NOTIFICATIONS,
  EMPTY_NOTIFICATIONS,
} from '../fixtures/notificationFixtures';
import type {AppNotification, NotificationGateway} from '../types';
import {NotificationsScreen} from './NotificationsScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('lucide-react-native/icons/bell-off', () => 'BellOff');
jest.mock('lucide-react-native/icons/check', () => 'Check');
jest.mock('lucide-react-native/icons/trash-2', () => 'Trash2');
jest.mock('lucide-react-native/icons/x', () => 'X');

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

// NavigationContainer로 감싸지 않는 것이 계약이다. 이 화면은 내비게이션 훅을
// 갖지 않고 onClose*·onOpen* prop만 받으며, 렌더 위치(셸 스택 / 피드 탭 스택)를
// 모른다(S15P11B104-367). 누군가 useNavigation·useIsFocused를 추가하면 컨텍스트
// 부재로 이 파일 전체가 즉시 실패해 위상 결합이 들어오는 것을 막는다.
const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'guardian'} as const,
  role: 'guardian' as const,
};

function joinedChildren(children: unknown): string {
  return Array.isArray(children) ? children.join('') : String(children);
}

test('뒤로가기 버튼을 누르면 알림 화면을 닫는 콜백을 호출한다', () => {
  // 이 계약을 단언하는 테스트가 없어, 화면을 다른 스택으로 옮기는 리팩터가
  // 닫기 배선을 끊어도 조용히 통과했다(S15P11B104-367 기준선).
  const onCloseNotifications = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={DEVELOPMENT_NOTIFICATIONS}
        onCloseNotifications={onCloseNotifications}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '알림 화면 닫기'})
      .props.onPress();
  });

  expect(onCloseNotifications).toHaveBeenCalledTimes(1);
});

test('알림을 읽음 처리하고 연결된 게시글을 연다', () => {
  const onOpenPost = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={DEVELOPMENT_NOTIFICATIONS}
        onOpenPost={onOpenPost}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  const notification = renderer!.root.findByProps({
    accessibilityLabel:
      '게시글에 새로운 반응이 있어요, 1시간 전',
  });

  TestRenderer.act(() => {
    notification.props.onPress();
  });

  expect(onOpenPost).toHaveBeenCalledWith(
    'post-love',
    'development-guardian-group',
    'notification',
  );
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children?.join?.('') === '읽지 않은 알림 1개'),
  ).toBe(true);
});

// 프로필 사진이 있어도 이니셜만 그려서 알림 탭에 사진이 뜨지 않았다.
test('행위자 프로필 사진이 있으면 이니셜 대신 사진을 그린다', () => {
  const notifications: readonly AppNotification[] = [
    {
      actorName: '홍유라',
      actorProfileImageUrl: 'https://cdn.example.com/u7.jpg?sig=abc',
      avatarText: '홍유',
      body: '새 게시글이 올라왔어요.',
      createdAtLabel: '방금',
      groupId: 'group-1',
      id: 'with-photo',
      isRead: false,
      relatedJoinRequestStatus: null,
      title: '새 게시글',
      type: 'NEW_POST',
    },
  ];
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen {...baseProps} initialNotifications={notifications} />,
    );
  });
  mountedRenderers.push(renderer!);

  expect(
    renderer!.root.findAll(
      node =>
        node.props.source?.uri === 'https://cdn.example.com/u7.jpg?sig=abc',
    ).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => joinedChildren(node.props.children) === '홍유'),
  ).toBe(false);
});

// 이니셜은 무슨 알림인지 알려주지 못했다. 리포트 알림 여러 건이 모두 '알'로
// 보여 사용자가 프로필 사진이 누락된 것으로 오해했다.
test.each([
  ['NEW_POST', 'House'],
  ['POST_ACTIVITY', 'House'],
  ['EVENT_CHANGED', 'Calendar'],
  ['EVENT_REMINDER', 'Calendar'],
  ['CALL_REPORT', 'FileChartColumn'],
  ['DAILY_REPORT', 'FileChartColumn'],
  ['GROUP_JOIN_REQUEST', 'UsersRound'],
] as const)(
  '프로필 사진이 없으면 %s 알림에 %s 아이콘을 그린다',
  (type, iconName) => {
    const notifications: readonly AppNotification[] = [
      {
        actorName: '홍유라',
        avatarText: '홍유',
        body: '알림 본문',
        createdAtLabel: '방금',
        groupId: 'group-1',
        id: `without-photo-${type}`,
        isRead: false,
        relatedJoinRequestStatus: null,
        title: '알림 제목',
        type,
      },
    ];
    let renderer: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        <NotificationsScreen
          {...baseProps}
          initialNotifications={notifications}
        />,
      );
    });
    mountedRenderers.push(renderer!);

    // 아이콘은 jest.setup.js에서 이름 문자열 host 컴포넌트로 대체된다.
    expect(
      renderer!.root.findAll(node => String(node.type) === iconName).length,
    ).toBeGreaterThan(0);
    // 이니셜을 함께 그리면 원 안에 글자와 아이콘이 겹친다.
    expect(
      renderer!.root
        .findAllByType(Text)
        .some(node => joinedChildren(node.props.children) === '홍유'),
    ).toBe(false);
  },
);

// 사진이 있으면 아이콘보다 사람을 먼저 보여준다(381).
test('프로필 사진이 있으면 종류 아이콘 대신 사진을 그린다', () => {
  const notifications: readonly AppNotification[] = [
    {
      actorName: '홍유라',
      actorProfileImageUrl: 'https://cdn.example.com/u9.jpg',
      avatarText: '홍유',
      body: '새 게시글이 올라왔어요.',
      createdAtLabel: '방금',
      groupId: 'group-1',
      id: 'photo-wins',
      isRead: false,
      relatedJoinRequestStatus: null,
      title: '새 게시글',
      type: 'NEW_POST',
    },
  ];
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen {...baseProps} initialNotifications={notifications} />,
    );
  });
  mountedRenderers.push(renderer!);

  expect(
    renderer!.root.findAll(
      node => node.props.source?.uri === 'https://cdn.example.com/u9.jpg',
    ).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAll(node => String(node.type) === 'House').length,
  ).toBe(0);
});

test('일정 알림을 탭하면 이벤트 상세 목적지로 라우팅한다', () => {
  const onOpenNotificationTarget = jest.fn();
  const notifications: readonly AppNotification[] = [
    {
      avatarText: '알',
      body: '일정이 변경됐어요.',
      createdAtLabel: '방금',
      groupId: 'group-1',
      id: 'event-changed-1',
      isRead: false,
      relatedEventId: '7',
      relatedJoinRequestStatus: null,
      title: '일정 변경',
      type: 'EVENT_CHANGED',
    },
  ];
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={notifications}
        onOpenNotificationTarget={onOpenNotificationTarget}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '일정 변경, 방금'})
      .props.onPress();
  });

  expect(onOpenNotificationTarget).toHaveBeenCalledWith({
    eventId: '7',
    groupId: 'group-1',
    kind: 'calendarEvent',
  });
});

test('리포트 알림을 탭하면 통화 상세 목적지로 라우팅한다', () => {
  const onOpenNotificationTarget = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={DEVELOPMENT_NOTIFICATIONS}
        onOpenNotificationTarget={onOpenNotificationTarget}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '통화 리포트가 준비됐어요, 어제'})
      .props.onPress();
  });

  expect(onOpenNotificationTarget).toHaveBeenCalledWith({
    callSessionId: '21',
    groupId: 'development-guardian-group',
    kind: 'callReport',
    memberId: '11',
    reportDate: '2026-08-03',
  });
});

test('가입 요청 알림 행을 탭하면 가입 승인 목적지로 라우팅한다', () => {
  const onOpenNotificationTarget = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={DEVELOPMENT_NOTIFICATIONS}
        onOpenNotificationTarget={onOpenNotificationTarget}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '수호님의 그룹 승인 요청, 방금'})
      .props.onPress();
  });

  expect(onOpenNotificationTarget).toHaveBeenCalledWith({
    groupId: 'development-guardian-group',
    kind: 'joinApproval',
  });
});

test('이동 참조가 결손인 알림은 읽음 처리만 하고 라우팅하지 않는다', () => {
  const onOpenNotificationTarget = jest.fn();
  const onOpenPost = jest.fn();
  const notifications: readonly AppNotification[] = [
    {
      avatarText: '알',
      body: '삭제된 일정 알림',
      createdAtLabel: '방금',
      groupId: 'group-1',
      id: 'event-orphan-1',
      isRead: false,
      relatedJoinRequestStatus: null,
      title: '일정 변경',
      type: 'EVENT_CHANGED',
    },
  ];
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={notifications}
        onOpenNotificationTarget={onOpenNotificationTarget}
        onOpenPost={onOpenPost}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '일정 변경, 방금'})
      .props.onPress();
  });

  expect(onOpenNotificationTarget).not.toHaveBeenCalled();
  expect(onOpenPost).not.toHaveBeenCalled();
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children?.join?.('') === '읽지 않은 알림 0개'),
  ).toBe(true);
});

test('보존된 읽음 id는 다시 진입해도 읽음으로 표시한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={DEVELOPMENT_NOTIFICATIONS}
        readNotificationIds={['post-reaction-love']}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children?.join?.('') === '읽지 않은 알림 1개'),
  ).toBe(true);
});

test('알림을 읽으면 읽음 id를 상위로 보고한다', () => {
  const onNotificationRead = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={DEVELOPMENT_NOTIFICATIONS}
        onNotificationRead={onNotificationRead}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityLabel: '게시글에 새로운 반응이 있어요, 1시간 전',
      })
      .props.onPress();
  });

  expect(onNotificationRead).toHaveBeenCalledWith('post-reaction-love');
});

test('그룹 요청 승인과 거부 팝업을 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={DEVELOPMENT_NOTIFICATIONS}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root.findByProps({
      accessibilityLabel: '그룹 요청 승인',
    }).props.onPress({stopPropagation: jest.fn()});
  });

  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        joinedChildren(node.props.children).includes(
          '수호님이 우리 가족에 참여했습니다.',
        ),
      ),
  ).toBe(true);

  await TestRenderer.act(() => {
    renderer!.root.findByProps({
      accessibilityLabel: '알림 팝업 닫기',
    }).props.onPress();
    renderer!.root.findByProps({
      accessibilityLabel: '그룹 요청 거부',
    }).props.onPress({stopPropagation: jest.fn()});
  });

  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        joinedChildren(node.props.children).includes(
          '수호님의 그룹 참여 신청이 거절되었습니다.',
        ),
      ),
  ).toBe(true);

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '그룹 요청 승인',
    }),
  ).toHaveLength(0);
});

test('fixture가 비어 있으면 빈 알림 상태를 표시한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={EMPTY_NOTIFICATIONS}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === '새로운 알림이 없어요'),
  ).toBe(true);
});

test('실제 gateway 경로에서 목록·미읽음 개수·읽음 API를 연결한다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(2),
    loadPage: jest.fn().mockResolvedValue({
      hasNext: false,
      notifications: [DEVELOPMENT_NOTIFICATIONS[1]],
    }),
    loadSettings: jest.fn(),
    deleteAllNotifications: jest.fn().mockResolvedValue(undefined),
    deleteNotification: jest.fn().mockResolvedValue(undefined),
    markAllRead: jest.fn().mockResolvedValue({
      readAt: '2026-08-01T00:00:00Z',
      updatedCount: 1,
    }),
    markRead: jest.fn().mockResolvedValue({
      id: 'post-reaction-love',
      readAt: '2026-08-01T00:00:00Z',
    }),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen {...baseProps} gateway={gateway} currentUserId={7} />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  expect(gateway.loadPage).toHaveBeenCalledWith(0);
  expect(gateway.getUnreadCount).toHaveBeenCalledTimes(1);
  const notification = renderer!.root.findByProps({
    accessibilityLabel: '게시글에 새로운 반응이 있어요, 1시간 전',
  });
  await TestRenderer.act(async () => {
    notification.props.onPress();
    await Promise.resolve();
  });
  expect(gateway.markRead).toHaveBeenCalledWith('post-reaction-love');

  await TestRenderer.act(async () => {
    const button = renderer!.root.findByProps({
      accessibilityLabel: '알림 삭제',
    });
    expect(button).toBeDefined();
    button.props.onPress();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === '전체 지우기'),
  ).toBe(true);
  await TestRenderer.act(async () => {
    const armedButton = renderer!.root
      .findAllByProps({accessibilityRole: 'button'})
      .find(item => item.props.onPress?.name === 'handleDeleteAll');
    if (armedButton === undefined) {
      throw new Error('전체 삭제 버튼을 찾지 못했습니다.');
    }
    armedButton.props.onPress();
    await Promise.resolve();
  });
  expect(gateway.deleteAllNotifications).toHaveBeenCalledTimes(1);
});

test('읽음 API 실패 시 상위 읽음 id를 저장하지 않고 화면 상태를 되돌린다', async () => {
  const onNotificationRead = jest.fn();
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(1),
    loadPage: jest.fn().mockResolvedValue({
      hasNext: false,
      notifications: [DEVELOPMENT_NOTIFICATIONS[1]],
    }),
    loadSettings: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn().mockRejectedValue(new Error('read failed')),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        onNotificationRead={onNotificationRead}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root.findByProps({
      accessibilityLabel: '게시글에 새로운 반응이 있어요, 1시간 전',
    }).props.onPress();
    await Promise.resolve();
  });

  expect(onNotificationRead).not.toHaveBeenCalled();
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children?.join?.('') === '읽지 않은 알림 1개'),
  ).toBe(true);
});

function createDecisionGateway(): jest.Mocked<NotificationGateway> {
  return {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(1),
    loadPage: jest.fn().mockResolvedValue({
      hasNext: false,
      notifications: [DEVELOPMENT_NOTIFICATIONS[0]],
    }),
    loadSettings: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn().mockResolvedValue({
      id: 'group-request-suho',
      readAt: '2026-08-01T00:00:00Z',
    }),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
}

test('그룹 요청 거부는 가입 요청 API 처리 후 알림을 정리한다', async () => {
  const gateway = createDecisionGateway();
  const processJoinRequest = jest.fn().mockResolvedValue(undefined);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        processJoinRequest={processJoinRequest}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root.findByProps({
      accessibilityLabel: '그룹 요청 거부',
    }).props.onPress({stopPropagation: jest.fn()});
    await Promise.resolve();
  });

  expect(processJoinRequest).toHaveBeenCalledWith(
    'development-guardian-group',
    {
      assignedRole: undefined,
      decision: 'REJECT',
      joinRequestId: 'join-request-suho',
    },
  );
  expect(gateway.markRead).toHaveBeenCalledWith('group-request-suho');
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children?.join?.('') === '읽지 않은 알림 0개'),
  ).toBe(true);
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '그룹 요청 승인',
    }),
  ).toHaveLength(0);
});

test('그룹 요청 승인은 역할 선택 후 APPROVE로 처리한다', async () => {
  const gateway = createDecisionGateway();
  const processJoinRequest = jest.fn().mockResolvedValue(undefined);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        processJoinRequest={processJoinRequest}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root.findByProps({
      accessibilityLabel: '그룹 요청 승인',
    }).props.onPress({stopPropagation: jest.fn()});
    await Promise.resolve();
  });

  // 팝업만 열린 상태에서는 아직 서버 처리·읽음이 없어야 한다.
  expect(processJoinRequest).not.toHaveBeenCalled();
  expect(gateway.markRead).not.toHaveBeenCalled();

  await TestRenderer.act(async () => {
    const roleButton = renderer!.root.findAllByProps({
      accessibilityRole: 'button',
    }).find(item => item.props.children?.props?.children === '보호자');
    expect(roleButton).toBeTruthy();
    roleButton!.props.onPress();
    await Promise.resolve();
  });

  expect(processJoinRequest).toHaveBeenCalledWith(
    'development-guardian-group',
    {
      assignedRole: 'guardian',
      decision: 'APPROVE',
      joinRequestId: 'join-request-suho',
    },
  );
  expect(gateway.markRead).toHaveBeenCalledWith('group-request-suho');
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '그룹 요청 승인',
    }),
  ).toHaveLength(0);
});

test('가입 요청 처리 실패 시 알림을 보존하고 오류 문구를 표시한다', async () => {
  const gateway = createDecisionGateway();
  const processJoinRequest = jest
    .fn()
    .mockRejectedValue(new Error('process failed'));
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        processJoinRequest={processJoinRequest}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root.findByProps({
      accessibilityLabel: '그룹 요청 승인',
    }).props.onPress({stopPropagation: jest.fn()});
    await Promise.resolve();
  });
  await TestRenderer.act(async () => {
    const roleButton = renderer!.root.findAllByProps({
      accessibilityRole: 'button',
    }).find(item => item.props.children?.props?.children === '보호자');
    expect(roleButton).toBeTruthy();
    roleButton!.props.onPress();
    await Promise.resolve();
  });

  expect(gateway.markRead).not.toHaveBeenCalled();
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '수호님의 그룹 승인 요청, 방금',
    }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        String(node.props.children).includes('가입 요청을 처리하지 못했습니다'),
      ),
  ).toBe(true);
  // 실패 시 "참여했습니다" 팝업이 남지 않아야 한다.
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        String(node.props.children).includes('우리 가족에 참여했습니다'),
      ),
  ).toBe(false);
});

test.each(['APPROVED', 'REJECTED'] as const)(
  '재진입해도 %s 가입 요청은 처리 버튼과 API 재호출을 노출하지 않는다',
  async status => {
    const processedNotification = {
      ...DEVELOPMENT_NOTIFICATIONS[0],
      isRead: true,
      relatedJoinRequestStatus: status,
      requestKind: undefined,
    };
    const gateway = createDecisionGateway();
    gateway.loadPage.mockResolvedValue({
      hasNext: false,
      notifications: [processedNotification],
    });
    const processJoinRequest = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        <NotificationsScreen
          {...baseProps}
          gateway={gateway}
          currentUserId={7}
          processJoinRequest={processJoinRequest}
        />,
      );
      await Promise.resolve();
    });
    await TestRenderer.act(() => renderer!.unmount());

    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        <NotificationsScreen
          {...baseProps}
          gateway={gateway}
          currentUserId={7}
          processJoinRequest={processJoinRequest}
        />,
      );
      await Promise.resolve();
    });
    mountedRenderers.push(renderer!);

    expect(
      renderer!.root.findAllByProps({accessibilityLabel: '그룹 요청 승인'}),
    ).toHaveLength(0);
    expect(
      renderer!.root.findAllByProps({accessibilityLabel: '그룹 요청 거부'}),
    ).toHaveLength(0);
    expect(processJoinRequest).not.toHaveBeenCalled();
  },
);

test('이미 처리된 요청 409는 문구를 보여주고 알림을 정리한다', async () => {
  const gateway = createDecisionGateway();
  const processJoinRequest = jest.fn().mockRejectedValue(
    new ApiError({
      code: 'JOIN_REQUEST_ALREADY_PROCESSED',
      kind: 'server',
      message: 'conflict',
      status: 409,
    }),
  );
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        processJoinRequest={processJoinRequest}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root.findByProps({
      accessibilityLabel: '그룹 요청 거부',
    }).props.onPress({stopPropagation: jest.fn()});
    await Promise.resolve();
  });

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '그룹 요청 승인',
    }),
  ).toHaveLength(0);
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        String(node.props.children).includes('이미 처리된 가입 요청이에요.'),
      ),
  ).toBe(true);
});

test('가입 요청 식별자가 없으면 처리하지 않고 오류 문구를 표시한다', async () => {
  const gateway = createDecisionGateway();
  const withoutIds: AppNotification = {...DEVELOPMENT_NOTIFICATIONS[0]};
  delete withoutIds.groupId;
  delete withoutIds.relatedJoinRequestId;
  gateway.loadPage.mockResolvedValue({
    hasNext: false,
    notifications: [withoutIds],
  });
  const processJoinRequest = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        processJoinRequest={processJoinRequest}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root.findByProps({
      accessibilityLabel: '그룹 요청 거부',
    }).props.onPress({stopPropagation: jest.fn()});
    await Promise.resolve();
  });

  expect(processJoinRequest).not.toHaveBeenCalled();
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '수호님의 그룹 승인 요청, 방금',
    }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        String(node.props.children).includes(
          '가입 요청 정보를 확인하지 못했습니다',
        ),
      ),
  ).toBe(true);
});

test('처리 성공 후 읽음 동기화가 실패해도 알림 정리를 유지한다', async () => {
  const gateway = createDecisionGateway();
  gateway.markRead.mockRejectedValue(new Error('read failed'));
  const processJoinRequest = jest.fn().mockResolvedValue(undefined);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        processJoinRequest={processJoinRequest}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root.findByProps({
      accessibilityLabel: '그룹 요청 거부',
    }).props.onPress({stopPropagation: jest.fn()});
    await Promise.resolve();
  });

  // 가입 요청은 서버에서 이미 처리됐으므로 읽음 실패가 목록 제거를 되돌리지 않는다.
  expect(gateway.markRead).toHaveBeenCalledWith('group-request-suho');
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '그룹 요청 승인',
    }),
  ).toHaveLength(0);
});

test('unread-count 실패에도 알림 목록은 표시한다', async () => {
  const gateway = createDecisionGateway();
  gateway.getUnreadCount.mockRejectedValue(new Error('badge failed'));
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen {...baseProps} gateway={gateway} currentUserId={7} />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '수호님의 그룹 승인 요청, 방금',
    }).length,
  ).toBeGreaterThan(0);
  // badge는 목록 기준 fallback 개수로 표시한다.
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children?.join?.('') === '읽지 않은 알림 1개'),
  ).toBe(true);
});

// 앱 실행 중 푸시 도착 시 새 알림 실시간 삽입

const FRESH_NOTIFICATION: AppNotification = {
  avatarText: '알',
  body: '새 댓글이 달렸어요.',
  createdAtLabel: '방금',
  groupId: 'group-1',
  id: 'fresh-comment-1',
  isRead: false,
  postId: 'post-fresh',
  relatedJoinRequestStatus: null,
  title: '게시글에 새 댓글이 달렸어요',
  type: 'POST_ACTIVITY',
};

function createPushReceivedSubscriber() {
  const listeners = new Set<() => void>();
  return {
    emit: () => {
      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe: jest.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
  };
}

function unreadLabelShown(
  renderer: TestRenderer.ReactTestRenderer,
  count: number,
): boolean {
  return renderer.root
    .findAllByType(Text)
    .some(
      node => node.props.children?.join?.('') === `읽지 않은 알림 ${count}개`,
    );
}

test('푸시가 도착하면 새 알림만 목록 맨 위에 끼워 넣고 미읽음 수를 올린다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(1),
    loadPage: jest
      .fn()
      .mockResolvedValueOnce({
        hasNext: false,
        notifications: [DEVELOPMENT_NOTIFICATIONS[1]],
      })
      .mockResolvedValue({
        hasNext: false,
        notifications: [FRESH_NOTIFICATION, DEVELOPMENT_NOTIFICATIONS[1]],
      }),
    loadSettings: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
  const subscriber = createPushReceivedSubscriber();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        subscribePushReceived={subscriber.subscribe}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  expect(unreadLabelShown(renderer!, 1)).toBe(true);

  await TestRenderer.act(async () => {
    subscriber.emit();
  });

  expect(gateway.loadPage).toHaveBeenCalledTimes(2);
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '게시글에 새 댓글이 달렸어요, 방금',
    }),
  ).toBeTruthy();
  expect(unreadLabelShown(renderer!, 2)).toBe(true);
});

test('deleted post notifications stay on the list and show an unavailable-post alert', () => {
  const alertSpy = jest
    .spyOn(Alert, 'alert')
    .mockImplementation(() => undefined);
  const onOpenPost = jest.fn();
  const notifications: readonly AppNotification[] = [
    {
      avatarText: 'A',
      body: 'A new post was created.',
      createdAtLabel: 'a moment ago',
      groupId: 'group-1',
      id: 'post-deleted-1',
      isRead: false,
      relatedJoinRequestStatus: null,
      title: '새 게시글이 올라왔어요',
      type: 'NEW_POST',
    },
  ];
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        initialNotifications={notifications}
        onOpenPost={onOpenPost}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityLabel: '새 게시글이 올라왔어요, a moment ago',
      })
      .props.onPress();
  });

  expect(onOpenPost).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(
    '게시글을 볼 수 없어요',
    '작성자가 게시글을 삭제했거나 더 이상 볼 수 없습니다.',
    [{text: '확인'}],
  );
  alertSpy.mockRestore();
});

test('푸시 도착 병합은 읽음 커밋 전 서버 값으로 기존 읽음 상태를 되돌리지 않는다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(1),
    loadPage: jest
      .fn()
      .mockResolvedValueOnce({
        hasNext: false,
        notifications: [DEVELOPMENT_NOTIFICATIONS[1]],
      })
      // 방금 읽음 처리한 알림이 서버에는 아직 미읽음으로 남아 있는 응답.
      .mockResolvedValue({
        hasNext: false,
        notifications: [FRESH_NOTIFICATION, DEVELOPMENT_NOTIFICATIONS[1]],
      }),
    loadSettings: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn().mockResolvedValue({
      id: 'post-reaction-love',
      readAt: '2026-08-05T00:00:00Z',
    }),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
  const subscriber = createPushReceivedSubscriber();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        subscribePushReceived={subscriber.subscribe}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({
        accessibilityLabel: '게시글에 새로운 반응이 있어요, 1시간 전',
      })
      .props.onPress();
    await Promise.resolve();
  });
  expect(unreadLabelShown(renderer!, 0)).toBe(true);

  await TestRenderer.act(async () => {
    subscriber.emit();
  });

  // 새 알림 1개만 미읽음으로 더해지고, 읽음 처리한 기존 알림은 유지된다.
  expect(unreadLabelShown(renderer!, 1)).toBe(true);
  const flatListData = renderer!.root.findByType(FlatList).props
    .data as readonly AppNotification[];
  expect(flatListData[0]?.id).toBe('fresh-comment-1');
  expect(
    flatListData.find(notification => notification.id === 'post-reaction-love')
      ?.isRead,
  ).toBe(true);
});

test('초기 조회 중 도착한 푸시는 즉시 병합하지 않고 조회 완료 후 한 번 병합한다', async () => {
  let resolveInitial:
    | ((value: {
        hasNext: boolean;
        notifications: readonly AppNotification[];
      }) => void)
    | undefined;
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(1),
    loadPage: jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveInitial = resolve;
          }),
      )
      // 초기 조회 스냅샷 이후에 생성된 새 알림을 포함하는 후속 병합 응답.
      .mockResolvedValue({
        hasNext: false,
        notifications: [FRESH_NOTIFICATION, DEVELOPMENT_NOTIFICATIONS[1]],
      }),
    loadSettings: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
  const subscriber = createPushReceivedSubscriber();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        subscribePushReceived={subscriber.subscribe}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  // 초기 조회 응답 전에 푸시가 도착해도 병합 조회를 바로 시작하지 않는다.
  await TestRenderer.act(async () => {
    subscriber.emit();
  });
  expect(gateway.loadPage).toHaveBeenCalledTimes(1);

  await TestRenderer.act(async () => {
    resolveInitial!({
      hasNext: false,
      notifications: [DEVELOPMENT_NOTIFICATIONS[1]],
    });
  });

  // 조회 완료 후 병합이 한 번 실행되어 새 알림이 나타나고 이중 반영은 없다.
  expect(gateway.loadPage).toHaveBeenCalledTimes(2);
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '게시글에 새 댓글이 달렸어요, 방금',
    }),
  ).toBeTruthy();
  expect(unreadLabelShown(renderer!, 2)).toBe(true);
});

test('연속 푸시는 병합 조회를 진행 중 1건 + 후속 1건으로 합친다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(1),
    loadPage: jest
      .fn()
      .mockResolvedValueOnce({
        hasNext: false,
        notifications: [DEVELOPMENT_NOTIFICATIONS[1]],
      })
      .mockResolvedValue({
        hasNext: false,
        notifications: [FRESH_NOTIFICATION, DEVELOPMENT_NOTIFICATIONS[1]],
      }),
    loadSettings: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
  const subscriber = createPushReceivedSubscriber();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        subscribePushReceived={subscriber.subscribe}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    subscriber.emit();
    subscriber.emit();
    subscriber.emit();
  });

  // 초기 조회 1건 + 병합 조회 1건 + 후속 조회 1건. 미읽음은 새 알림 1개만 더해진다.
  expect(gateway.loadPage).toHaveBeenCalledTimes(3);
  expect(unreadLabelShown(renderer!, 2)).toBe(true);
});

test('목록 조회 실패 후 푸시가 오면 증분 병합 대신 초기 조회로 복구해 이중 계산을 막는다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValue(2),
    loadPage: jest
      .fn()
      .mockRejectedValueOnce(new Error('목록 조회 실패'))
      .mockResolvedValue({
        hasNext: false,
        notifications: [FRESH_NOTIFICATION, DEVELOPMENT_NOTIFICATIONS[1]],
      }),
    loadSettings: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
  const subscriber = createPushReceivedSubscriber();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen
        {...baseProps}
        gateway={gateway}
        currentUserId={7}
        subscribePushReceived={subscriber.subscribe}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  // 목록은 실패했지만 unread-count는 성공한 어긋난 상태.
  expect(unreadLabelShown(renderer!, 1)).toBe(true);

  await TestRenderer.act(async () => {
    subscriber.emit();
  });

  // 절대값으로 복구: 목록 2건과 서버 미읽음 2가 함께 반영된다(증분이면 1+2=3).
  expect(gateway.loadPage).toHaveBeenCalledTimes(2);
  expect(gateway.getUnreadCount).toHaveBeenCalledTimes(2);
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '게시글에 새 댓글이 달렸어요, 방금',
    }),
  ).toBeTruthy();
  expect(unreadLabelShown(renderer!, 2)).toBe(true);
});
