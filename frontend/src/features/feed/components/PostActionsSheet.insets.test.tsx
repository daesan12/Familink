import React from 'react';
import {StyleSheet} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {PostActionsSheet} from './PostActionsSheet';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 48, left: 0, right: 0, top: 0}),
}));

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

test('시트 하단 패딩에 시스템 내비게이션 바 인셋을 더한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <PostActionsSheet
        isOpen
        onClose={jest.fn()}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  // 시트 컨테이너는 기존 패딩 12에 인셋 48을 더한 60을 가져야 한다.
  const sheetNodes = renderer!.root.findAll(node => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      style?.paddingBottom === 12 + 48 &&
      style?.borderTopLeftRadius !== undefined
    );
  });
  expect(sheetNodes.length).toBeGreaterThan(0);
});
