import {useEffect, useRef, useState} from 'react';

import {
  addComment,
  changeReaction,
  createPostInteractionsState,
  deleteComment,
  updateComment,
} from '../interactions/postInteractions';
import type {
  FeedMember,
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
    addComment: (postId: string, body: string, author: FeedMember) => {
      setState(current =>
        addComment(current, {
          author,
          body,
          commentId: `local-comment-${nextLocalCommentId.current++}`,
          createdAt: new Date().toISOString(),
          postId,
        }),
      );
    },
    changeReaction: (postId: string, reactionId: ReactionId) => {
      setState(current => changeReaction(current, postId, reactionId));
    },
    commentCountByPostId: state.commentCountByPostId,
    commentsByPostId: state.commentsByPostId,
    deleteComment: (postId: string, commentId: string) => {
      setState(current => deleteComment(current, {commentId, postId}));
    },
    reactionsByPostId: state.reactionsByPostId,
    selectedReactionByPostId: state.selectedReactionByPostId,
    updateComment: (postId: string, commentId: string, body: string) => {
      setState(current =>
        updateComment(current, {body, commentId, postId}),
      );
    },
  };
}
