import React from 'react';
import {Alert, Text, TextInput} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {GroupMember} from '../types';
import {GroupInfoScreen} from './GroupInfoScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'guardian'} as const,
  role: 'guardian' as const,
};

// 방장(이경호)과 일반 구성원(손수호)을 포함한 목업.
const MEMBERS: readonly GroupMember[] = [
  {
    memberId: 'm-manager',
    name: '이경호',
    alias: null,
    role: 'guardian',
    isManager: true,
    avatarText: '경',
    age: 30,
    gender: 'male',
    weeklyRank: 1,
    weeklyStamps: [true, true, true, false, true, true, false],
  },
  {
    memberId: 'm-dad',
    name: '손수호',
    alias: '아빠',
    role: 'guardian',
    isManager: false,
    avatarText: '수',
    age: 52,
    gender: 'male',
    weeklyRank: 4,
    weeklyStamps: [true, true, false, true, false, false, false],
  },
  {
    memberId: 'm-sister',
    name: '홍유라',
    alias: '여동생',
    role: 'careReceiver',
    isManager: false,
    avatarText: '유',
    age: 24,
    gender: 'female',
    weeklyRank: 3,
    weeklyStamps: [true, false, true, true, false, false, true],
  },
];

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  jest.restoreAllMocks();
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function renderScreen(currentMemberId = 'm-manager') {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        {...baseProps}
        currentMemberId={currentMemberId}
        initialMembers={MEMBERS}
        pendingJoinCount={2}
      />,
    );
  });
  mountedRenderers.push(renderer!);
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

function press(
  renderer: TestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
) {
  const target = renderer.root.findByProps({accessibilityLabel});
  TestRenderer.act(() => {
    target.props.onPress();
  });
}

function countDesc(
  renderer: TestRenderer.ReactTestRenderer,
  substring: string,
) {
  return renderer.root.findAll(
    (node) =>
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.includes(substring),
  ).length;
}

function countText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).filter((node) => {
    const children = node.props.children;
    return Array.isArray(children)
      ? children.join('') === value
      : children === value;
  }).length;
}

test('제목과 구성원 수, 호칭·실제 이름을 함께 보여준다', () => {
  const renderer = renderScreen();

  expect(hasText(renderer, '그룹 정보')).toBe(true);
  expect(hasText(renderer, '피보호자 1명, 보호자 2명')).toBe(true);
  // 호칭(아빠)과 실제 이름(손수호)이 모두 노출된다.
  expect(hasText(renderer, '아빠')).toBe(true);
  expect(hasText(renderer, '손수호')).toBe(true);
  // 방장에게는 그룹관리자 태그가 붙는다.
  expect(hasText(renderer, '그룹관리자')).toBe(true);
});

test('호칭이 없는 구성원은 이름을 한 번만 표시한다', () => {
  const renderer = renderScreen();

  // 이경호는 호칭이 없어 실명 라인이 중복되지 않는다.
  expect(countText(renderer, '이경호')).toBe(1);
  // 손수호는 호칭(아빠)이 있어 호칭과 실명이 각각 한 번씩 나온다.
  expect(countText(renderer, '아빠')).toBe(1);
  expect(countText(renderer, '손수호')).toBe(1);
});

test('빈 호칭은 저장 버튼이 비활성이라 저장되지 않는다', () => {
  const renderer = renderScreen();

  press(renderer, '손수호 호칭 수정');
  const input = renderer.root.findByProps({accessibilityLabel: '손수호 호칭 입력'});
  TestRenderer.act(() => {
    input.props.onChangeText('   ');
  });

  const saveButton = renderer.root.findByProps({
    accessibilityLabel: '손수호 호칭 저장',
  });
  expect(saveButton.props.accessibilityState).toEqual({disabled: true});

  press(renderer, '손수호 호칭 저장');

  // 저장되지 않아 기존 호칭(아빠)이 유지되고 편집 모드도 닫히지 않는다.
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);
});

test('연필을 누르면 호칭을 인라인으로 편집하고 저장한다', () => {
  const renderer = renderScreen();

  press(renderer, '손수호 호칭 수정');

  const input = renderer.root.findByProps({accessibilityLabel: '손수호 호칭 입력'});
  expect(input.props.value).toBe('아빠');
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);

  TestRenderer.act(() => {
    input.props.onChangeText('아버지');
  });
  press(renderer, '손수호 호칭 저장');

  expect(hasText(renderer, '아버지')).toBe(true);
  // 저장 후 편집 모드가 닫힌다.
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
});

test('방장은 역할 토글로 구성원 역할을 바꿀 수 있다', () => {
  const renderer = renderScreen('m-manager');

  // 손수호를 피보호자로 바꾸면 인원 수 문구가 갱신된다.
  press(renderer, '손수호 피보호자');

  expect(hasText(renderer, '피보호자 2명, 보호자 1명')).toBe(true);
});

test('방장이 아니면 역할 토글 시 안내 팝업을 띄우고 역할을 바꾸지 않는다', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = renderScreen('m-dad');

  press(renderer, '손수호 피보호자');

  expect(alertSpy).toHaveBeenCalledWith(
    '역할 변경 권한이 없어요',
    '역할은 그룹 관리자(방장)만 변경할 수 있어요.',
  );
  // 역할은 그대로다.
  expect(hasText(renderer, '피보호자 1명, 보호자 2명')).toBe(true);
});

