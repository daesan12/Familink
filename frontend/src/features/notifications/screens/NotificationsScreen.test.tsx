import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {
  DEVELOPMENT_NOTIFICATIONS,
  EMPTY_NOTIFICATIONS,
} from '../fixtures/notificationFixtures';
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
