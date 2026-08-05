import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import TestRenderer from 'react-test-renderer';

import type {FeedPost, ReactionId} from '../types';
import {FeedScreen} from './FeedScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => {
  const mockReact = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const insets = {bottom: 0, left: 0, right: 0, top: 0};

  return {
    // FeedStack(native-stack)의 SafeAreaProviderCompat이 이 컨텍스트를 구독한다.
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    initialWindowMetrics: null,
    useSafeAreaInsets: () => insets,
  };
});

// FeedScreen이 내부에 FeedStack 내비게이터를 렌더하므로 컨테이너가 필요하다.
function withNav(element: React.ReactElement) {
  return <NavigationContainer>{element}</NavigationContainer>;
}

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../components/ReactionBar', () => {
  const ReactRuntime = require('react');
  const {Pressable, View} = require('react-native');

  return {
    ReactionBar: ({
      onSelectReaction,
      onTogglePicker,
      reactions,
      selectedReactionId,
    }: {
      onSelectReaction: (reactionId: ReactionId) => void;
      onTogglePicker: (anchor: {
        height: number;
        width: number;
        x: number;
        y: number;
      }) => void;
      reactions: FeedPost['reactions'];
      selectedReactionId: FeedPost['currentUserReactionId'];
    }) =>
      ReactRuntime.createElement(
        View,
        null,
        ReactRuntime.createElement(Pressable, {
          accessibilityLabel: '게시글 반응 추가',
          onPress: () =>
            onTogglePicker({height: 44, width: 44, x: 100, y: 200}),
        }),
        selectedReactionId
          ? ReactRuntime.createElement(Pressable, {
              accessibilityLabel: `${
                reactions.find(
                  reaction => reaction.id === selectedReactionId,
                )?.label
              } 반응 ${
                reactions.find(
                  reaction => reaction.id === selectedReactionId,
                )?.count
              }개, 내가 선택함`,
              onPress: () => onSelectReaction(selectedReactionId),
            })
          : null,
      ),
  };
});
jest.mock('../components/ReactionPopover', () => {
  const ReactRuntime = require('react');
  const {Pressable} = require('react-native');

  return {
    ReactionPopover: ({
      onSelect,
      visible,
    }: {
      onSelect: (reactionId: 'HEART') => void;
      visible: boolean;
    }) =>
      visible
        ? ReactRuntime.createElement(Pressable, {
            accessibilityLabel: '사랑해요',
            onPress: () => onSelect('HEART'),
          })
        : null,
  };
});

const post: FeedPost = {
  author: {avatarText: '유', id: 'member-yura', name: '유라'},
  body: '가족 여행 기록',
  commentCount: 0,
  createdAt: '2026-07-30T12:00:00Z',
  groupId: 'group-1',
  id: 'post-1',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [],
};

test('D-2와 D-3가 같은 postId의 반응 상태를 공유한다', async () => {
  const onChangeReaction = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
          initialCommentsByPostId={{'post-1': []}}
          loader={jest.fn().mockResolvedValue([post])}
          onChangeReaction={onChangeReaction}
          role="guardian"
        />,
      ),
      {
        createNodeMock: () => ({
          measureInWindow: (
            callback: (
              x: number,
              y: number,
              width: number,
              height: number,
            ) => void,
          ) => callback(100, 200, 44, 44),
        }),
      },
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const addReactionButton = renderer!.root
    .findAllByProps({accessibilityLabel: '게시글 반응 추가'})
    .find(node => typeof node.props.onPress === 'function');
  expect(addReactionButton).toBeTruthy();

  await TestRenderer.act(() => {
    addReactionButton!.props.onPress();
  });

  const loveReactionButton = renderer!.root
    .findAllByProps({accessibilityLabel: '사랑해요'})
    .find(node => typeof node.props.onPress === 'function');
  expect(loveReactionButton).toBeTruthy();

  await TestRenderer.act(() => {
    loveReactionButton!.props.onPress();
  });

  expect(onChangeReaction).toHaveBeenCalledWith({
    nextReactionId: 'HEART',
    postId: post.id,
    previousReactionId: null,
  });

  const commentButton = renderer!.root
    .findAllByProps({accessibilityLabel: '댓글 0개 보기'})
    .find(node => typeof node.props.onPress === 'function');
  expect(commentButton).toBeTruthy();

  await TestRenderer.act(() => {
    commentButton!.props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '사랑해요 반응 1개, 내가 선택함',
    }),
  ).not.toHaveLength(0);

  const selectedReactionButton = renderer!.root
    .findAllByProps({
      accessibilityLabel: '사랑해요 반응 1개, 내가 선택함',
    })
    .find(node => typeof node.props.onPress === 'function');
  expect(selectedReactionButton).toBeTruthy();

  await TestRenderer.act(async () => {
    selectedReactionButton!.props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(onChangeReaction).toHaveBeenLastCalledWith({
    nextReactionId: null,
    postId: post.id,
    previousReactionId: 'HEART',
  });

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});

test('알림에서 전달된 postId의 게시글 상세를 바로 연다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
          initialCommentsByPostId={{'post-1': []}}
          loader={jest.fn().mockResolvedValue([post])}
          openPostId="post-1"
          openPostRequestId={1}
          role="guardian"
        />,
      ),
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '피드로 돌아가기',
    }),
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});

test('작성자 아바타를 누르면 그룹정보와 동일한 프로필 팝업을 연다', async () => {
  const membersLoader = jest.fn().mockResolvedValue([
    {
      age: null,
      alias: null,
      avatarText: '유',
      gender: null,
      isManager: false,
      memberId: 'member-yura',
      name: '유라',
      role: 'careReceiver',
    },
  ]);
  const memberProfileLoader = jest.fn().mockResolvedValue({
    age: 70,
    displayName: '유라',
    gender: 'female',
    memberId: 'member-yura',
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
          initialCommentsByPostId={{'post-1': []}}
          loader={jest.fn().mockResolvedValue([post])}
          memberProfileLoader={memberProfileLoader}
          membersLoader={membersLoader}
          role="guardian"
        />,
      ),
    );
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({accessibilityLabel: '유라님의 프로필 보기'})
      .props.onPress();
  });

  expect(membersLoader).toHaveBeenCalledWith('group-1');
  expect(memberProfileLoader).toHaveBeenCalledWith('group-1', 'member-yura');
  const {Text} = require('react-native');
  const shown = renderer!.root.findAllByType(Text).some(node => {
    const children = node.props.children;
    return (Array.isArray(children) ? children.join('') : children) === '만 70세';
  });
  expect(shown).toBe(true);

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});
