import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useRef,
  useState} from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, FONT_FAMILY, RADII} from '../../../design/tokens';
import {BackButton} from '../../../shared/components/BackButton';
import {CommentItem} from '../components/CommentItem';
import {FeedAvatar} from '../components/FeedAvatar';
import {PostActionsSheet} from '../components/PostActionsSheet';
import {PostImageCarousel} from '../components/PostImageCarousel';
import {
  ReactionBar,
  type ReactionAnchor,
} from '../components/ReactionBar';
import type {
  CreateCommentInput,
  DeleteCommentInput,
  FeedMember,
  FeedPost,
  FeedReaction,
  PostComment,
  ReactionId,
  UpdateCommentInput,
} from '../types';
import {MAX_COMMENT_LENGTH} from '../types';
import {formatRelativeTime} from '../time';

interface PostDetailScreenProps {
  canInteract: boolean;
  commentCount: number;
  comments: readonly PostComment[];
  commentsError?: string | null;
  commentsHasNext?: boolean;
  currentGroupName: string;
  currentUser: FeedMember | null;
  isCommentsLoading?: boolean;
  isRefreshing?: boolean;
  isReactionPickerOpen: boolean;
  onBack: () => void;
  onCreateComment: (input: CreateCommentInput) => Promise<void>;
  onDeleteComment: (input: DeleteCommentInput) => void;
  onLoadMoreComments?: () => void;
  onMenuPress: () => void;
  onOpenNotifications?: () => void;
  onPressAuthor?: (author: FeedMember) => void;
  onScrollBeginDrag: () => void;
  onToggleReactionPicker: (
    postId: string,
    anchor: ReactionAnchor,
  ) => void;
  onRetryComments?: () => void;
  onRefresh?: () => void;
  onSelectReaction: (postId: string, reactionId: ReactionId) => void;
  onUpdateComment: (input: UpdateCommentInput) => Promise<void>;
  post: FeedPost;
  reactions: readonly FeedReaction[];
  selectedReactionId: ReactionId | null;
}

