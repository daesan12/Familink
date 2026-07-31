import React from 'react';
import TestRenderer from 'react-test-renderer';

import type {FeedPost} from '../types';
import {FeedScreen} from './FeedScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

const detailPost: FeedPost = {
  author: {avatarText: '홍', id: 'member-1', name: '홍유라'},
  body: '상세 API 내용',
  commentCount: 0,
  createdAt: '2026-07-31T01:02:03Z',
  groupId: 'group-1',
  id: 'post-detail',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [],
};

test('상세 API는 목록에 없는 postId도 조회한다', async () => {
  const detailLoader = jest.fn().mockResolvedValue(detailPost);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <FeedScreen
        currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
        detailLoader={detailLoader}
        loader={jest.fn().mockResolvedValue([])}
        openPostId="post-detail"
        openPostRequestId={1}
        role="guardian"
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(detailLoader).toHaveBeenCalledWith('post-detail', undefined, 'group-1');

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});
