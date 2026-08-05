import {StyleSheet, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {ALIAS_MAX_LENGTH} from '../groupInfoModel';
import type {GroupMember} from '../types';
import {GroupMemberRow} from './GroupMemberRow';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

// 이름과 호칭은 모두 최대 10자다. 최대 길이에서 레이아웃이 유지되는지가 이 테스트의 관심사다.
const MAX_LENGTH_NAME = '가나다라마바사아자차';

function member(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    age: null,
    alias: null,
    avatarText: '가',
    gender: null,
    isManager: false,
    memberId: 'm-1',
    name: MAX_LENGTH_NAME,
    role: 'guardian',
    ...overrides,
  };
}

function render(target: GroupMember, isEditing = false) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupMemberRow
        aliasDraft={isEditing ? target.alias ?? '' : ''}
        canEditAlias
        isEditing={isEditing}
        member={target}
        onCancelEditAlias={jest.fn()}
        onChangeAliasDraft={jest.fn()}
        onOpenProfile={jest.fn()}
        onSaveAlias={jest.fn()}
        onSelectRole={jest.fn()}
        onStartEditAlias={jest.fn()}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function findText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root
    .findAllByType(Text)
    .find(node => node.props.children === value);
}

test('이름이 최대 길이여도 호칭 수정 버튼은 남아 있다', () => {
  const target = member();
  const renderer = render(target);

  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: `${target.name} 호칭 수정`,
    }).length,
  ).toBeGreaterThan(0);
});

test('표시 이름은 남은 폭 안에서 줄어들고 두 줄까지 감싼다', () => {
  // 최대 길이 이름을 잘라 보여주기보다 두 줄로 다 보여주는 편이 낫다는 판단이다.
  const renderer = render(member());

  const displayName = findText(renderer, MAX_LENGTH_NAME);
  expect(displayName).toBeDefined();
  expect(displayName?.props.numberOfLines).toBe(2);
  expect(StyleSheet.flatten(displayName?.props.style).flexShrink).toBe(1);
});

test('호칭이 있으면 호칭은 두 줄까지, 실제 이름은 한 줄로 보여준다', () => {
  // 실제 이름은 호칭 아래 보조 정보라 행이 과하게 길어지지 않도록 한 줄로 둔다.
  const alias = '가나다라마바사아자차';
  const renderer = render(member({alias, name: '홍길동'}));

  const aliasText = findText(renderer, alias);
  const realName = findText(renderer, '홍길동');
  expect(aliasText?.props.numberOfLines).toBe(2);
  expect(realName?.props.numberOfLines).toBe(1);
  expect(StyleSheet.flatten(realName?.props.style).flexShrink).toBe(1);
});

test('편집 모드에서는 입력·저장·취소가 그대로 동작한다', () => {
  const target = member({alias: MAX_LENGTH_NAME});
  const renderer = render(target, true);

  const input = renderer.root.findByProps({
    accessibilityLabel: `${target.name} 호칭 입력`,
  });
  expect(input.props.maxLength).toBe(ALIAS_MAX_LENGTH);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: `${target.name} 호칭 저장`,
    }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: `${target.name} 호칭 편집 취소`,
    }).length,
  ).toBeGreaterThan(0);
});
