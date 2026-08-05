import {useEffect, useRef, useState} from 'react';

import {
  addComment,
  appendComments,
  changeReaction,
  createPostInteractionsState,
  deleteComment,
  replaceComment,
  replaceComments,
  restoreComment,
  setCommentCount,
  setReaction,
  settleCommentCountDelta,
  updateComment,
} from '../interactions/postInteractions';
import type {
  FeedMember,
  FeedReaction,
  FeedPost,
  PostComment,
  ReactionId,
} from '../types';

export function usePostInteractions(
  posts: readonly FeedPost[],
  initialCommentsByPostId: Readonly<
    Record<string, readonly PostComment[]>
  >,
) {
  const [state, setState] = useState(() =>
    createPostInteractionsState(posts, initialCommentsByPostId),
  );
  const nextLocalCommentId = useRef(1);

  useEffect(() => {
    setState(
      createPostInteractionsState(posts, initialCommentsByPostId),
    );
  }, [initialCommentsByPostId, posts]);

  return {
    addComment: (
      postId: string,
      body: string,
      author: FeedMember,
      options?: {commentId?: string; createdAt?: string},
    ) => {
      setState(current =>
        addComment(current, {
          author,
          body,
          commentId:
            options?.commentId ?? `local-comment-${nextLocalCommentId.current++}`,
          createdAt: options?.createdAt ?? new Date().toISOString(),
          postId,
        }),
      );
    },
    settleCommentCountDelta: (postId: string, delta: number) => {
      setState(current =>
        settleCommentCountDelta(current, {delta, postId}),
      );
    },
    appendComments: (postId: string, comments: readonly PostComment[]) => {
      setState(current => appendComments(current, {comments, postId}));
    },
    changeReaction: (postId: string, reactionId: ReactionId) => {
      setState(current => changeReaction(current, postId, reactionId));
    },
    commentCountByPostId: state.commentCountByPostId,
    commentsByPostId: state.commentsByPostId,
    deleteComment: (postId: string, commentId: string) => {
      setState(current => deleteComment(current, {commentId, postId}));
    },
    replaceComment: (
      postId: string,
      comment: PostComment,
      previousCommentId?: string,
    ) => {
      setState(current =>
        replaceComment(current, {comment, postId, previousCommentId}),
      );
    },
    replaceComments: (
      postId: string,
      comments: readonly PostComment[],
      preserveCount = true,
    ) => {
      setState(current =>
        replaceComments(current, {comments, postId, preserveCount}),
      );
    },
    setCommentCount: (postId: string, commentCount: number) => {
      setState(current =>
        setCommentCount(current, {commentCount, postId}),
      );
    },
    restoreComment: (postId: string, comment: PostComment) => {
      setState(current => restoreComment(current, {comment, postId}));
    },
    reactionsByPostId: state.reactionsByPostId,
    setReaction: (
      postId: string,
      selectedReactionId: ReactionId | null,
      reactions: readonly FeedReaction[],
    ) => {
      setState(current =>
        setReaction(current, {postId, reactions, selectedReactionId}),
      );
    },
    selectedReactionByPostId: state.selectedReactionByPostId,
    updateComment: (
      postId: string,
      commentId: string,
      body: string,
      updatedAt?: string,
    ) => {
      setState(current =>
        updateComment(current, {body, commentId, postId, updatedAt}),
      );
    },
  };
}
