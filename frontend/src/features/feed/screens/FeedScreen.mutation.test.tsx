import React from 'react';
import TestRenderer from 'react-test-renderer';

import type {
  PostComposerInitialValue,
  PostSubmitPayload,
  UploadState,
} from '../composer/postComposerModel';
import {FeedScreen} from './FeedScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../components/FeedItem', () => ({
  FeedItem: () => null,
}));
jest.mock('../components/PostActionsSheet', () => ({
  PostActionsSheet: () => null,
}));
jest.mock('./PostDetailScreen', () => ({
  PostDetailScreen: () => null,
}));
jest.mock('../components/ReactionBar', () => ({
  ReactionBar: () => null,
}));
jest.mock('../components/ReactionPopover', () => ({
  ReactionPopover: () => null,
}));
jest.mock('./PostComposerScreen', () => {
  const ReactRuntime = require('react');
  return {
    PostComposerScreen: (props: {
      initialValue?: PostComposerInitialValue;
      onCancel: () => void;
      onRetryUpload?: () => void;
      onSubmit: (payload: PostSubmitPayload) => void;
      uploadState: UploadState;
    }) =>
      ReactRuntime.createElement('Composer', {
        ...props,
        accessibilityLabel: 'composer',
      }),
  };
});

const post = {
  author: {avatarText: '현', id: 'member-1', name: '현우'},
  body: '기존 게시글',
  commentCount: 0,
  createdAt: '2026-07-31T00:00:00Z',
  groupId: '11',
  id: '91',
  images: [],
  isOwnedByCurrentUser: true,
  reactions: [],
};

const submitPayload: PostSubmitPayload = {
  body: '새 게시글',
  deletedMediaIds: [],
  newMedia: [],
  orderedMedia: [],
  retainedMedia: [],
  retainedMediaIds: [],
};

test('게시글 저장 성공 후 작성 화면을 닫고 피드를 다시 조회한다', async () => {
  const loader = jest.fn().mockResolvedValue([post]);
  const onSubmitPost = jest.fn().mockResolvedValue(undefined);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <FeedScreen
        createPostRequestId={0}
        currentGroup={{id: '11', name: '우리 가족', role: 'guardian'}}
        loader={loader}
        onSubmitPost={onSubmitPost}
        role="guardian"
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  await TestRenderer.act(async () => {
    renderer!.update(
      <FeedScreen
        createPostRequestId={1}
        currentGroup={{id: '11', name: '우리 가족', role: 'guardian'}}
        loader={loader}
        onSubmitPost={onSubmitPost}
        role="guardian"
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const composer = renderer!.root.findByProps({
    accessibilityLabel: 'composer',
  });
  await TestRenderer.act(async () => {
    composer.props.onSubmit(submitPayload);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(onSubmitPost).toHaveBeenCalledWith(
    submitPayload,
    expect.any(Function),
    expect.any(Object),
  );
  expect(
    renderer!.root.findAllByProps({accessibilityLabel: 'composer'}),
  ).toHaveLength(0);
  expect(loader).toHaveBeenCalledTimes(2);

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});
