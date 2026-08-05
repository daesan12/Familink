import type {
  FeedMember,
  FeedPost,
  FeedReaction,
  PostComment,
  ReactionId,
} from '../types';

export const REACTION_OPTIONS: readonly Omit<FeedReaction, 'count'>[] = [
  {emoji: '❤️', id: 'HEART', label: '사랑해요'},
  {emoji: '😂', id: 'LAUGH', label: '웃겨요'},
  {emoji: '😮', id: 'SURPRISE', label: '놀랐어요'},
  {emoji: '😢', id: 'SAD', label: '슬퍼요'},
  {emoji: '👏', id: 'SUPPORT', label: '응원해요'},
];

const LOCAL_COMMENT_ID_PREFIX = 'local-comment-';

export interface PostInteractionsState {
  commentCountDeltaByPostId: Readonly<Record<string, number>>;
  commentCountByPostId: Readonly<Record<string, number>>;
  commentsByPostId: Readonly<Record<string, readonly PostComment[]>>;
  reactionsByPostId: Readonly<Record<string, readonly FeedReaction[]>>;
  selectedReactionByPostId: Readonly<
    Record<string, ReactionId | null | undefined>
  >;
}

export function createPostInteractionsState(
  posts: readonly FeedPost[],
  commentsByPostId: Readonly<Record<string, readonly PostComment[]>>,
): PostInteractionsState {
  return {
    commentCountDeltaByPostId: Object.fromEntries(
      posts.map(post => [post.id, 0]),
    ),
    commentCountByPostId: Object.fromEntries(
      posts.map(post => [
        post.id,
        Object.prototype.hasOwnProperty.call(commentsByPostId, post.id)
          ? commentsByPostId[post.id]?.length ?? 0
          : post.commentCount,
      ]),
    ),
    commentsByPostId: {...commentsByPostId},
    reactionsByPostId: Object.fromEntries(
      posts.map(post => [post.id, post.reactions]),
    ),
    selectedReactionByPostId: Object.fromEntries(
      posts.map(post => [post.id, post.currentUserReactionId ?? null]),
    ),
  };
}

export function addComment(
  state: PostInteractionsState,
  input: {
    author: FeedMember;
    body: string;
    commentId: string;
    createdAt: string;
    postId: string;
    updatedAt?: string;
  },
): PostInteractionsState {
  const comments = state.commentsByPostId[input.postId] ?? [];
  const comment: PostComment = {
    author: input.author,
    body: input.body.trim(),
    createdAt: input.createdAt,
    id: input.commentId,
    postId: input.postId,
    updatedAt: input.updatedAt,
  };

  return {
    ...state,
    commentCountDeltaByPostId: {
      ...state.commentCountDeltaByPostId,
      [input.postId]:
        (state.commentCountDeltaByPostId[input.postId] ?? 0) + 1,
    },
    commentCountByPostId: {
      ...state.commentCountByPostId,
      [input.postId]:
        (state.commentCountByPostId[input.postId] ?? comments.length) + 1,
    },
    commentsByPostId: {
      ...state.commentsByPostId,
      [input.postId]: [...comments, comment],
    },
  };
}

export function updateComment(
  state: PostInteractionsState,
  input: {
    body: string;
    commentId: string;
    postId: string;
    updatedAt?: string;
  },
): PostInteractionsState {
  const comments = state.commentsByPostId[input.postId] ?? [];

  return {
    ...state,
    commentsByPostId: {
      ...state.commentsByPostId,
      [input.postId]: comments.map(comment =>
        comment.id === input.commentId
          ? {
              ...comment,
              body: input.body.trim(),
              ...(input.updatedAt === undefined
                ? {}
                : {updatedAt: input.updatedAt}),
            }
          : comment,
      ),
    },
  };
}

export function replaceComments(
  state: PostInteractionsState,
  input: {
    comments: readonly PostComment[];
    postId: string;
    preserveCount?: boolean;
  },
): PostInteractionsState {
  const current = state.commentsByPostId[input.postId] ?? [];
  const nextIds = new Set(input.comments.map(comment => comment.id));
  const pendingLocalComments = current.filter(
    comment =>
      comment.id.startsWith(LOCAL_COMMENT_ID_PREFIX) &&
      !nextIds.has(comment.id),
  );

  return {
    ...state,
    commentCountByPostId: input.preserveCount
      ? state.commentCountByPostId
      : {
          ...state.commentCountByPostId,
          [input.postId]: input.comments.length,
        },
    commentsByPostId: {
      ...state.commentsByPostId,
      [input.postId]: [...input.comments, ...pendingLocalComments],
    },
  };
}

export function setCommentCount(
  state: PostInteractionsState,
  input: {commentCount: number; postId: string},
): PostInteractionsState {
  return {
    ...state,
    commentCountByPostId: {
      ...state.commentCountByPostId,
      [input.postId]: Math.max(
        0,
        input.commentCount +
          (state.commentCountDeltaByPostId[input.postId] ?? 0),
      ),
    },
  };
}

