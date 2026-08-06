import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {GroupMember} from '../types';
import {ChangeManagerScreen} from './ChangeManagerScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

function member(
  overrides: Partial<GroupMember> & {memberId: string},
): GroupMember {
  return {
    name: '이름',
    alias: null,
    role: 'guardian',
    isManager: false,
    avatarText: '이',
    age: 30,
    gender: 'male',
    weeklyRank: 1,
    weeklyStamps: [false, false, false, false, false, false, false],
    ...overrides,
  };
}

const MEMBERS: readonly GroupMember[] = [
  member({memberId: 'm-manager', name: '이경호', role: 'guardian', isManager: true}),
  member({memberId: 'm-dad', name: '손수호', alias: '아빠', role: 'guardian'}),
  member({memberId: 'm-sister', name: '홍유라', alias: '딸', role: 'careReceiver'}),
];

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function render(
  onChangeManager?: (id: string) => void,
  onBack: () => void = () => {},
  members: readonly GroupMember[] = MEMBERS,
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ChangeManagerScreen
        currentMemberId="m-manager"
        members={members}
        onBack={onBack}
        onChangeManager={onChangeManager}
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

test('피보호자도 후보로 보여준다', () => {
  const renderer = render();

  expect(hasText(renderer, '이경호')).toBe(true);
  expect(hasText(renderer, '손수호')).toBe(true);
  // 관리자 여부는 역할과 독립이라 피보호자 홍유라도 후보다.
  expect(hasText(renderer, '홍유라')).toBe(true);
});

test('피보호자를 골라도 변경할 수 있다', () => {
  const submitted: string[] = [];
  const renderer = render((id) => submitted.push(id));

  // 목록에 보이기만 하고 현재 관리자처럼 비활성이면 안 된다.
  press(renderer, '홍유라 선택');
  const sisterRow = renderer.root.findByProps({accessibilityLabel: '홍유라 선택'});
  expect(sisterRow.props.accessibilityState.disabled).toBe(false);
  expect(sisterRow.props.accessibilityState.selected).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '그룹관리자 변경하기'}).props
      .accessibilityState.disabled,
  ).toBe(false);

  press(renderer, '그룹관리자 변경하기');
  expect(submitted).toEqual(['m-sister']);
});

test('관리자 외 전원이 피보호자여도 위임할 수 있다', () => {
  // 이 구성에서 후보가 0명이면 관리자는 위임도 그룹 나가기도 못 하는 상태에 갇힌다.
  const submitted: string[] = [];
  const renderer = render((id) => submitted.push(id), () => {}, [
    member({memberId: 'm-manager', name: '이경호', isManager: true}),
    member({memberId: 'm-sister', name: '홍유라', role: 'careReceiver'}),
  ]);

  press(renderer, '홍유라 선택');
  press(renderer, '그룹관리자 변경하기');

  expect(submitted).toEqual(['m-sister']);
});

test('현재 관리자는 라벨과 함께 선택할 수 없다', () => {
  const renderer = render();

  expect(hasText(renderer, '현재 그룹관리자')).toBe(true);
  const managerRow = renderer.root.findByProps({accessibilityLabel: '이경호 선택'});
  expect(managerRow.props.accessibilityState.disabled).toBe(true);
});

test('현재와 다른 보호자를 골라야 변경 버튼이 활성화된다', () => {
  const submitted: string[] = [];
  const backs: number[] = [];
  const renderer = render((id) => submitted.push(id), () => backs.push(1));

  // 아무도 고르지 않으면 비활성이라 눌러도 콜백이 없다.
  const button = renderer.root.findByProps({
    accessibilityLabel: '그룹관리자 변경하기',
  });
  expect(button.props.accessibilityState.disabled).toBe(true);
  press(renderer, '그룹관리자 변경하기');
  expect(submitted).toEqual([]);

  // 손수호를 고르면 활성화되고, 선택 강조(selected)가 표시된다.
  press(renderer, '손수호 선택');
  const dadRow = renderer.root.findByProps({accessibilityLabel: '손수호 선택'});
  expect(dadRow.props.accessibilityState.selected).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '그룹관리자 변경하기'}).props
      .accessibilityState.disabled,
  ).toBe(false);

  press(renderer, '그룹관리자 변경하기');
  expect(submitted).toEqual(['m-dad']);
  // 확정 후 뒤로(H-1) 복귀 콜백이 불린다.
  expect(backs).toEqual([1]);
});