test('방장이 아니어도 이미 선택된 역할을 누르면 안내 없이 무시한다', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = renderScreen('m-dad');

  // 손수호는 이미 보호자다. 같은 역할을 눌러도 변화가 없어 안내하지 않는다.
  press(renderer, '손수호 보호자');

  expect(alertSpy).not.toHaveBeenCalled();
});

test('보호자 프로필 팝업은 정보와 함께 도장·순위·왕관을 보여준다', () => {
  const renderer = renderScreen();

  // 이경호는 보호자 1위(방장)다.
  press(renderer, '이경호 프로필 보기');

  expect(hasText(renderer, '이경호 님')).toBe(true);
  expect(hasText(renderer, '만 30세')).toBe(true);
  expect(hasText(renderer, '남자')).toBe(true);
  // 일주일 도장 현황이 적립 일수 요약과 함께 노출된다(이경호는 5/7일).
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '일주일 도장 현황, 이번 주 5/7일 적립',
    }),
  ).toBeTruthy();
  // 순위 배지와 1위 왕관이 표시된다.
  expect(countDesc(renderer, '순위 1위')).toBeGreaterThan(0);
  expect(
    renderer.root.findByProps({accessibilityLabel: '이번 주 1위'}),
  ).toBeTruthy();

  // 배경을 누르면 닫힌다.
  press(renderer, '프로필 닫기');
  expect(hasText(renderer, '이경호 님')).toBe(false);
});

test('1위가 아닌 보호자 프로필에는 도장은 있지만 왕관은 없다', () => {
  const renderer = renderScreen();

  // 손수호는 보호자 4위라 도장은 보이고 왕관은 없다.
  press(renderer, '손수호 프로필 보기');

  expect(hasText(renderer, '손수호 님')).toBe(true);
  expect(countDesc(renderer, '일주일 도장 현황')).toBeGreaterThan(0);
  expect(countDesc(renderer, '이번 주 1위')).toBe(0);
});

test('피보호자 프로필 팝업은 도장·순위·왕관을 모두 숨긴다', () => {
  const renderer = renderScreen();

  // 홍유라는 피보호자라 효자 랭킹 요소를 표시하지 않는다.
  press(renderer, '홍유라 프로필 보기');

  // 기본 정보는 보인다.
  expect(hasText(renderer, '홍유라 님')).toBe(true);
  expect(hasText(renderer, '만 24세')).toBe(true);
  expect(hasText(renderer, '여자')).toBe(true);
  // 도장·순위 배지·왕관은 모두 없다.
  expect(countDesc(renderer, '일주일 도장 현황')).toBe(0);
  expect(countDesc(renderer, '순위')).toBe(0);
  expect(countDesc(renderer, '이번 주 1위')).toBe(0);
});

const GROUP_A = {id: 'g-a', name: 'A 그룹', role: 'guardian'} as const;
const GROUP_B = {id: 'g-b', name: 'B 그룹', role: 'guardian'} as const;
const MEMBERS_B: readonly GroupMember[] = [
  {
    memberId: 'b-lead',
    name: '박보검',
    alias: null,
    role: 'guardian',
    isManager: true,
    avatarText: '박',
    age: 40,
    gender: 'male',
    weeklyRank: 1,
    weeklyStamps: [false, false, false, false, false, false, false],
  },
];

test('그룹을 바꾸면 그 그룹의 구성원으로 갈아끼운다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        currentGroup={GROUP_A}
        currentMemberId="m-manager"
        initialMembers={MEMBERS}
        pendingJoinCount={2}
        role="guardian"
      />,
    );
  });
  mountedRenderers.push(renderer!);
  expect(hasText(renderer!, '손수호')).toBe(true);

  TestRenderer.act(() => {
    renderer!.update(
      <GroupInfoScreen
        currentGroup={GROUP_B}
        currentMemberId="b-lead"
        initialMembers={MEMBERS_B}
        pendingJoinCount={0}
        role="guardian"
      />,
    );
  });

  expect(hasText(renderer!, '박보검')).toBe(true);
  expect(hasText(renderer!, '손수호')).toBe(false);
});

test('그룹을 바꾸면 편집 중이던 상태가 초기화된다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        currentGroup={GROUP_A}
        currentMemberId="m-manager"
        initialMembers={MEMBERS}
        pendingJoinCount={2}
        role="guardian"
      />,
    );
  });
  mountedRenderers.push(renderer!);

  // A 그룹에서 호칭 편집을 시작한다.
  press(renderer!, '손수호 호칭 수정');
  expect(renderer!.root.findAllByType(TextInput)).toHaveLength(1);

  // B 그룹으로 전환하면 편집 상태가 사라진다.
  TestRenderer.act(() => {
    renderer!.update(
      <GroupInfoScreen
        currentGroup={GROUP_B}
        currentMemberId="b-lead"
        initialMembers={MEMBERS_B}
        pendingJoinCount={0}
        role="guardian"
      />,
    );
  });
  expect(renderer!.root.findAllByType(TextInput)).toHaveLength(0);
});

test('초대·관리 메뉴 행은 후속 작업 안내 팝업을 띄운다', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = renderScreen();

  press(renderer, '그룹 코드');

  expect(alertSpy).toHaveBeenCalledWith(
    '그룹 코드',
    '후속 작업에서 연결될 화면입니다.',
  );
});
