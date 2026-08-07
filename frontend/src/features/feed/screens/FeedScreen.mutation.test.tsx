import React from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import TestRenderer from 'react-test-renderer';

import type {
  PostComposerInitialValue,
  PostSubmitPayload,
  UploadState,
} from '../composer/postComposerModel';
import type {FeedStackParamList} from '../navigationTypes';
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
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <FeedScreen
          currentGroup={{id: '11', name: '우리 가족', role: 'guardian'}}
          loader={loader}
          onSubmitPost={onSubmitPost}
          role="guardian"
        />
      </NavigationContainer>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  await TestRenderer.act(async () => {
    navRef.navigate('PostComposer', {mode: 'create'});
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

test('알림이 스택에 깔려 있어도 저장 성공은 피드 목록으로 착지한다', async () => {
  // popToTop은 index 0으로 되감으므로 알림이 밑에 있어도 FeedHome이다.
  // 이 계약이 깨지면 작성 완료 후 알림 화면이 튀어나온다(S15P11B104-368).
  const loader = jest.fn().mockResolvedValue([post]);
  const onSubmitPost = jest.fn().mockResolvedValue(undefined);
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <FeedScreen
          currentGroup={{id: '11', name: '우리 가족', role: 'guardian'}}
          loader={loader}
          onSubmitPost={onSubmitPost}
          role="guardian"
        />
      </NavigationContainer>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  // 셸이 주입하지 않아도 라우트는 등록돼 있으므로 스택 위상은 재현된다.
  await TestRenderer.act(async () => {
    navRef.navigate('notifications');
    await Promise.resolve();
  });
  await TestRenderer.act(async () => {
    navRef.navigate('PostComposer', {mode: 'create'});
    await Promise.resolve();
  });
  expect(navRef.getCurrentRoute()?.name).toBe('PostComposer');

  const composer = renderer!.root.findByProps({
    accessibilityLabel: 'composer',
  });
  await TestRenderer.act(async () => {
    composer.props.onSubmit(submitPayload);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(navRef.getCurrentRoute()?.name).toBe('FeedHome');

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});
