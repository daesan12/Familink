import {
  addComment,
  changeReaction,
  createPostInteractionsState,
  deleteComment,
  REACTION_OPTIONS,
  updateComment,
} from './postInteractions';
import type {FeedPost} from '../types';

const post: FeedPost = {
  author: {avatarText: '유', id: 'member-yura', name: '유라'},
  body: '게시글',
  commentCount: 0,
  createdAt: '2026-07-30T12:00:00Z',
  groupId: 'group-1',
  id: 'post-1',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [
    {count: 2, emoji: '❤️', id: 'HEART', label: '사랑해요'},
    {count: 0, emoji: '👏', id: 'SUPPORT', label: '응원해요'},
  ],
};

test('반응 종류는 백엔드 REACTION_TYPE 5종과 정확히 일치한다', () => {
  expect(REACTION_OPTIONS.map(reaction => reaction.id)).toEqual([
    'HEART',
    'LAUGH',
    'SURPRISE',
    'SAD',
    'SUPPORT',
  ]);
});

test('반응을 등록하고 다른 반응으로 변경한 뒤 같은 반응을 눌러 취소한다', () => {
  const initial = createPostInteractionsState([post], {});
  const registered = changeReaction(initial, post.id, 'HEART');
  const changed = changeReaction(registered, post.id, 'SUPPORT');
  const cancelled = changeReaction(changed, post.id, 'SUPPORT');

  expect(registered.selectedReactionByPostId[post.id]).toBe('HEART');
  expect(
    registered.reactionsByPostId[post.id]?.find(
      reaction => reaction.id === 'HEART',
    )?.count,
  ).toBe(3);
  expect(
    changed.reactionsByPostId[post.id]?.find(
      reaction => reaction.id === 'HEART',
    )?.count,
  ).toBe(2);
  expect(
    changed.reactionsByPostId[post.id]?.find(
      reaction => reaction.id === 'SUPPORT',
    )?.count,
  ).toBe(1);
  expect(cancelled.selectedReactionByPostId[post.id]).toBeNull();
  expect(
    cancelled.reactionsByPostId[post.id]?.find(
      reaction => reaction.id === 'SUPPORT',
    )?.count,
  ).toBe(0);
});

test('반응 집계는 0보다 작아지지 않는다', () => {
  const selected = createPostInteractionsState(
    [{...post, currentUserReactionId: 'SUPPORT'}],
    {},
  );
  const cancelled = changeReaction(selected, post.id, 'SUPPORT');

  expect(
    cancelled.reactionsByPostId[post.id]?.find(
      reaction => reaction.id === 'SUPPORT',
    )?.count,
  ).toBe(0);
});

test('postId별 댓글을 작성·수정·삭제하며 다른 게시글 상태를 보존한다', () => {
  const author = {avatarText: '다', id: 'current-user', name: '다영'};
  const initial = createPostInteractionsState([post], {'post-2': []});
  const created = addComment(initial, {
    author,
    body: ' 새 댓글 ',
    commentId: 'comment-1',
    createdAt: '2026-07-30T12:00:00Z',
    postId: post.id,
  });
  const updated = updateComment(created, {
    body: '수정 댓글',
    commentId: 'comment-1',
    postId: post.id,
  });
  const deleted = deleteComment(updated, {
    commentId: 'comment-1',
    postId: post.id,
  });

  expect(created.commentsByPostId[post.id]?.[0]?.body).toBe('새 댓글');
  expect(created.commentCountByPostId[post.id]).toBe(1);
  expect(updated.commentsByPostId[post.id]?.[0]?.body).toBe('수정 댓글');
  expect(deleted.commentsByPostId[post.id]).toEqual([]);
  expect(deleted.commentCountByPostId[post.id]).toBe(0);
  expect(deleted.commentsByPostId['post-2']).toEqual([]);
});
