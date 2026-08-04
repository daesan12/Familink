import React from 'react';
import {Modal, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {ManagerAccessNoticeModal} from './ManagerAccessNoticeModal';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

function render(onClose = jest.fn()) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ManagerAccessNoticeModal onClose={onClose} visible />,
    );
  });
  mounted.push(renderer!);
  return renderer!;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some(node => {
    const children = node.props.children;
    return Array.isArray(children)
      ? children.join('') === value
      : children === value;
  });
}

test('서비스 톤의 관리자 권한 안내 문구와 확인 버튼을 보여준다', () => {
  const renderer = render();

  expect(hasText(renderer, '그룹 관리 권한이 필요해요')).toBe(true);
  expect(hasText(renderer, '그룹관리자만 접근할 수 있습니다')).toBe(true);
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '그룹관리자 접근 안내 확인',
    }),
  ).toBeTruthy();
});

test('확인 버튼과 하드웨어 뒤로 가기로 안내 팝업을 닫는다', () => {
  const onClose = jest.fn();
  const renderer = render(onClose);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '그룹관리자 접근 안내 확인'})
      .props.onPress();
  });
  TestRenderer.act(() => {
    renderer.root.findByType(Modal).props.onRequestClose();
  });

  expect(onClose).toHaveBeenCalledTimes(2);
});
