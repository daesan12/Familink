import React from 'react';
import {Switch, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {DEFAULT_NOTIFICATION_SETTINGS} from '../fixtures/notificationFixtures';
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
