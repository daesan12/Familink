import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {RenameGroupScreen} from './RenameGroupScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function render(
  onRenameGroup?: (name: string) => void,
  onBack: () => void = () => {},
  currentName = '우리 가족',
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <RenameGroupScreen
        currentName={currentName}
        onBack={onBack}
        onRenameGroup={onRenameGroup}
      />,
    );
  });
  mounted.push(renderer!);
  return renderer!;
}

function type(renderer: TestRenderer.ReactTestRenderer, value: string) {
  const input = renderer.root.findByProps({accessibilityLabel: '그룹 이름 입력'});
  TestRenderer.act(() => {
    input.props.onChangeText(value);
  });
}

function submitDisabled(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({accessibilityLabel: '변경하기'}).props
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

test('현재 이름과 같으면 변경 버튼이 비활성이다', () => {
  const renderer = render();

  expect(hasText(renderer, '그룹 이름을 변경하세요')).toBe(true);
  // 초깃값이 현재 이름이라 변경된 게 없어 비활성.
  expect(submitDisabled(renderer)).toBe(true);
});

test('공백만 있으면 비활성, 유효한 새 이름이면 활성이 된다', () => {
  const renderer = render();

  type(renderer, '   ');
  expect(submitDisabled(renderer)).toBe(true);

  type(renderer, '새 가족 이름');
  expect(submitDisabled(renderer)).toBe(false);
});

test('입력은 10자를 넘지 않도록 잘린다', () => {
  const renderer = render();

  type(renderer, '가나다라마바사아자차카타');
  const input = renderer.root.findByProps({accessibilityLabel: '그룹 이름 입력'});
  expect(input.props.value).toBe('가나다라마바사아자차');
});

test('유효한 이름으로 변경하면 다듬은 값을 콜백에 넘기고 복귀한다', () => {
  const names: string[] = [];
  const backs: number[] = [];
  const renderer = render((name) => names.push(name), () => backs.push(1));

  type(renderer, '  새 가족  ');
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '변경하기'}).props.onPress();
  });

  expect(names).toEqual(['새 가족']);
  expect(backs).toEqual([1]);
});
