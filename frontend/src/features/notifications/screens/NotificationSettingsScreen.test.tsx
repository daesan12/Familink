import React from 'react';
import {Switch, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {DEFAULT_NOTIFICATION_SETTINGS} from '../fixtures/notificationFixtures';
import type {NotificationGateway} from '../types';
import {NotificationSettingsScreen} from './NotificationSettingsScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

test('7개 푸시 설정을 기본값(모두 켜짐)으로 표시한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationSettingsScreen onBack={jest.fn()} />,
    );
  });
  mountedRenderers.push(renderer!);

  expect(DEFAULT_NOTIFICATION_SETTINGS).toHaveLength(7);
  const switches = renderer!.root.findAllByType(Switch);
  expect(switches).toHaveLength(7);
  expect(switches.every(node => node.props.value === true)).toBe(true);
});

test('4개 섹션 제목을 순서대로 표시한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationSettingsScreen onBack={jest.fn()} />,
    );
  });
  mountedRenderers.push(renderer!);

  const texts = renderer!.root
    .findAllByType(Text)
    .map(node => node.props.children);
  ['가족 피드', '캘린더', '리포트', '가족 그룹'].forEach(title => {
    expect(texts).toContain(title);
  });
});

test('토글하면 해당 설정만 꺼진다', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationSettingsScreen onBack={jest.fn()} />,
    );
  });
  mountedRenderers.push(renderer!);

  const findNewPost = () =>
    renderer!.root.findByProps({accessibilityLabel: '새 게시글 푸시 알림'});
  expect(findNewPost().props.value).toBe(true);

  TestRenderer.act(() => {
    findNewPost().props.onValueChange();
  });

  expect(findNewPost().props.value).toBe(false);
  expect(
    renderer!.root
      .findAllByType(Switch)
      .filter(node => node.props.value === true),
  ).toHaveLength(6);
});

test('뒤로 가기를 누르면 onBack을 호출한다', () => {
  const onBack = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NotificationSettingsScreen onBack={onBack} />,
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root.findByProps({accessibilityLabel: '뒤로 가기'}).props.onPress();
  });

  expect(onBack).toHaveBeenCalledTimes(1);
});

test('실제 gateway 경로에서 설정을 조회하고 토글을 저장한다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn(),
    loadPage: jest.fn(),
    loadSettings: jest.fn().mockResolvedValue(DEFAULT_NOTIFICATION_SETTINGS),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn().mockResolvedValue({
      updatedAt: '2026-08-01T00:00:00Z',
    }),
  } as unknown as jest.Mocked<NotificationGateway>;
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationSettingsScreen gateway={gateway} onBack={jest.fn()} />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  expect(gateway.loadSettings).toHaveBeenCalledTimes(1);
  const newPostSwitch = renderer!.root.findByProps({
    accessibilityLabel: '새 게시글 푸시 알림',
  });
  await TestRenderer.act(async () => {
    newPostSwitch.props.onValueChange();
    await Promise.resolve();
  });
  expect(gateway.updateSettings).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({enabled: false, type: 'NEW_POST'}),
    ]),
  );
});

test('설정 저장 실패 시 optimistic 토글을 원래 값으로 되돌린다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn(),
    loadPage: jest.fn(),
    loadSettings: jest.fn().mockResolvedValue(DEFAULT_NOTIFICATION_SETTINGS),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn().mockRejectedValue(new Error('save failed')),
  } as unknown as jest.Mocked<NotificationGateway>;
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationSettingsScreen gateway={gateway} onBack={jest.fn()} />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  const newPostSwitch = renderer!.root.findByProps({
    accessibilityLabel: '새 게시글 푸시 알림',
  });
  await TestRenderer.act(async () => {
    newPostSwitch.props.onValueChange();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(newPostSwitch.props.value).toBe(true);
  expect(
    renderer!.root.findByProps({accessibilityRole: 'alert'}),
  ).toBeTruthy();
});

test('설정 조회 실패 시 기본값 토글을 잠그고 서버 설정을 덮어쓰지 않는다', async () => {
  const gateway = {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn(),
    loadPage: jest.fn(),
    loadSettings: jest.fn().mockRejectedValue(new Error('load failed')),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NotificationSettingsScreen gateway={gateway} onBack={jest.fn()} />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  const newPostSwitch = renderer!.root.findByProps({
    accessibilityLabel: '새 게시글 푸시 알림',
  });
  expect(newPostSwitch.props.disabled).toBe(true);
  expect(gateway.updateSettings).not.toHaveBeenCalled();
});
