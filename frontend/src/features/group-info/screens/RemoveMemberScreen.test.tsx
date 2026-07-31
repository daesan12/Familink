import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {GroupMember} from '../types';
import {RemoveMemberScreen} from './RemoveMemberScreen';

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
  member({
    memberId: 'm-dad',
    name: '손수호',
    alias: '아빠',
    role: 'guardian',
    joinedAt: '2026-03-04',
  }),
  member({memberId: 'm-sister', name: '홍유라', alias: '딸', role: 'careReceiver'}),
];

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function render(
  onRemoveMember?: (id: string) => void,
  onBack: () => void = () => {},
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <RemoveMemberScreen
        currentMemberId="m-manager"
        members={MEMBERS}
        onBack={onBack}
        onRemoveMember={onRemoveMember}
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

test('1단계는 본인을 제외한 내보낼 수 있는 구성원을 보여준다', () => {
  const renderer = render();

  expect(hasText(renderer, '내보낼 구성원을 선택하세요')).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '손수호 내보내기 선택'}),
  ).toBeTruthy();
  // 본인(이경호)은 내보낼 수 없어 목록에 없다.
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '이경호 내보내기 선택'}),
  ).toHaveLength(0);
});

test('구성원을 고르면 확인 단계에서 가입일과 안내를 보여준다', () => {
  const renderer = render();

  press(renderer, '손수호 내보내기 선택');

  expect(hasText(renderer, '내보낼 구성원')).toBe(true);
  expect(hasText(renderer, '손수호')).toBe(true);
  // 관계·가입일(목업)이 카드에 노출된다.
  expect(hasText(renderer, '아빠 · 가입 2026.03.04')).toBe(true);
  expect(
    hasText(renderer, '• 이 그룹의 가족 기록을 더 이상 볼 수 없어요.'),
  ).toBe(true);
});

test('체크 전에는 내보내기가 비활성이고, 체크하면 콜백을 부른다', () => {
  const removed: string[] = [];
  const backs: number[] = [];
  const renderer = render((id) => removed.push(id), () => backs.push(1));

  press(renderer, '손수호 내보내기 선택');

  const button = renderer.root.findByProps({accessibilityLabel: '구성원 내보내기'});
  expect(button.props.accessibilityState.disabled).toBe(true);
  press(renderer, '구성원 내보내기');
  expect(removed).toEqual([]);

  // 확인 체크 후에는 활성화되어 콜백과 복귀가 실행된다.
  press(renderer, '위 내용을 확인했으며 구성원을 내보냅니다');
  expect(
    renderer.root.findByProps({accessibilityLabel: '구성원 내보내기'}).props
      .accessibilityState.disabled,
  ).toBe(false);

  press(renderer, '구성원 내보내기');
  expect(removed).toEqual(['m-dad']);
  expect(backs).toEqual([1]);
});

test('확인 단계에서 뒤로 가면 선택 단계로 돌아간다', () => {
  const backs: number[] = [];
  const renderer = render(undefined, () => backs.push(1));

  press(renderer, '손수호 내보내기 선택');
  expect(hasText(renderer, '내보낼 구성원을 선택하세요')).toBe(false);

  // 확인 단계에서 뒤로: 목록으로 복귀하며 H-1로 나가지 않는다.
  press(renderer, '뒤로 가기');
  expect(hasText(renderer, '내보낼 구성원을 선택하세요')).toBe(true);
  expect(backs).toEqual([]);
});
