import type {
  FeedMember,
  FeedPost,
  FeedReaction,
  PostComment,
  ReactionId,
} from '../types';

export const REACTION_OPTIONS: readonly Omit<FeedReaction, 'count'>[] = [
  {emoji: '❤️', id: 'love', label: '사랑해요'},
  {emoji: '😊', id: 'happy', label: '행복해요'},
  {emoji: '😂', id: 'laugh', label: '웃겨요'},
  {emoji: '🤗', id: 'hug', label: '안아줄게요'},
  {emoji: '👏', id: 'cheer', label: '응원해요'},
];

export interface PostInteractionsState {
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
  },
): PostInteractionsState {
  const comments = state.commentsByPostId[input.postId] ?? [];
  const comment: PostComment = {
    author: input.author,
    body: input.body.trim(),
    createdAt: input.createdAt,
    id: input.commentId,
    postId: input.postId,
  };

  return {
    ...state,
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
  input: {body: string; commentId: string; postId: string},
): PostInteractionsState {
  const comments = state.commentsByPostId[input.postId] ?? [];

  return {
    ...state,
    commentsByPostId: {
      ...state.commentsByPostId,
      [input.postId]: comments.map(comment =>
        comment.id === input.commentId
          ? {...comment, body: input.body.trim()}
          : comment,
      ),
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
