import React from 'react';
import {AccessibilityInfo, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {DatePickerSheet} from './DatePickerSheet';

jest.mock('react-native-safe-area-context', () => {
  const {View} = jest.requireActual('react-native');

  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

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

function selectedYear(renderer: TestRenderer.ReactTestRenderer): string {
  // 휠의 선택 항목은 selectedText 스타일(스타일 배열 두 번째 요소)이 켜진다.
  const selectedTexts = renderer.root
    .findAllByType(Text)
    .filter(
      node =>
        Array.isArray(node.props.style) && Boolean(node.props.style[1]),
    );
  return String(selectedTexts[0]?.props.children ?? '');
}

test('선택값이 없으면 initialValue 연도에서 휠을 시작한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <DatePickerSheet
        initialValue="1960-01-01"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        value=""
        visible
      />,
    );
  });
  mountedRenderers.push(renderer!);

  expect(selectedYear(renderer!)).toBe('1960');
});

test('이미 선택한 생년월일이 있으면 initialValue보다 우선한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <DatePickerSheet
        initialValue="1960-01-01"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        value="2001-02-03"
        visible
      />,
    );
  });
  mountedRenderers.push(renderer!);

  expect(selectedYear(renderer!)).toBe('2001');
});
