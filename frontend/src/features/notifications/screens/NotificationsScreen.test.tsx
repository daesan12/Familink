import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {
  DEVELOPMENT_NOTIFICATIONS,
  EMPTY_NOTIFICATIONS,
} from '../fixtures/notificationFixtures';
import type {NotificationGateway} from '../types';
import {NotificationsScreen} from './NotificationsScreen';

jest.mock('lucide-react-native/icons/bell-off', () => 'BellOff');
jest.mock('lucide-react-native/icons/check', () => 'Check');
jest.mock('lucide-react-native/icons/chevron-left', () => 'ChevronLeft');
jest.mock('lucide-react-native/icons/x', () => 'X');

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'guardian'} as const,
  role: 'guardian' as const,
};

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
  );
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children?.join?.('') === '읽지 않은 알림 1개'),
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
        String(node.props.children).includes(
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
        String(node.props.children).includes(
          '그룹 참여 신청이 거절되었습니다.',
        ),
      ),
  ).toBe(true);

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '수호님의 그룹 승인 요청, 방금',
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
    const summaryButtons = renderer!.root.findAllByProps({
      accessibilityRole: 'button',
    });
    const button = summaryButtons.find(item => {
      const child = item.props.children;
      return child?.props?.children === '모두 읽음';
    });
    expect(button).toBeTruthy();
    button!.props.onPress();
    await Promise.resolve();
  });
  expect(gateway.markAllRead).toHaveBeenCalledTimes(1);
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

test('실제 gateway의 그룹 요청 거부도 읽음 처리해 badge를 줄인다', async () => {
  const gateway = {
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
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationsScreen {...baseProps} gateway={gateway} currentUserId={7} />,
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

  expect(gateway.markRead).toHaveBeenCalledWith('group-request-suho');
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children?.join?.('') === '읽지 않은 알림 0개'),
  ).toBe(true);
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '수호님의 그룹 승인 요청, 방금',
    }),
  ).toHaveLength(0);
});

test('그룹 요청 승인 읽음 API 실패 후 역할을 선택해도 알림을 보존한다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(1),
    loadPage: jest.fn().mockResolvedValue({
      hasNext: false,
      notifications: [DEVELOPMENT_NOTIFICATIONS[0]],
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
      <NotificationsScreen {...baseProps} gateway={gateway} currentUserId={7} />,
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

  expect(gateway.markRead).toHaveBeenCalledTimes(1);
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '수호님의 그룹 승인 요청, 방금',
    }).length,
  ).toBeGreaterThan(0);
});
