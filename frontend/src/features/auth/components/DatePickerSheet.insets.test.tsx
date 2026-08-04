import React from 'react';
import {AccessibilityInfo, StyleSheet} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {DatePickerSheet} from './DatePickerSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 48, left: 0, right: 0, top: 0}),
}));

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
});

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

test('시트 높이와 하단 패딩에 시스템 내비게이션 바 인셋을 반영한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <DatePickerSheet
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        value="1960-01-01"
        visible
      />,
    );
  });
  mountedRenderers.push(renderer!);

  // 고정 높이 342에 인셋 48이 더해지고, 같은 값이 하단 패딩으로 들어간다.
  const sheetNodes = renderer!.root.findAll(node => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.height === 342 + 48 && style?.paddingBottom === 48;
  });
  expect(sheetNodes.length).toBeGreaterThan(0);
});
