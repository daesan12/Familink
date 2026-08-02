import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {CarnationStamp} from './CarnationStamp';
import {MonthlyStampModal} from './MonthlyStampModal';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

// 가입월(2026-06)~현재월(2026-07) 범위. 7월로 열린다.
function render(overrides: Record<string, unknown> = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <MonthlyStampModal
        maxMonth={7}
        maxYear={2026}
        minMonth={6}
        minYear={2026}
        onClose={jest.fn()}
        onMonthChange={jest.fn()}
        onRetry={jest.fn()}
        state={{
          earnedDates: ['2026-07-02', '2026-06-30'],
          status: 'success',
        }}
        visible
        month={7}
        year={2026}
        {...overrides}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function titleShown(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root
    .findAllByType(Text)
    .some(node => node.props.children === value);
}

test('현재월(상한)에서는 다음 달 이동이 막히고 이전 달은 열려 있다', () => {
  const renderer = render();
  expect(titleShown(renderer, '2026년 7월')).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '다음 달'}).props
      .accessibilityState.disabled,
  ).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '이전 달'}).props
      .accessibilityState.disabled,
  ).toBe(false);
});

test('가입월(하한)까지 내려가면 이전 달 이동이 막힌다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '이전 달'}).props.onPress();
  });
  TestRenderer.act(() => {
    renderer.update(
      <MonthlyStampModal
        maxMonth={7}
        maxYear={2026}
        minMonth={6}
        minYear={2026}
        month={6}
        onClose={jest.fn()}
        onMonthChange={jest.fn()}
        onRetry={jest.fn()}
        state={{earnedDates: ['2026-06-30'], status: 'success'}}
        visible
        year={2026}
      />,
    );
  });
  expect(titleShown(renderer, '2026년 6월')).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '이전 달'}).props
      .accessibilityState.disabled,
  ).toBe(true);
});

test('월 이동은 부모 콜백에만 알리고 부모가 반영한 월을 표시한다', () => {
  const onMonthChange = jest.fn();
  const renderer = render({onMonthChange});

  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '이전 달'}).props.onPress();
  });

  expect(onMonthChange).toHaveBeenCalledWith(2026, 6);
  expect(titleShown(renderer, '2026년 7월')).toBe(true);
});

test('인접 달 스필오버 도장은 흐리게, 기준 달 도장은 진하게 표시한다', () => {
  const renderer = render();
  const stamps = renderer.root.findAllByType(CarnationStamp);
  // 첫 칸은 6월 28일(스필오버)로 흐리게 표시된다.
  expect(stamps[0]?.props.dimmed).toBe(true);
  // 기준 달(7월) 도장은 흐리지 않다.
  const inMonthDimmed = stamps.filter(stamp => stamp.props.dimmed === false);
  expect(inMonthDimmed.length).toBeGreaterThanOrEqual(31);
});
