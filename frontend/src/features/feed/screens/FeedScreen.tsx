import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  createEditInitialValue,
  type PostComposerInitialValue,
  type PostSubmitPayload,
} from '../composer/postComposerModel';
import {useFeed} from '../hooks/useFeed';
import {PostComposerScreen} from './PostComposerScreen';
import {PostDetailScreen} from './PostDetailScreen';

interface FeedScreenProps extends AppScreenProps {
  loader?: FeedLoader;
  onConfirmDelete?: (postId: string) => Promise<void> | void;
  onSubmitPost?: (payload: PostSubmitPayload) => void;
}

interface ComposerState {
  initialValue?: PostComposerInitialValue;
  mode: 'create' | 'edit';
}

export function FeedScreen({
  createPostRequestId = 0,
  currentGroup,
  loader,
  onConfirmDelete,
  onFullscreenChange,
  onHeaderVisibilityChange,
  onSubmitPost,
}: FeedScreenProps) {
  const feed = useFeed(currentGroup.id, loader);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const lastCreateRequestId = useRef(createPostRequestId);
  const isDeleteConfirmationOpen = useRef(false);
  const isDeleteSubmitting = useRef(false);

  useEffect(() => {
    if (
      createPostRequestId > 0 &&
      createPostRequestId !== lastCreateRequestId.current
    ) {
      lastCreateRequestId.current = createPostRequestId;
      setComposer({mode: 'create'});
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
    return (
      <View style={styles.feedRoot}>
        <PostDetailScreen
          currentGroupName={currentGroup.name}
          onBack={() => {
            setMenuPostId(null);
            setSelectedPostId(null);
          }}
          onMenuPress={() => setMenuPostId(selectedPost.id)}
          post={selectedPost}
        />
        <PostActionsSheet
          isOpen={menuPost?.id === selectedPost.id}
          onClose={() => setMenuPostId(null)}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[
        styles.listContent,
        feed.posts.length === 0 && styles.emptyListContent,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      data={feed.posts}
      keyExtractor={post => post.id}
      ListEmptyComponent={<EmptyFeedState />}
      renderItem={({item}) => (
        <FeedItem onPress={setSelectedPostId} post={item} />
      )}
      showsVerticalScrollIndicator={false}
    />
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
