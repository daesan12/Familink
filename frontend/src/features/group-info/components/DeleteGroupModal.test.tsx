import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {DeleteGroupModal} from './DeleteGroupModal';

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function render(overrides: {
  visible?: boolean;
  onClose?: () => void;
  onDeleteGroup?: () => void;
}) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <DeleteGroupModal
        onClose={overrides.onClose ?? (() => {})}
        onDeleteGroup={overrides.onDeleteGroup}
        visible={overrides.visible ?? true}
      />,
    );
  });
  mounted.push(renderer!);
  return renderer!;
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

test('확인 문구와 삭제 버튼을 보여준다', () => {
  const renderer = render({});

  expect(hasText(renderer, '정말 그룹을 삭제하시겠어요?')).toBe(true);
  expect(hasText(renderer, '그룹 삭제')).toBe(true);
});

test('삭제를 누르면 삭제 콜백과 닫기 콜백을 부른다', () => {
  const deleted: number[] = [];
  const closed: number[] = [];
  const renderer = render({
    onClose: () => closed.push(1),
    onDeleteGroup: () => deleted.push(1),
  });

  press(renderer, '그룹 삭제 확정');
  expect(deleted).toEqual([1]);
  expect(closed).toEqual([1]);
});

test('배경을 누르면 닫기 콜백만 부른다', () => {
  const deleted: number[] = [];
  const closed: number[] = [];
  const renderer = render({
    onClose: () => closed.push(1),
    onDeleteGroup: () => deleted.push(1),
  });

  press(renderer, '그룹 삭제 닫기');
  expect(deleted).toEqual([]);
  expect(closed).toEqual([1]);
});
