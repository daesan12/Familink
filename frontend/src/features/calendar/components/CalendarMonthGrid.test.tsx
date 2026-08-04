import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {createCalendarMonth} from '../calendarModel';
import type {CalendarEventSummary} from '../types';
import {CalendarMonthGrid} from './CalendarMonthGrid';

function createEvent(
  index: number,
  date = '2026-08-04',
  title = `일정 ${index}`,
): CalendarEventSummary {
  return {
    endAt: null,
    endDate: date,
    eventDate: date,
    id: `event-${index}`,
    startAt: null,
    title,
  };
}

function textLabels(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text).map(node =>
    Array.isArray(node.props.children)
      ? node.props.children.join('')
      : String(node.props.children),
  );
}

test('셀에 완전히 들어가는 일정만 표시하고 나머지는 +N으로 집계한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <CalendarMonthGrid
        events={[1, 2, 3, 4, 5].map(index => createEvent(index))}
        month={createCalendarMonth(2026, 8)}
        onSelectDate={jest.fn()}
        selectedDate="2026-08-04"
        today="2026-08-04"
      />,
    );
  });

  TestRenderer.act(() => {
    renderer!.root.findByProps({testID: 'calendar-month-grid'}).props.onLayout({
      nativeEvent: {layout: {height: 564}},
    });
  });

  const visibleLabels = textLabels(renderer!);

  expect(visibleLabels).toContain('일정 1');
  expect(visibleLabels).not.toContain('일정 3');
  expect(visibleLabels.filter(label => label === '+3')).toHaveLength(1);

  TestRenderer.act(() => renderer!.unmount());
});

test('행이 매우 낮으면 일정 띠를 숨기고 전체 개수만 표시한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <CalendarMonthGrid
        events={[1, 2, 3].map(index => createEvent(index))}
        month={createCalendarMonth(2026, 8)}
        onSelectDate={jest.fn()}
        selectedDate="2026-08-04"
        today="2026-08-04"
      />,
    );
  });

  TestRenderer.act(() => {
    renderer!.root.findByProps({testID: 'calendar-month-grid'}).props.onLayout({
      nativeEvent: {layout: {height: 240}},
    });
  });

  const visibleLabels = textLabels(renderer!);

  expect(visibleLabels).not.toContain('일정 1');
  expect(visibleLabels.filter(label => label === '+3')).toHaveLength(1);

  TestRenderer.act(() => renderer!.unmount());
});

test('같은 주의 다른 날짜가 넘쳐도 두 일정은 모두 표시한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const events = [
    createEvent(1, '2026-08-16', '16일 일정 1'),
    createEvent(2, '2026-08-16', '16일 일정 2'),
    createEvent(3, '2026-08-20', '20일 일정 1'),
    createEvent(4, '2026-08-20', '20일 일정 2'),
    createEvent(5, '2026-08-20', '20일 일정 3'),
  ];

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <CalendarMonthGrid
        events={events}
        month={createCalendarMonth(2026, 8)}
        onSelectDate={jest.fn()}
        selectedDate="2026-08-16"
        today="2026-08-04"
      />,
    );
  });

  TestRenderer.act(() => {
    renderer!.root.findByProps({testID: 'calendar-month-grid'}).props.onLayout({
      nativeEvent: {layout: {height: 454}},
    });
  });

  const visibleLabels = textLabels(renderer!);
  const day16Labels = renderer!.root
    .findByProps({accessibilityLabel: '2026년 8월 16일'})
    .findAllByType(Text)
    .map(node => String(node.props.children));
  const day20Labels = renderer!.root
    .findByProps({accessibilityLabel: '2026년 8월 20일'})
    .findAllByType(Text)
    .map(node =>
      Array.isArray(node.props.children)
        ? node.props.children.join('')
        : String(node.props.children),
    );

  expect(visibleLabels).toEqual(
    expect.arrayContaining([
      '16일 일정 1',
      '16일 일정 2',
      '20일 일정 1',
      '20일 일정 2',
    ]),
  );
  expect(visibleLabels).not.toContain('20일 일정 3');
  expect(day16Labels).not.toContain('+1');
  expect(day20Labels).toContain('+1');

  TestRenderer.act(() => renderer!.unmount());
});
