import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {LeaveGroupScreen} from './LeaveGroupScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function render(overrides: {
  onLeaveGroup?: () => void;
  onGoToChangeManager?: () => void;
  isViewerManager?: boolean;
}) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <LeaveGroupScreen
        groupName="우리 가족"
        isViewerManager={overrides.isViewerManager ?? false}
        managerName="이경호"
        memberCount={4}
        onBack={() => {}}
        onGoToChangeManager={overrides.onGoToChangeManager ?? (() => {})}
        onLeaveGroup={overrides.onLeaveGroup}
      />,
    );
  });
  mounted.push(renderer!);
  return renderer!;
}

function leaveDisabled(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({accessibilityLabel: '그룹 나가기'}).props
    .accessibilityState.disabled;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some((node) => {
    const children = node.props.children;
    return Array.isArray(children)
      ? children.join('') === value
      : children === value;
  });
}

function press(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const target = renderer.root.findByProps({accessibilityLabel: label});
  TestRenderer.act(() => {
    target.props.onPress();
  });
}

test('그룹 요약과 나가기 안내를 보여준다', () => {
  const renderer = render({});

  expect(hasText(renderer, '정말 그룹을 나가시겠어요?')).toBe(true);
  expect(hasText(renderer, '나가면 다시 초대받기 전까지 그룹을 볼 수 없어요.')).toBe(
    true,
  );
  expect(hasText(renderer, '우리 가족')).toBe(true);
  // 가족 기록 개수는 제공하는 API가 없어 표시하지 않는다(F-19).
  expect(hasText(renderer, '구성원 4명')).toBe(true);
  expect(hasText(renderer, '그룹관리자 · 이경호')).toBe(true);
});

test('비관리자에게는 관리자 전용 위임 안내를 보여주지 않는다', () => {
  const renderer = render({isViewerManager: false});

  expect(hasText(renderer, '그룹관리자는 바로 나갈 수 없어요')).toBe(false);
  // 관리자만 쓸 수 있는 H-6 링크도 노출하지 않는다.
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '그룹관리자 변경하기'}),
  ).toHaveLength(0);
});

test('관리자에게는 위임 안내와 H-6 이동 링크를 보여준다', () => {
  const navigated: number[] = [];
  const renderer = render({
    isViewerManager: true,
    onGoToChangeManager: () => navigated.push(1),
  });

  expect(hasText(renderer, '그룹관리자는 바로 나갈 수 없어요')).toBe(true);
  press(renderer, '그룹관리자 변경하기');
  expect(navigated).toEqual([1]);
});

test('조회자가 관리자가 아니면 나가기 버튼이 활성이며 콜백을 부른다', () => {
  const left: number[] = [];
  const renderer = render({
    isViewerManager: false,
    onLeaveGroup: () => left.push(1),
  });

  expect(leaveDisabled(renderer)).toBe(false);
  press(renderer, '그룹 나가기');
  expect(left).toEqual([1]);
});

test('조회자가 관리자이면 나가기 버튼이 비활성이라 콜백을 부르지 않는다', () => {
  const left: number[] = [];
  const renderer = render({
    isViewerManager: true,
    onLeaveGroup: () => left.push(1),
  });

  // 먼저 다른 구성원에게 위임해야 나갈 수 있어 버튼이 비활성이다.
  expect(leaveDisabled(renderer)).toBe(true);
  press(renderer, '그룹 나가기');
  expect(left).toEqual([]);
});
