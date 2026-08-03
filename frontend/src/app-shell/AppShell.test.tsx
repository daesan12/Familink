import React from 'react';
import {Pressable, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {AppShell} from './AppShell';
import type {AppScreenProps, FamilyGroup} from './types';

function MockCurrentGroupSwitcher({
  groups,
  onSelect,
}: {
  groups: readonly FamilyGroup[];
  onSelect: (groupId: string) => void;
}) {
  return (
    <>
      {groups.map(group => (
        <Pressable key={group.id} onPress={() => onSelect(group.id)}>
          <Text>{group.name}</Text>
        </Pressable>
      ))}
    </>
  );
}

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('./BottomTabBar', () => ({BottomTabBar: () => null}));
jest.mock('./CurrentGroupSwitcher', () => ({
  CurrentGroupSwitcher: MockCurrentGroupSwitcher,
}));

const GROUP_A: FamilyGroup = {
  id: 'group-a',
  name: '삭제할 그룹',
  role: 'guardian',
};
const GROUP_B: FamilyGroup = {
  id: 'group-b',
  name: '남은 그룹',
  role: 'guardian',
};

function FeedScreen({currentGroup}: AppScreenProps) {
  return <Text>{`피드:${currentGroup.name}`}</Text>;
}

function GroupInfoScreen({currentGroup}: AppScreenProps) {
  return <Text>{`그룹정보:${currentGroup.name}`}</Text>;
}

function CalendarScreen({currentGroup}: AppScreenProps) {
  return <Text>{`캘린더:${currentGroup.name}`}</Text>;
}

const screens = {
  calendar: CalendarScreen,
  feed: FeedScreen,
  groupInfo: GroupInfoScreen,
};

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some(node => {
    const children = node.props.children;
    return Array.isArray(children)
      ? children.join('') === value
      : children === value;
  });
}

function pressText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  const target = renderer.root.findAll(node => {
    if (typeof node.props.onPress !== 'function') {
      return false;
    }
    return node.findAllByType(Text).some(text => {
      const children = text.props.children;
      return Array.isArray(children)
        ? children.join('') === value
        : children === value;
    });
  })[0];
  if (target === undefined) {
    throw new Error(`누를 수 있는 "${value}" 텍스트가 없습니다.`);
  }
  TestRenderer.act(() => {
    target.props.onPress();
  });
}

test('현재 그룹이 삭제되고 대체 그룹이 지정되면 대체 그룹의 피드로 이동한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <AppShell
        groups={[GROUP_A, GROUP_B]}
        initialGroupId={GROUP_A.id}
        initialRoute="groupInfo"
        screens={screens}
      />,
    );
  });

  expect(hasText(renderer!, '그룹정보:삭제할 그룹')).toBe(true);

  await TestRenderer.act(async () => {
    renderer!.update(
      <AppShell
        groups={[GROUP_B]}
        initialGroupId={GROUP_B.id}
        initialRoute="groupInfo"
        screens={screens}
      />,
    );
  });

  expect(hasText(renderer!, '피드:남은 그룹')).toBe(true);
  expect(hasText(renderer!, '그룹정보:남은 그룹')).toBe(false);
  TestRenderer.act(() => renderer!.unmount());
});

test('삭제가 아닌 일반 그룹 전환은 현재 화면을 유지한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <AppShell
        groups={[GROUP_A, GROUP_B]}
        initialGroupId={GROUP_A.id}
        initialRoute="calendar"
        screens={screens}
      />,
    );
  });

  pressText(renderer!, '남은 그룹');

  expect(hasText(renderer!, '캘린더:남은 그룹')).toBe(true);
  expect(hasText(renderer!, '피드:남은 그룹')).toBe(false);
  TestRenderer.act(() => renderer!.unmount());
});
