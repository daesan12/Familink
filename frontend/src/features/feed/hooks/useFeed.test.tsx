import React, {useEffect, useState} from 'react';
import TestRenderer from 'react-test-renderer';

import type {FeedPageLoader} from '../api/feedApi';
import type {FeedPost} from '../types';
import {useFeed} from './useFeed';

const firstPost: FeedPost = {
  author: {avatarText: '홍', id: 'member-1', name: '홍유라'},
  body: '첫 번째 글',
  commentCount: 0,
  createdAt: '2026-07-31T01:02:03Z',
  groupId: 'group-1',
  id: 'post-1',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [],
};

const secondPost: FeedPost = {
  ...firstPost,
  body: '두 번째 글',
  id: 'post-2',
};

function Harness({loader}: {loader: FeedPageLoader}) {
  const feed = useFeed('group-1', undefined, loader);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (feed.status === 'success' && !requested) {
      setRequested(true);
      feed.loadMore();
    }
  }, [feed, requested]);

  return React.createElement(State, {
    ids: feed.status === 'success' ? feed.posts.map(post => post.id) : [],
    status: feed.status,
  });
}

function State({ids, status}: {ids: string[]; status: string}) {
  return React.createElement('state', {ids, status});
}

test('페이지 추가 로딩은 다음 페이지를 한 번만 붙이고 중복 게시글을 제거한다', async () => {
  const loader = jest
    .fn<ReturnType<FeedPageLoader>, Parameters<FeedPageLoader>>()
    .mockResolvedValueOnce({hasNext: true, posts: [firstPost]})
    .mockResolvedValueOnce({
      hasNext: false,
      posts: [firstPost, secondPost, secondPost],
    });

  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<Harness loader={loader} />);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(loader).toHaveBeenNthCalledWith(1, 'group-1', 0, 20, undefined);
  expect(loader).toHaveBeenNthCalledWith(2, 'group-1', 1, 20, undefined);
  expect(renderer!.root.findByType(State).props.ids).toEqual([
    'post-1',
    'post-2',
  ]);

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});
