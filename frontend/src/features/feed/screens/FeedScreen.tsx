import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {useHardwareBack} from '../../../shared/hooks/useHardwareBack';
import type {
  FeedLoader,
  FeedPageLoader,
  PostDetailLoader,
} from '../api/feedApi';
import {
  COMMENT_PAGE_SIZE,
  type CommentCreateResult,
  type CommentPageLoader,
  type UpdatedComment,
} from '../api/commentApi';
import type {ReactionChangeResult} from '../api/reactionApi';
import {FeedItem} from '../components/FeedItem';
import {PostActionsSheet} from '../components/PostActionsSheet';
import {
  ReactionPopover,
} from '../components/ReactionPopover';
import type {ReactionAnchor} from '../components/ReactionBar';
import {
  createEditInitialValue,
  type PostComposerInitialValue,
  type PostSubmitPayload,
  type UploadState,
} from '../composer/postComposerModel';
import {
  DEVELOPMENT_COMMENTS_BY_POST_ID,
  DEVELOPMENT_CURRENT_USER,
} from '../fixtures/commentFixtures';
import {useFeed} from '../hooks/useFeed';
import {usePostInteractions} from '../hooks/usePostInteractions';
import type {
  ChangeReactionInput,
  CreateCommentInput,
  DeleteCommentInput,
  FeedMember,
  FeedPost,
  PostComment,
  UpdateCommentInput,
} from '../types';
import {PostComposerScreen} from './PostComposerScreen';
import {PostDetailScreen} from './PostDetailScreen';

const EMPTY_COMMENTS_BY_POST_ID: Readonly<
  Record<string, readonly PostComment[]>
> = {};
const EMPTY_POSTS: readonly FeedPost[] = [];

export interface FeedScreenProps extends AppScreenProps {
  currentUser?: FeedMember | null;
  currentMemberId?: string;
  initialCommentsByPostId?: Readonly<
    Record<string, readonly PostComment[]>
  >;
  loader?: FeedLoader;
  pageLoader?: FeedPageLoader;
  detailLoader?: PostDetailLoader;
  onChangeReaction?: (
    input: ChangeReactionInput,
  ) => Promise<ReactionChangeResult | void> | ReactionChangeResult | void;
  onConfirmDelete?: (postId: string) => Promise<void> | void;
  onCreateComment?: (
    input: CreateCommentInput,
  ) => Promise<CommentCreateResult | void> | CommentCreateResult | void;
  onDeleteComment?: (
    input: DeleteCommentInput,
  ) => Promise<void> | void;
  onSubmitPost?: (
    payload: PostSubmitPayload,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ) => Promise<void> | void;
  onUpdateComment?: (
    input: UpdateCommentInput,
  ) => Promise<UpdatedComment | void> | UpdatedComment | void;
  commentsLoader?: CommentPageLoader;
}

interface ComposerState {
  initialValue?: PostComposerInitialValue;
  mode: 'create' | 'edit';
}

interface OpenReactionPicker {
  anchor: ReactionAnchor;
  postId: string;
}

interface CommentsState {
  error: string | null;
  hasNext: boolean;
  isLoading: boolean;
  page: number;
  postId: string | null;
}

