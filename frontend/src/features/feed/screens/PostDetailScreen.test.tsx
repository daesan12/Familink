import React from 'react';
import TestRenderer from 'react-test-renderer';

import type {
  FeedMember,
  FeedPost,
  PostComment,
} from '../types';
import {MAX_COMMENT_LENGTH} from '../types';
import {PostActionsSheet} from '../components/PostActionsSheet';
import {PostDetailScreen} from './PostDetailScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const currentUser: FeedMember = {
  avatarText: '다',
  id: 'current-user',
  name: '다영',
};
const post: FeedPost = {
  author: {avatarText: '대', id: 'post-author', name: '대산'},
  body: '할머니 사랑해요!',
  commentCount: 2,
  createdAt: '2026-07-30T12:40:00Z',
  groupId: 'group-1',
  id: 'post-1',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [],
};
const comments: readonly PostComment[] = [
  {
    author: currentUser,
    body: '내 댓글',
    createdAt: '2026-07-30T12:00:00Z',
    id: 'comment-mine',
    postId: post.id,
  },
  {
    author: {avatarText: '수', id: 'other-user', name: '수호'},
    body: '다른 사람 댓글',
    createdAt: '2026-07-30T05:40:00Z',
    id: 'comment-other',
    postId: post.id,
  },
];

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>(resolve => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

async function renderScreen(
  overrides: Partial<
    React.ComponentProps<typeof PostDetailScreen>
  > = {},
) {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <PostDetailScreen
        canInteract
        commentCount={comments.length}
        comments={comments}
        currentGroupName="우리 가족의 이야기"
        currentUser={currentUser}
        isReactionPickerOpen={false}
        onBack={jest.fn()}
        onCreateComment={jest.fn()}
        onDeleteComment={jest.fn()}
        onMenuPress={jest.fn()}
        onScrollBeginDrag={jest.fn()}
        onToggleReactionPicker={jest.fn()}
        onUpdateComment={jest.fn()}
        post={post}
        reactions={[]}
        selectedReactionId={null}
        {...overrides}
      />,
    );
  });

  return renderer!;
}

test('currentUserId와 authorId가 같은 댓글에만 액션 메뉴를 표시한다', async () => {
  const renderer = await renderScreen();

  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: '다영님의 댓글 수정 및 삭제 메뉴',
    }),
  ).not.toHaveLength(0);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: '수호님의 댓글 수정 및 삭제 메뉴',
    }),
  ).toHaveLength(0);

  await TestRenderer.act(() => {
    renderer.unmount();
  });
});

test('onOpenNotifications가 있으면 헤더 알림 벨로 알림 화면을 연다', async () => {
  const onOpenNotifications = jest.fn();
  const renderer = await renderScreen({onOpenNotifications});

  const bell = renderer.root.findByProps({accessibilityLabel: '알림'});

  TestRenderer.act(() => {
    bell.props.onPress();
  });

  expect(onOpenNotifications).toHaveBeenCalledTimes(1);

  await TestRenderer.act(() => {
    renderer.unmount();
  });
});

test('onOpenNotifications가 없으면 알림 벨을 표시하지 않는다', async () => {
  const renderer = await renderScreen();

  expect(
    renderer.root.findAllByProps({accessibilityLabel: '알림'}),
  ).toHaveLength(0);

  await TestRenderer.act(() => {
    renderer.unmount();
  });
});

test('댓글 입력을 50자로 제한하고 유효한 입력을 등록한 뒤 비운다', async () => {
  const onCreateComment = jest.fn();
  const renderer = await renderScreen({onCreateComment});
  const input = renderer.root.findByProps({
    accessibilityLabel: '댓글 입력',
  });

  expect(input.props.maxLength).toBe(MAX_COMMENT_LENGTH);
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 등록'}).props
      .accessibilityState.disabled,
  ).toBe(true);

  TestRenderer.act(() => {
    input.props.onChangeText('   ');
  });
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 등록'}).props
      .accessibilityState.disabled,
  ).toBe(true);

  TestRenderer.act(() => {
    input.props.onChangeText('가');
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 등록'}).props
      .accessibilityState.disabled,
  ).toBe(false);

  const maxLengthComment = '가'.repeat(MAX_COMMENT_LENGTH);
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '댓글 입력'})
      .props.onChangeText(maxLengthComment);
  });
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 글자 수 50/50'}),
  ).toBeTruthy();

  const enabledButton = renderer.root.findByProps({
    accessibilityLabel: '댓글 등록',
  });
  expect(enabledButton.props.accessibilityState.disabled).toBe(false);

  await TestRenderer.act(async () => {
    enabledButton.props.onPress();
    await Promise.resolve();
  });

  expect(onCreateComment).toHaveBeenCalledWith({
    body: maxLengthComment,
    postId: post.id,
  });
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 입력'}).props
      .value,
  ).toBe('');
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 등록'}).props
      .accessibilityState.disabled,
  ).toBe(true);

  await TestRenderer.act(() => {
    renderer.unmount();
  });
});

