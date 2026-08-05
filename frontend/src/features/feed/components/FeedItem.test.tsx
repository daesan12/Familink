import React from 'react';
import TestRenderer from 'react-test-renderer';

import {FeedItem} from './FeedItem';
import type {FeedPost} from '../types';

jest.mock('./PostImageCarousel', () => ({
  PostImageCarousel: () => null,
}));
jest.mock('./ReactionBar', () => ({
  ReactionBar: () => null,
}));

const post: FeedPost = {
  author: {
    avatarText: '민',
    id: 'member-1',
    name: '민준',
    profileImageUrl: null,
  },
  body: '오늘의 게시글',
  commentCount: 2,
  createdAt: '2026-08-05T00:00:00Z',
  groupId: 'group-1',
  id: 'post-1',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [],
};

test('작성자 이름과 시간 영역을 누르면 게시글 상세로 이동한다', () => {
  const onPress = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <FeedItem
        canInteract
        commentCount={post.commentCount}
        isVisible
        isReactionPickerOpen={false}
        onPress={onPress}
        onSelectReaction={jest.fn()}
        onToggleReactionPicker={jest.fn()}
        post={post}
        selectedReactionId={null}
      />,
    );
  });

  const authorDetailButton = renderer!.root.findByProps({
    accessibilityLabel: '민준의 게시글 상세 보기',
  });

  expect(authorDetailButton).toBeDefined();
  expect(authorDetailButton.props.hitSlop).toEqual({
    bottom: 8,
    left: 0,
    right: 8,
    top: 8,
  });
  TestRenderer.act(() => {
    authorDetailButton?.props.onPress();
  });
  expect(onPress).toHaveBeenCalledWith('post-1');

  const postCard = renderer!.root.findByProps({
    testID: 'feed-post-card-post-1',
  });
  expect(postCard.props.accessible).toBe(false);
  TestRenderer.act(() => {
    postCard.props.onPress();
  });
  expect(onPress).toHaveBeenCalledTimes(2);
});
