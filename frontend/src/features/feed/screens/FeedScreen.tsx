import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
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
} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import type {FeedLoader} from '../api/feedApi';
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
  initialCommentsByPostId?: Readonly<
    Record<string, readonly PostComment[]>
  >;
  loader?: FeedLoader;
  onChangeReaction?: (input: ChangeReactionInput) => void;
  onConfirmDelete?: (postId: string) => Promise<void> | void;
  onCreateComment?: (input: CreateCommentInput) => void;
  onDeleteComment?: (input: DeleteCommentInput) => void;
  onSubmitPost?: (payload: PostSubmitPayload) => void;
  onUpdateComment?: (input: UpdateCommentInput) => void;
}

interface ComposerState {
  initialValue?: PostComposerInitialValue;
  mode: 'create' | 'edit';
}

interface OpenReactionPicker {
  anchor: ReactionAnchor;
  postId: string;
}

export function FeedScreen({
  createPostRequestId = 0,
  currentGroup,
  currentUser,
  initialCommentsByPostId,
  loader,
  onChangeReaction,
  onConfirmDelete,
  onCreateComment,
  onDeleteComment,
  onFullscreenChange,
  onHeaderVisibilityChange,
  onSubmitPost,
  onUpdateComment,
}: FeedScreenProps) {
  const feed = useFeed(currentGroup.id, loader);
  const posts = feed.status === 'success' ? feed.posts : EMPTY_POSTS;
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
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [openReactionPicker, setOpenReactionPicker] =
    useState<OpenReactionPicker | null>(null);
  const lastCreateRequestId = useRef(createPostRequestId);
  const isDeleteConfirmationOpen = useRef(false);
  const isDeleteSubmitting = useRef(false);
  const feedScrollOffset = useRef(0);

  useEffect(() => {
    if (
      createPostRequestId > 0 &&
      createPostRequestId !== lastCreateRequestId.current
    ) {
      lastCreateRequestId.current = createPostRequestId;
      setComposer({mode: 'create'});
      setOpenReactionPicker(null);
    }
  }, [createPostRequestId]);

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
    if (!reactionId || !resolvedCurrentUser) {
      return;
    }

    const previousReactionId =
      interactions.selectedReactionByPostId[postId] ?? null;
    const nextReactionId =
      previousReactionId === reactionId ? null : reactionId;
    interactions.changeReaction(postId, reactionId);
    onChangeReaction?.({
      nextReactionId,
      postId,
      previousReactionId,
    });
    closeReactionPicker();
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

  if (composer) {
    return (
      <PostComposerScreen
        initialValue={composer.initialValue}
        mode={composer.mode}
        onCancel={() => setComposer(null)}
        onSubmit={payload => {
          onSubmitPost?.(payload);
          if (!onSubmitPost) {
            Alert.alert(
              'API 연결 전 단계예요',
              '작성·수정 데이터와 콜백 호출까지 준비됐습니다.',
            );
          }
        }}
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
    feed.posts.find(post => post.id === selectedPostId) ?? null;
  const menuPost = feed.posts.find(post => post.id === menuPostId) ?? null;

  const handleEdit = () => {
    if (!menuPost || !menuPost.isOwnedByCurrentUser) {
      return;
    }
    setMenuPostId(null);
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
          currentGroupName={currentGroup.name}
          currentUser={resolvedCurrentUser}
          isReactionPickerOpen={
            openReactionPicker?.postId === selectedPost.id
          }
          onBack={() => {
            closeReactionPicker();
            setMenuPostId(null);
            setSelectedPostId(null);
          }}
          onCreateComment={input => {
            if (!resolvedCurrentUser) {
              return;
            }
            interactions.addComment(
              input.postId,
              input.body,
              resolvedCurrentUser,
            );
            onCreateComment?.(input);
          }}
          onDeleteComment={input => {
            interactions.deleteComment(
              input.postId,
              input.commentId,
            );
            onDeleteComment?.(input);
          }}
          onMenuPress={() => setMenuPostId(selectedPost.id)}
          onScrollBeginDrag={closeReactionPicker}
          onToggleReactionPicker={handleToggleReactionPicker}
          onUpdateComment={input => {
            interactions.updateComment(
              input.postId,
              input.commentId,
              input.body,
            );
            onUpdateComment?.(input);
          }}
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
        onScroll={handleFeedScroll}
        onScrollBeginDrag={closeReactionPicker}
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