test('댓글 저장이 끝날 때까지 입력과 버튼을 잠가 연속 탭을 한 번만 처리한다', async () => {
  const submission = deferred();
  const onCreateComment = jest.fn(() => submission.promise);
  const renderer = await renderScreen({onCreateComment});

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '댓글 입력'})
      .props.onChangeText('한 번만 보내기');
  });
  const button = renderer.root.findByProps({accessibilityLabel: '댓글 등록'});

  TestRenderer.act(() => {
    button.props.onPress();
    button.props.onPress();
  });

  expect(onCreateComment).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 입력'}).props.editable,
  ).toBe(false);
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 등록'}).props
      .accessibilityState.disabled,
  ).toBe(true);

  await TestRenderer.act(async () => {
    submission.resolve();
    await submission.promise;
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 입력'}).props.value,
  ).toBe('');

  await TestRenderer.act(() => {
    renderer.unmount();
  });
});

test('댓글 수정 저장 중에도 입력과 버튼을 잠가 연속 탭을 한 번만 처리한다', async () => {
  const submission = deferred();
  const onUpdateComment = jest.fn(() => submission.promise);
  const renderer = await renderScreen({onUpdateComment});

  TestRenderer.act(() => {
    renderer.root
      .findByProps({
        accessibilityLabel: '다영님의 댓글 수정 및 삭제 메뉴',
      })
      .props.onPress();
  });
  TestRenderer.act(() => {
    renderer.root.findByType(PostActionsSheet).props.onEdit();
  });
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '댓글 수정 입력'}).props
      .onChangeText('수정한 댓글');
  });
  const button = renderer.root.findByProps({
    accessibilityLabel: '댓글 수정 완료',
  });

  TestRenderer.act(() => {
    button.props.onPress();
    button.props.onPress();
  });

  expect(onUpdateComment).toHaveBeenCalledTimes(1);
  expect(onUpdateComment).toHaveBeenCalledWith({
    body: '수정한 댓글',
    commentId: 'comment-mine',
    postId: post.id,
  });
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 수정 입력'}).props
      .editable,
  ).toBe(false);
  expect(
    renderer.root.findByProps({accessibilityLabel: '댓글 수정 완료'}).props
      .accessibilityState.disabled,
  ).toBe(true);

  await TestRenderer.act(async () => {
    submission.resolve();
    await submission.promise;
  });

  expect(
    renderer.root.findAllByProps({accessibilityLabel: '댓글 수정 입력'}),
  ).toHaveLength(0);

  await TestRenderer.act(() => {
    renderer.unmount();
  });
});

test('댓글을 불러오는 중이거나 오류일 때 빈 상태를 표시하지 않는다', async () => {
  const loadingRenderer = await renderScreen({
    commentCount: 0,
    comments: [],
    isCommentsLoading: true,
  });

  expect(
    loadingRenderer.root.findAllByProps({accessibilityLabel: '댓글 없음'}),
  ).toHaveLength(0);
  expect(
    loadingRenderer.root.findByProps({accessibilityLabel: '댓글을 불러오는 중'}),
  ).toBeTruthy();

  await TestRenderer.act(() => {
    loadingRenderer.unmount();
  });

  const errorRenderer = await renderScreen({
    commentCount: 0,
    comments: [],
    commentsError: '댓글을 불러오지 못했습니다.',
  });

  expect(
    errorRenderer.root.findAllByProps({accessibilityLabel: '댓글 없음'}),
  ).toHaveLength(0);
  expect(
    errorRenderer.root.findByProps({children: '댓글을 불러오지 못했습니다.'}),
  ).toBeTruthy();

  await TestRenderer.act(() => {
    errorRenderer.unmount();
  });
});
