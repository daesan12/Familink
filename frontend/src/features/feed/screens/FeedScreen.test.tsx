import React from 'react';
import TestRenderer from 'react-test-renderer';

import type {FeedPost} from '../types';
import {FeedScreen} from './FeedScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../components/ReactionBar', () => {
  const ReactRuntime = require('react');
  const {Pressable, View} = require('react-native');

  return {
    ReactionBar: ({
      onTogglePicker,
      reactions,
      selectedReactionId,
    }: {
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
          ? ReactRuntime.createElement(View, {
              accessibilityLabel: `${
                reactions.find(
                  reaction => reaction.id === selectedReactionId,
                )?.label
              } 반응 ${
                reactions.find(
                  reaction => reaction.id === selectedReactionId,
                )?.count
              }개, 내가 선택함`,
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
      onSelect: (reactionId: 'love') => void;
      visible: boolean;
    }) =>
      visible
        ? ReactRuntime.createElement(Pressable, {
            accessibilityLabel: '사랑해요',
            onPress: () => onSelect('love'),
          })
        : null,
  };
});

const post: FeedPost = {
  author: {avatarText: '유', id: 'member-yura', name: '유라'},
  body: '가족 여행 기록',
  commentCount: 0,
  createdAtLabel: '방금 전',
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
      <FeedScreen
        currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
        currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
        initialCommentsByPostId={{'post-1': []}}
        loader={jest.fn().mockResolvedValue([post])}
        onChangeReaction={onChangeReaction}
        role="guardian"
      />,
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
    nextReactionId: 'love',
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

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});