export function PostDetailScreen({
  canInteract,
  commentCount,
  comments,
  commentsError = null,
  commentsHasNext = false,
  currentGroupName,
  currentUser,
  isCommentsLoading = false,
  isRefreshing = false,
  isReactionPickerOpen,
  onBack,
  onCreateComment,
  onDeleteComment,
  onLoadMoreComments,
  onMenuPress,
  onOpenNotifications,
  onPressAuthor,
  onScrollBeginDrag,
  onToggleReactionPicker,
  onRetryComments,
  onRefresh,
  onSelectReaction,
  onUpdateComment,
  post,
  reactions,
  selectedReactionId,
}: PostDetailScreenProps) {
  const [commentMenu, setCommentMenu] = useState<PostComment | null>(null);
  const [editingComment, setEditingComment] =
    useState<PostComment | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const trimmedInput = inputValue.trim();
  const isEditingUnchanged =
    editingComment !== null &&
    trimmedInput === editingComment.body.trim();
  const canSubmit =
    canInteract &&
    currentUser !== null &&
    trimmedInput.length > 0 &&
    !isEditingUnchanged &&
    !isSubmitting;

  const resetComposer = () => {
    setEditingComment(null);
    setInputValue('');
  };

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (editingComment) {
        await onUpdateComment({
          body: trimmedInput,
          commentId: editingComment.id,
          postId: post.id,
        });
      } else {
        await onCreateComment({body: trimmedInput, postId: post.id});
      }
      resetComposer();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleOpenCommentMenu = (comment: PostComment) => {
    if (comment.author.id !== currentUser?.id) {
      return;
    }
    setCommentMenu(comment);
  };

  const handleEditComment = () => {
    if (!commentMenu || commentMenu.author.id !== currentUser?.id) {
      return;
    }

    setEditingComment(commentMenu);
    setInputValue(commentMenu.body);
    setCommentMenu(null);
  };

  const handleDeleteComment = () => {
    if (!commentMenu || commentMenu.author.id !== currentUser?.id) {
      return;
    }

    const target = commentMenu;
    setCommentMenu(null);
    Alert.alert(
      '댓글을 삭제할까요?',
      '삭제한 댓글은 다시 복구할 수 없어요.',
      [
        {style: 'cancel', text: '취소'},
        {
          onPress: () => {
            onDeleteComment({
              commentId: target.id,
              postId: post.id,
            });
            if (editingComment?.id === target.id) {
              resetComposer();
            }
          },
          style: 'destructive',
          text: '삭제',
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.container}
    >
      <View style={styles.header}>
        <BackButton accessibilityLabel="피드로 돌아가기" onPress={onBack} />
        <AppText numberOfLines={1} style={styles.title}>
          {currentGroupName}
        </AppText>
        {onOpenNotifications ? (
          <Pressable
            accessibilityLabel="알림"
            accessibilityRole="button"
            onPress={onOpenNotifications}
            style={styles.notificationButton}
          >
            <MaterialDesignIcons
              color={COLORS.textStrong}
              name="bell"
              size={28}
            />
          </Pressable>
        ) : (
          <View accessibilityElementsHidden style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={onScrollBeginDrag}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              onRefresh={onRefresh}
              refreshing={isRefreshing}
              tintColor={COLORS.purple}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authorRow}>
          {onPressAuthor === undefined ? (
            <FeedAvatar member={post.author} />
          ) : (
            <Pressable
              accessibilityLabel={`${post.author.name}님의 프로필 보기`}
              accessibilityRole="button"
              onPress={() => onPressAuthor(post.author)}
            >
              <FeedAvatar member={post.author} />
            </Pressable>
          )}
          <View style={styles.authorText}>
            <AppText style={styles.authorName}>{post.author.name}</AppText>
            <AppText style={styles.createdAt}>
              {formatRelativeTime(post.createdAt)}
            </AppText>
          </View>
          {post.isOwnedByCurrentUser ? (
            <Pressable
              accessibilityLabel="게시글 수정 및 삭제 메뉴"
              accessibilityRole="button"
              onPress={onMenuPress}
              style={styles.menuButton}
            >
              <MaterialDesignIcons
                color={COLORS.textStrong}
                name="dots-horizontal"
                size={24}
              />
            </Pressable>
          ) : null}
        </View>

        <AppText style={styles.body}>{post.body}</AppText>
        <PostImageCarousel enableFullscreen images={post.images} />

        <View style={styles.metaRow}>
          <ReactionBar
            canReact={canInteract}
            isPickerOpen={isReactionPickerOpen}
            onSelectReaction={reactionId =>
              onSelectReaction(post.id, reactionId)
            }
            onTogglePicker={anchor =>
              onToggleReactionPicker(post.id, anchor)
            }
            reactions={reactions}
            selectedReactionId={selectedReactionId}
          />
          <AppText style={styles.commentCount}>댓글 {commentCount}</AppText>
        </View>

        <View style={styles.comments}>
          {comments.length > 0 ? (
            comments.map(comment => (
              <CommentItem
                comment={comment}
                currentUserId={currentUser?.id ?? null}
                key={comment.id}
                onMenuPress={handleOpenCommentMenu}
              />
            ))
          ) : (!isCommentsLoading && !commentsError) ? (
            <View accessibilityLabel="댓글 없음" style={styles.emptyComments}>
              <AppText style={styles.emptyCommentsTitle}>
                아직 댓글이 없어요.
              </AppText>
              <AppText style={styles.emptyCommentsDescription}>
                가족에게 따뜻한 한마디를 남겨보세요.
              </AppText>
            </View>
          ) : null}
        </View>
        {commentsError ? (
          <View accessibilityLiveRegion="polite" style={styles.commentsError}>
            <AppText style={styles.commentsErrorText}>{commentsError}</AppText>
            {onRetryComments ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRetryComments}
                style={styles.retryCommentsButton}
              >
                <AppText style={styles.retryCommentsText}>다시 시도</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {isCommentsLoading ? (
          <ActivityIndicator
            accessibilityLabel="댓글을 불러오는 중"
            color={COLORS.purple}
            style={styles.commentsLoading}
          />
        ) : commentsHasNext && onLoadMoreComments ? (
          <Pressable
            accessibilityRole="button"
            onPress={onLoadMoreComments}
            style={styles.loadMoreCommentsButton}
          >
            <AppText style={styles.loadMoreCommentsText}>댓글 더 보기</AppText>
          </Pressable>
        ) : null}
      </ScrollView>

      {canInteract && currentUser ? (
        <View style={styles.composerSection}>
          {editingComment ? (
            <View style={styles.editingHeader}>
              <AppText style={styles.editingLabel}>댓글 수정 중</AppText>
              <Pressable
                accessibilityLabel="댓글 수정 취소"
                accessibilityRole="button"
                onPress={resetComposer}
                style={styles.cancelEditButton}
              >
                <AppText style={styles.cancelEditText}>취소</AppText>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel={
                editingComment ? '댓글 수정 입력' : '댓글 입력'
              }
              editable={!isSubmitting}
              maxLength={MAX_COMMENT_LENGTH}
              onChangeText={setInputValue}
              onSubmitEditing={() => void handleSubmit()}
              placeholder="댓글을 입력해 주세요"
              placeholderTextColor={COLORS.textSubtle}
              returnKeyType="send"
              style={styles.input}
              value={inputValue}
            />
            <AppText
              accessibilityLabel={`댓글 글자 수 ${inputValue.length}/${MAX_COMMENT_LENGTH}`}
              style={styles.characterCount}
            >
              {inputValue.length}/{MAX_COMMENT_LENGTH}
            </AppText>
            <Pressable
              accessibilityLabel={
                editingComment ? '댓글 수정 완료' : '댓글 등록'
              }
              accessibilityRole="button"
              accessibilityState={{disabled: !canSubmit}}
              disabled={!canSubmit}
              onPress={() => void handleSubmit()}
              style={[
                styles.sendButton,
                canSubmit ? styles.sendButtonActive : styles.sendButtonDisabled,
              ]}
            >
              <MaterialDesignIcons
                color={
                  canSubmit ? COLORS.background : COLORS.textDisabled
                }
                name="arrow-up"
                size={25}
              />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.readOnlyNotice}>
          <AppText style={styles.readOnlyNoticeText}>
            그룹 구성원만 댓글과 반응을 남길 수 있어요.
          </AppText>
        </View>
      )}

      <PostActionsSheet
        deleteLabel="댓글 삭제"
        dismissLabel="댓글 메뉴 닫기"
        editLabel="댓글 수정"
        isOpen={commentMenu !== null}
        onClose={() => setCommentMenu(null)}
        onDelete={handleDeleteComment}
        onEdit={handleEditComment}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  authorName: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  authorText: {
    flex: 1,
    gap: 1,
    marginLeft: 12,
  },
  body: {
    color: COLORS.textStrong,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  cancelEditButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cancelEditText: {
    color: COLORS.purpleDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  characterCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    marginRight: 8,
  },
  commentCount: {
    color: COLORS.textStrong,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 64,
    textAlign: 'right',
  },
  comments: {
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
  },
  composer: {
    alignItems: 'center',
    borderColor: COLORS.inactive,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingLeft: 6,
    paddingRight: 4,
  },
  composerSection: {
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 24,
    paddingTop: 12,
  },
  createdAt: {
    color: COLORS.textStrong,
    fontSize: 11,
    lineHeight: 15,
  },
  commentsError: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentsErrorText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  commentsLoading: {
    paddingVertical: 16,
  },
  editingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 34,
    justifyContent: 'space-between',
  },
  editingLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
    paddingHorizontal: 24,
  },
  emptyCommentsDescription: {
    color: COLORS.textSubtle,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    textAlign: 'center',
  },
  emptyCommentsTitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 20,
  },
  headerSpacer: {
    height: 44,
    width: 44,
  },
  input: {
    color: COLORS.textStrong,
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  loadMoreCommentsButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  loadMoreCommentsText: {
    color: COLORS.purpleDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  menuButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 20,
  },
  notificationButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  readOnlyNotice: {
    alignItems: 'center',
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  readOnlyNoticeText: {
    color: COLORS.textSubtle,
    fontSize: 13,
  },
  retryCommentsButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  retryCommentsText: {
    color: COLORS.purpleDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  sendButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonActive: {
    backgroundColor: COLORS.textStrong,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.surfaceMuted,
  },
  title: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