export function settleCommentCountDelta(
  state: PostInteractionsState,
  input: {delta: number; postId: string},
): PostInteractionsState {
  if (input.delta === 0) {
    return state;
  }
  return {
    ...state,
    commentCountDeltaByPostId: {
      ...state.commentCountDeltaByPostId,
      [input.postId]:
        (state.commentCountDeltaByPostId[input.postId] ?? 0) - input.delta,
    },
  };
}

export function appendComments(
  state: PostInteractionsState,
  input: {comments: readonly PostComment[]; postId: string},
): PostInteractionsState {
  const current = state.commentsByPostId[input.postId] ?? [];
  const seenIds = new Set(current.map(comment => comment.id));
  const next = input.comments.filter(comment => {
    if (seenIds.has(comment.id)) {
      return false;
    }
    seenIds.add(comment.id);
    return true;
  });

  return replaceComments(state, {
    comments: [...current, ...next],
    postId: input.postId,
    preserveCount: true,
  });
}

export function replaceComment(
  state: PostInteractionsState,
  input: {
    comment: PostComment;
    postId: string;
    previousCommentId?: string;
  },
): PostInteractionsState {
  const comments = state.commentsByPostId[input.postId] ?? [];
  const previousCommentId = input.previousCommentId ?? input.comment.id;
  return {
    ...state,
    commentsByPostId: {
      ...state.commentsByPostId,
      [input.postId]: comments.map(comment =>
        comment.id === previousCommentId ? input.comment : comment,
      ),
    },
  };
}

export function restoreComment(
  state: PostInteractionsState,
  input: {comment: PostComment; postId: string},
): PostInteractionsState {
  const comments = state.commentsByPostId[input.postId] ?? [];
  if (comments.some(comment => comment.id === input.comment.id)) {
    return state;
  }
  return {
    ...state,
    commentCountDeltaByPostId: {
      ...state.commentCountDeltaByPostId,
      [input.postId]:
        (state.commentCountDeltaByPostId[input.postId] ?? 0) + 1,
    },
    commentCountByPostId: {
      ...state.commentCountByPostId,
      [input.postId]:
        (state.commentCountByPostId[input.postId] ?? comments.length) + 1,
    },
    commentsByPostId: {
      ...state.commentsByPostId,
      [input.postId]: [...comments, input.comment],
    },
  };
}

export function deleteComment(
  state: PostInteractionsState,
  input: {commentId: string; postId: string},
): PostInteractionsState {
  const comments = state.commentsByPostId[input.postId] ?? [];
  const containsComment = comments.some(
    comment => comment.id === input.commentId,
  );

  return {
    ...state,
    commentCountDeltaByPostId: {
      ...state.commentCountDeltaByPostId,
      [input.postId]:
        (state.commentCountDeltaByPostId[input.postId] ?? 0) -
        (containsComment ? 1 : 0),
    },
    commentCountByPostId: {
      ...state.commentCountByPostId,
      [input.postId]: containsComment
        ? Math.max(
            0,
            (state.commentCountByPostId[input.postId] ?? comments.length) -
              1,
          )
        : state.commentCountByPostId[input.postId] ?? comments.length,
    },
    commentsByPostId: {
      ...state.commentsByPostId,
      [input.postId]: comments.filter(
        comment => comment.id !== input.commentId,
      ),
    },
  };
}

export function changeReaction(
  state: PostInteractionsState,
  postId: string,
  nextReactionId: ReactionId,
): PostInteractionsState {
  const previousReactionId =
    state.selectedReactionByPostId[postId] ?? null;
  const selectedReactionId =
    previousReactionId === nextReactionId ? null : nextReactionId;
  const currentCounts = new Map(
    (state.reactionsByPostId[postId] ?? []).map(reaction => [
      reaction.id,
      reaction.count,
    ]),
  );

  if (previousReactionId !== null) {
    currentCounts.set(
      previousReactionId,
      Math.max(0, (currentCounts.get(previousReactionId) ?? 0) - 1),
    );
  }
  if (selectedReactionId !== null) {
    currentCounts.set(
      selectedReactionId,
      (currentCounts.get(selectedReactionId) ?? 0) + 1,
    );
  }

  return {
    ...state,
    reactionsByPostId: {
      ...state.reactionsByPostId,
      [postId]: REACTION_OPTIONS.map(option => ({
        ...option,
        count: currentCounts.get(option.id) ?? 0,
      })),
    },
    selectedReactionByPostId: {
      ...state.selectedReactionByPostId,
      [postId]: selectedReactionId,
    },
  };
}

export function setReaction(
  state: PostInteractionsState,
  input: {
    postId: string;
    reactions: readonly FeedReaction[];
    selectedReactionId: ReactionId | null;
  },
): PostInteractionsState {
  return {
    ...state,
    reactionsByPostId: {
      ...state.reactionsByPostId,
      [input.postId]: input.reactions,
    },
    selectedReactionByPostId: {
      ...state.selectedReactionByPostId,
      [input.postId]: input.selectedReactionId,
    },
  };
}
