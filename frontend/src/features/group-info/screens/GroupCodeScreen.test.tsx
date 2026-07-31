import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {GroupInviteCode} from '../types';
import {GroupCodeScreen} from './GroupCodeScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some((node) => {
    const children = node.props.children;
    const joined = Array.isArray(children) ? children.join('') : children;
    return joined === value;
  });
}

async function renderScreen(
  loader: () => Promise<GroupInviteCode>,
  onCopyCode?: (code: string) => void,
) {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <GroupCodeScreen
        groupId="g-1"
        loader={loader}
        onBack={() => {}}
        onCopyCode={onCopyCode}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

test('그룹 코드와 초대 안내를 보여주고, 복사를 위임한다', async () => {
  const copied: string[] = [];
  const renderer = await renderScreen(
    () => Promise.resolve({inviteCode: '176203'}),
    (code) => copied.push(code),
  );

  expect(hasText(renderer, '가족을 초대해 보세요')).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '그룹 코드 176203'}),
  ).toBeTruthy();

  const copyButton = renderer.root.findByProps({
    accessibilityLabel: '그룹 코드 복사',
  });
  TestRenderer.act(() => {
    copyButton.props.onPress();
  });
  expect(copied).toEqual(['176203']);
});

test('로딩 중에는 코드 대신 로딩 표시를 보여준다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupCodeScreen
        groupId="g-1"
        loader={() => new Promise<GroupInviteCode>(() => {})}
        onBack={() => {}}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  expect(
    renderer!.root.findByProps({accessibilityLabel: '그룹 코드 불러오는 중'}),
  ).toBeTruthy();
});

test('로더 실패 시 안내와 다시 시도를 보여준다', async () => {
  const renderer = await renderScreen(() =>
    Promise.reject(new Error('실패')),
  );

  expect(
    hasText(renderer, '그룹 코드를 불러오지 못했어요. 다시 시도해 주세요.'),
  ).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '다시 시도'}),
  ).toBeTruthy();
});