export function FeedScreen({
  createPostRequestId = 0,
  currentGroup,
  currentMemberId,
  commentsLoader,
  currentUser,
  detailLoader,
  initialCommentsByPostId,
  loader,
  onChangeReaction,
  onConfirmDelete,
  onCreateComment,
  onDeleteComment,
  onFullscreenChange,
  onHeaderVisibilityChange,
  onOpenNotifications,
  onSubmitPost,
  onUpdateComment,
  openPostId,
  openPostRequestId = 0,
  pageLoader,
}: FeedScreenProps) {
  const feed = useFeed(
    currentGroup.id,
    loader,
    pageLoader,
    currentMemberId,
  );
  const posts = feed.status === 'success' ? feed.posts : EMPTY_POSTS;
  const feedPostsRef = useRef(posts);
  feedPostsRef.current = posts;
  const resolvedCurrentUser =
    currentUser === undefined
      ? __DEV__
        ? DEVELOPMENT_CURRENT_USER
        : null
      : currentUser;
  const resolvedInitialComments =
    initialCommentsByPostId ??
    (__DEV__
      ? DEVELOPMENT_COMMENTS_BY_POST_ID
      : EMPTY_COMMENTS_BY_POST_ID);
  // TODO: 그룹장·관리자별 추가 권한 정책이 확정되면 멤버십 권한을 주입한다.
  const canInteract = resolvedCurrentUser !== null;
  const interactions = usePostInteractions(
    posts,
    resolvedInitialComments,
  );
  const interactionsRef = useRef(interactions);
  interactionsRef.current = interactions;
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<FeedPost | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [openReactionPicker, setOpenReactionPicker] =
    useState<OpenReactionPicker | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({status: 'idle'});
  const [visiblePostIds, setVisiblePostIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [commentsState, setCommentsState] = useState<CommentsState>({
    error: null,
    hasNext: false,
    isLoading: false,
    page: 0,
    postId: null,
  });
  const pendingUploadPayload = useRef<PostSubmitPayload | null>(null);
  const uploadAbortController = useRef<AbortController | null>(null);
  const commentsRequestId = useRef(0);
  const commentsLoading = useRef(false);
  const pendingReactionPostIds = useRef(new Set<string>());
  const nextLocalCommentId = useRef(1);
  const lastCreateRequestId = useRef(createPostRequestId);
  const lastOpenPostRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const previousGroupId = useRef(currentGroup.id);
  const isDeleteConfirmationOpen = useRef(false);
  const isDeleteSubmitting = useRef(false);
  const feedScrollOffset = useRef(0);
  const handleViewablePostsChanged = useRef(
    ({viewableItems}: {viewableItems: readonly ViewToken<FeedPost>[]}) => {
      setVisiblePostIds(
        new Set(
          viewableItems
            .filter(token => token.isViewable)
            .map(token => token.item.id),
        ),
      );
    },
  ).current;

  useEffect(() => {
    if (previousGroupId.current === currentGroup.id) {
      return;
    }
    previousGroupId.current = currentGroup.id;
    detailRequestId.current += 1;
    setSelectedPostId(null);
    setDetailPost(null);
    setMenuPostId(null);
    setOpenReactionPicker(null);
    uploadAbortController.current?.abort();
    pendingUploadPayload.current = null;
    setUploadState({status: 'idle'});
    commentsRequestId.current += 1;
    commentsLoading.current = false;
    setCommentsState({
      error: null,
      hasNext: false,
      isLoading: false,
      page: 0,
      postId: null,
    });
  }, [currentGroup.id]);

  useEffect(() => {
    if (
      createPostRequestId > 0 &&
      createPostRequestId !== lastCreateRequestId.current
    ) {
      lastCreateRequestId.current = createPostRequestId;
      pendingUploadPayload.current = null;
      setUploadState({status: 'idle'});
      setComposer({mode: 'create'});
      setOpenReactionPicker(null);
    }
  }, [createPostRequestId]);

  useEffect(() => {
    if (
      openPostId &&
      openPostRequestId > 0 &&
      openPostRequestId !== lastOpenPostRequestId.current
    ) {
      lastOpenPostRequestId.current = openPostRequestId;
      setSelectedPostId(openPostId);
      setOpenReactionPicker(null);
    }
  }, [openPostId, openPostRequestId]);

  const loadCommentsPage = useCallback(
    (postId: string, page: number, replace: boolean) => {
      if (commentsLoader === undefined || commentsLoading.current) {
        return;
      }

      const requestId = commentsRequestId.current + 1;
      commentsRequestId.current = requestId;
      commentsLoading.current = true;
      setCommentsState(previous => ({
        error: null,
        hasNext: replace ? false : previous.hasNext,
        isLoading: true,
        page,
        postId,
      }));

      void commentsLoader(postId, page, COMMENT_PAGE_SIZE)
        .then(result => {
          if (commentsRequestId.current !== requestId) {
            return;
          }
          if (replace) {
            interactionsRef.current.replaceComments(
              postId,
              result.comments,
              true,
            );
          } else {
            interactionsRef.current.appendComments(postId, result.comments);
          }
          setCommentsState({
            error: null,
            hasNext: result.hasNext,
            isLoading: false,
            page,
            postId,
          });
        })
        .catch(error => {
          if (commentsRequestId.current !== requestId) {
            return;
          }
          setCommentsState(previous => ({
            ...previous,
            error:
              error instanceof Error
                ? error.message
                : '댓글을 불러오지 못했습니다. 다시 시도해 주세요.',
            isLoading: false,
            postId,
          }));
        })
        .finally(() => {
          if (commentsRequestId.current === requestId) {
            commentsLoading.current = false;
          }
        });
    },
    [commentsLoader],
  );

  useEffect(() => {
    if (selectedPostId === null) {
      detailRequestId.current += 1;
      setDetailPost(null);
      commentsRequestId.current += 1;
      commentsLoading.current = false;
      setCommentsState({
        error: null,
        hasNext: false,
        isLoading: false,
        page: 0,
        postId: null,
      });
      return;
    }

    const fallbackPost = feedPostsRef.current.find(
      post => post.id === selectedPostId,
    ) ?? null;
    setDetailPost(fallbackPost);

    if (commentsLoader !== undefined) {
      commentsRequestId.current += 1;
      commentsLoading.current = false;
      loadCommentsPage(selectedPostId, 0, true);
    } else {
      setCommentsState({
        error: null,
        hasNext: false,
        isLoading: false,
        page: 0,
        postId: selectedPostId,
      });
    }

    if (detailLoader === undefined) {
      return;
    }

    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    let isActive = true;

    detailLoader(selectedPostId, currentMemberId, currentGroup.id)
      .then(post => {
        if (post.groupId !== currentGroup.id) {
          throw new Error('The post belongs to a different group.');
        }
        if (isActive && detailRequestId.current === requestId) {
          setDetailPost(post);
        }
      })
      .catch(() => {
        if (
          isActive &&
          detailRequestId.current === requestId &&
          fallbackPost === null
        ) {
          setDetailPost(null);
          setSelectedPostId(null);
        }
        if (isActive && detailRequestId.current === requestId) {
          Alert.alert(
            '게시글 상세를 불러오지 못했어요',
            '잠시 후 다시 시도해 주세요.',
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    commentsLoader,
    currentGroup.id,
    currentMemberId,
    detailLoader,
    loadCommentsPage,
    selectedPostId,
  ]);

  useEffect(() => {
    onFullscreenChange?.(Boolean(composer));

    return () => onFullscreenChange?.(false);
  }, [composer, onFullscreenChange]);

  useEffect(() => {
    onHeaderVisibilityChange?.(!selectedPostId);
  }, [onHeaderVisibilityChange, selectedPostId]);

  useEffect(
    () => () => onHeaderVisibilityChange?.(true),
    [onHeaderVisibilityChange],
  );

  const closeReactionPicker = () => setOpenReactionPicker(null);

  useHardwareBack(() => {
    closeReactionPicker();
    setMenuPostId(null);
    setSelectedPostId(null);
    return true;
  }, selectedPostId !== null && composer === null);

  const handleToggleReactionPicker = (
    postId: string,
    anchor: ReactionAnchor,
  ) => {
    setOpenReactionPicker(current =>
      current?.postId === postId ? null : {anchor, postId},
    );
  };

  const handleSelectReaction = (
    postId: string,
    reactionId: ChangeReactionInput['nextReactionId'],
  ) => {
    if (
      !reactionId ||
      !resolvedCurrentUser ||
      pendingReactionPostIds.current.has(postId)
    ) {
      return;
    }

    const previousReactionId =
      interactions.selectedReactionByPostId[postId] ?? null;
    const previousReactions =
      interactions.reactionsByPostId[postId] ?? [];
    const nextReactionId =
      previousReactionId === reactionId ? null : reactionId;
    pendingReactionPostIds.current.add(postId);
    interactions.changeReaction(postId, reactionId);
    const input: ChangeReactionInput = {
      nextReactionId,
      postId,
      previousReactionId,
    };
    closeReactionPicker();

    if (onChangeReaction === undefined) {
      pendingReactionPostIds.current.delete(postId);
      return;
    }

    void Promise.resolve()
      .then(() => onChangeReaction(input))
      .then(result => {
        if (result === undefined || result.postId !== postId) {
          return;
        }
        interactionsRef.current.setReaction(
          postId,
          result.reactionType,
          result.reactions,
        );
      })
      .catch(error => {
        interactionsRef.current.setReaction(
          postId,
          previousReactionId,
          previousReactions,
        );
        Alert.alert(
          '반응을 저장하지 못했습니다',
          error instanceof Error
            ? error.message
            : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
        );
      })
      .finally(() => {
        pendingReactionPostIds.current.delete(postId);
      });
  };

  const handleOpenPost = (postId: string) => {
    closeReactionPicker();
    setSelectedPostId(postId);
  };

  const handleFeedScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    feedScrollOffset.current = event.nativeEvent.contentOffset.y;
  };

  const handleCreateComment = async (
    input: CreateCommentInput,
  ): Promise<void> => {
    if (!resolvedCurrentUser) {
      return;
    }

    const localCommentId = `local-comment-${nextLocalCommentId.current++}`;
    interactions.addComment(
      input.postId,
      input.body,
      resolvedCurrentUser,
      {commentId: localCommentId},
    );
    if (onCreateComment === undefined) {
      return;
    }

    try {
      const result = await onCreateComment(input);
      if (result === undefined) {
        return;
      }
      interactionsRef.current.replaceComment(
        input.postId,
        {
          author: resolvedCurrentUser,
          body: result.content,
          createdAt: result.createdAt,
          id: result.id,
          postId: result.postId,
          updatedAt: result.createdAt,
        },
        localCommentId,
      );
    } catch (error) {
      interactionsRef.current.deleteComment(input.postId, localCommentId);
      Alert.alert(
        '댓글을 저장하지 못했습니다',
        error instanceof Error
          ? error.message
          : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      );
    }
  };

  const handleUpdateComment = async (
    input: UpdateCommentInput,
  ): Promise<void> => {
    const previousComment = interactions.commentsByPostId[input.postId]?.find(
      comment => comment.id === input.commentId,
    );
    interactions.updateComment(
      input.postId,
      input.commentId,
      input.body,
    );
    if (onUpdateComment === undefined) {
      return;
    }

    try {
      const result = await onUpdateComment(input);
      if (result === undefined) {
        return;
      }
      interactionsRef.current.updateComment(
        input.postId,
        input.commentId,
        result.content,
        result.updatedAt,
      );
    } catch (error) {
      if (previousComment !== undefined) {
        interactionsRef.current.replaceComment(
          input.postId,
          previousComment,
        );
      }
      Alert.alert(
        '댓글을 수정하지 못했습니다',
        error instanceof Error
          ? error.message
          : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      );
    }
  };

  const handleDeleteComment = (input: DeleteCommentInput) => {
    const previousComment = interactions.commentsByPostId[input.postId]?.find(
      comment => comment.id === input.commentId,
    );
    interactions.deleteComment(input.postId, input.commentId);
    if (onDeleteComment === undefined) {
      return;
    }

    void Promise.resolve()
      .then(() => onDeleteComment(input))
      .catch(error => {
        if (previousComment !== undefined) {
          interactionsRef.current.restoreComment(
            input.postId,
            previousComment,
          );
        }
        Alert.alert(
          '댓글을 삭제하지 못했습니다',
          error instanceof Error
            ? error.message
            : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
        );
      });
  };

  const submitComposerPayload = async (payload: PostSubmitPayload) => {
    if (onSubmitPost === undefined) {
      Alert.alert(
        'API 연결 전 단계예요',
        '작성·수정 데이터와 콜백 호출까지 준비됐습니다.',
      );
      return;
    }
    if (
      uploadState.status === 'preparing' ||
      uploadState.status === 'uploading'
    ) {
      return;
    }

    pendingUploadPayload.current = payload;
    const controller = new AbortController();
    uploadAbortController.current = controller;
    setUploadState({status: 'preparing'});
    try {
      await onSubmitPost(
        payload,
        progress => setUploadState({progress, status: 'uploading'}),
        controller.signal,
      );
      if (controller.signal.aborted) {
        return;
      }
      setUploadState({status: 'success'});
      pendingUploadPayload.current = null;
      setComposer(null);
      setSelectedPostId(null);
      setDetailPost(null);
      feed.retry();
    } catch (error) {
      if (
        (controller.signal.aborted &&
          pendingUploadPayload.current !== payload) ||
        (isUploadCancelled(error) && pendingUploadPayload.current !== payload)
      ) {
        return;
      }
      if (controller.signal.aborted || isUploadCancelled(error)) {
        setUploadState({status: 'cancelled'});
      } else {
        setUploadState({
          message:
            error instanceof Error
              ? error.message
              : '게시글 저장에 실패했습니다. 다시 시도해 주세요.',
          status: 'failure',
        });
      }
    } finally {
      if (uploadAbortController.current === controller) {
        uploadAbortController.current = null;
      }
    }
  };

  const cancelComposer = () => {
    uploadAbortController.current?.abort();
    uploadAbortController.current = null;
    pendingUploadPayload.current = null;
    setUploadState({status: 'idle'});
    setComposer(null);
  };

  if (composer) {
    return (
      <PostComposerScreen
        initialValue={composer.initialValue}
        mode={composer.mode}
        onCancel={cancelComposer}
        onRetryUpload={() => {
          if (pendingUploadPayload.current !== null) {
            void submitComposerPayload(pendingUploadPayload.current);
          }
        }}
        onSubmit={payload => void submitComposerPayload(payload)}
        uploadState={uploadState}
      />
    );
  }

  if (feed.status === 'loading') {
    return (
      <View accessibilityLabel="피드 불러오는 중" style={styles.centered}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    );
  }

  if (feed.status === 'error') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.centered}>
        <Text style={styles.errorText}>{feed.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={feed.retry}
          style={styles.retryButton}
        >
          <MaterialDesignIcons
            color={COLORS.text}
            name="refresh"
            size={18}
          />
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const selectedPost =
    detailPost?.id === selectedPostId
      ? detailPost
      : feed.posts.find(post => post.id === selectedPostId) ?? null;
  const menuPost = feed.posts.find(post => post.id === menuPostId) ?? null;

  const handleEdit = () => {
    if (!menuPost || !menuPost.isOwnedByCurrentUser) {
      return;
    }
    setMenuPostId(null);
    pendingUploadPayload.current = null;
    setUploadState({status: 'idle'});
    setComposer({
      initialValue: createEditInitialValue(menuPost),
      mode: 'edit',
    });
  };

  const handleDelete = () => {
    if (
      !menuPost ||
      !menuPost.isOwnedByCurrentUser ||
      isDeleteConfirmationOpen.current ||
      isDeleteSubmitting.current
    ) {
      return;
    }

    const postId = menuPost.id;
    setMenuPostId(null);
    isDeleteConfirmationOpen.current = true;
    Alert.alert(
      '게시글을 삭제할까요?',
      '삭제한 게시글은 다시 복구할 수 없어요.',
      [
        {
          onPress: () => {
            isDeleteConfirmationOpen.current = false;
          },
          style: 'cancel',
          text: '취소',
        },
        {
          onPress: () => {
            isDeleteConfirmationOpen.current = false;
            if (!onConfirmDelete) {
              Alert.alert(
                '삭제 API 연결 전 단계예요',
                '삭제 확인 콜백만 호출하며 피드 데이터는 유지합니다.',
              );
              return;
            }
            isDeleteSubmitting.current = true;
            Promise.resolve()
              .then(() => onConfirmDelete(postId))
              .then(() => {
                feed.retry();
                setSelectedPostId(null);
                setDetailPost(null);
              })
              .catch(() => {
                Alert.alert(
                  '삭제 요청을 처리하지 못했어요',
                  '게시글은 피드에 그대로 유지됩니다.',
                );
              })
              .finally(() => {
                isDeleteSubmitting.current = false;
              });
          },
          style: 'destructive',
          text: '삭제',
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          isDeleteConfirmationOpen.current = false;
        },
      },
    );
  };

  if (selectedPost) {
    const comments =
      interactions.commentsByPostId[selectedPost.id] ?? [];
    const reactions =
      interactions.reactionsByPostId[selectedPost.id] ??
      selectedPost.reactions;
    const selectedReactionId =
      interactions.selectedReactionByPostId[selectedPost.id] ?? null;

    return (
      <View style={styles.feedRoot}>
        <PostDetailScreen
          canInteract={canInteract}
          commentCount={
            interactions.commentCountByPostId[selectedPost.id] ??
            selectedPost.commentCount
          }
          comments={comments}
          commentsError={commentsState.error}
          commentsHasNext={commentsState.hasNext}
          currentGroupName={currentGroup.name}
          currentUser={resolvedCurrentUser}
          isCommentsLoading={commentsState.isLoading}
          isReactionPickerOpen={
            openReactionPicker?.postId === selectedPost.id
          }
          onBack={() => {
            closeReactionPicker();
            setMenuPostId(null);
            setSelectedPostId(null);
          }}
          onCreateComment={handleCreateComment}
          onDeleteComment={handleDeleteComment}
          onLoadMoreComments={() => {
            if (
              selectedPostId !== null &&
              commentsState.hasNext &&
              !commentsState.isLoading
            ) {
              loadCommentsPage(selectedPostId, commentsState.page + 1, false);
            }
          }}
          onMenuPress={() => setMenuPostId(selectedPost.id)}
          onOpenNotifications={onOpenNotifications}
          onScrollBeginDrag={closeReactionPicker}
          onRetryComments={() => {
            if (selectedPostId !== null) {
              loadCommentsPage(selectedPostId, 0, true);
            }
          }}
          onToggleReactionPicker={handleToggleReactionPicker}
          onUpdateComment={handleUpdateComment}
          post={selectedPost}
          reactions={reactions}
          selectedReactionId={selectedReactionId}
        />
        <PostActionsSheet
          isOpen={menuPost?.id === selectedPost.id}
          onClose={() => setMenuPostId(null)}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
        <ReactionPopover
          anchor={
            openReactionPicker?.anchor ?? {
              height: 0,
              width: 0,
              x: 0,
              y: 0,
            }
          }
          onClose={closeReactionPicker}
          onSelect={reactionId =>
            handleSelectReaction(selectedPost.id, reactionId)
          }
          selectedReactionId={selectedReactionId}
          visible={openReactionPicker?.postId === selectedPost.id}
        />
      </View>
    );
  }

  return (
    <View style={styles.feedRoot}>
      <FlatList
        contentContainerStyle={[
          styles.listContent,
          feed.posts.length === 0 && styles.emptyListContent,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        contentOffset={{x: 0, y: feedScrollOffset.current}}
        data={feed.posts}
        keyExtractor={post => post.id}
        ListEmptyComponent={<EmptyFeedState />}
        ListFooterComponent={
          feed.isLoadingMore ? (
            <ActivityIndicator color={COLORS.purple} style={styles.listFooter} />
          ) : null
        }
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        onScroll={handleFeedScroll}
        onScrollBeginDrag={closeReactionPicker}
        onViewableItemsChanged={handleViewablePostsChanged}
        renderItem={({item}) => {
          const reactions =
            interactions.reactionsByPostId[item.id] ?? item.reactions;

          return (
            <FeedItem
              canInteract={canInteract}
              commentCount={
                interactions.commentCountByPostId[item.id] ??
                item.commentCount
              }
              isVisible={visiblePostIds.has(item.id)}
              isReactionPickerOpen={
                openReactionPicker?.postId === item.id
              }
              onPress={handleOpenPost}
              onToggleReactionPicker={handleToggleReactionPicker}
              post={{...item, reactions}}
              selectedReactionId={
                interactions.selectedReactionByPostId[item.id] ?? null
              }
            />
          );
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      <ReactionPopover
        anchor={
          openReactionPicker?.anchor ?? {
            height: 0,
            width: 0,
            x: 0,
            y: 0,
          }
        }
        onClose={closeReactionPicker}
        onSelect={reactionId => {
          if (openReactionPicker) {
            handleSelectReaction(openReactionPicker.postId, reactionId);
          }
        }}
        selectedReactionId={
          openReactionPicker
            ? interactions.selectedReactionByPostId[
                openReactionPicker.postId
              ] ?? null
            : null
        }
        visible={openReactionPicker !== null}
      />
    </View>
  );
}

function isUploadCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'UPLOAD_CANCELLED'
  );
}

function EmptyFeedState() {
  return (
    <View accessibilityLabel="게시물이 없는 피드" style={styles.emptyState}>
      <Text style={styles.emptyText}>
        아직 공유된 일상이 없어요.{'\n'}
        사랑하는 가족에게 오늘의{'\n'}
        이야기를 전해보세요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 72,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#5C5752',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  feedRoot: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  listContent: {
    backgroundColor: COLORS.background,
    flexGrow: 1,
  },
  listFooter: {
    paddingVertical: 16,
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  retryText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
