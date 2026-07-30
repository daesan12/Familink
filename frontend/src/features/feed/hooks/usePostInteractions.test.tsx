import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {FeedPost, PostComment} from '../types';
import {usePostInteractions} from './usePostInteractions';

const post: FeedPost = {
  author: {avatarText: '유', id: 'member-yura', name: '유라'},
  body: '게시글',
  commentCount: 0,
  createdAtLabel: '방금 전',
  groupId: 'group-1',
  id: 'post-1',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [],
};
const posts = [post] as const;

function InteractionCount({
  comments,
}: {
  comments: Readonly<Record<string, readonly PostComment[]>>;
}) {
  const interactions = usePostInteractions(posts, comments);

  return (
    <Text
      accessibilityLabel={`댓글 수 ${
        interactions.commentCountByPostId[post.id] ?? 0
      }`}
    />
  );
}

test('같은 postId의 초기 댓글 fixture가 바뀌면 Preview 상태를 재동기화한다', async () => {
  const firstComment: PostComment = {
    author: {avatarText: '다', id: 'member-dayoung', name: '다영'},
    body: '첫 댓글',
    createdAtLabel: '방금 전',
    id: 'comment-1',
    postId: post.id,
  };
  const secondComment: PostComment = {
    ...firstComment,
    body: '둘째 댓글',
    id: 'comment-2',
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <InteractionCount comments={{[post.id]: [firstComment]}} />,
    );
  });
  expect(
    renderer!.root.findByProps({accessibilityLabel: '댓글 수 1'}),
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.update(
      <InteractionCount
        comments={{[post.id]: [firstComment, secondComment]}}
      />,
    );
  });
  expect(
    renderer!.root.findByProps({accessibilityLabel: '댓글 수 2'}),
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});
