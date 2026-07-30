import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {CommentItem} from '../components/CommentItem';
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

interface PostDetailScreenProps {
  canInteract: boolean;
  commentCount: number;
  comments: readonly PostComment[];
  currentGroupName: string;
  currentUser: FeedMember | null;
  isReactionPickerOpen: boolean;
  onBack: () => void;
  onCreateComment: (input: CreateCommentInput) => void;
  onDeleteComment: (input: DeleteCommentInput) => void;
  onMenuPress: () => void;
  onOpenNotifications?: () => void;
  onScrollBeginDrag: () => void;
  onToggleReactionPicker: (
    postId: string,
    anchor: ReactionAnchor,
  ) => void;
  onUpdateComment: (input: UpdateCommentInput) => void;
  post: FeedPost;
  reactions: readonly FeedReaction[];
  selectedReactionId: ReactionId | null;
}

export function PostDetailScreen({
  canInteract,
  commentCount,
  comments,
  currentGroupName,
  currentUser,
  isReactionPickerOpen,
  onBack,
  onCreateComment,
  onDeleteComment,
  onMenuPress,
  onOpenNotifications,
  onScrollBeginDrag,
  onToggleReactionPicker,
  onUpdateComment,
  post,
  reactions,
  selectedReactionId,
}: PostDetailScreenProps) {
  const [commentMenu, setCommentMenu] = useState<PostComment | null>(null);
  const [editingComment, setEditingComment] =
    useState<PostComment | null>(null);
  const [inputValue, setInputValue] = useState('');
  const isSubmitting = useRef(false);
  const trimmedInput = inputValue.trim();
  const isEditingUnchanged =
    editingComment !== null &&
    trimmedInput === editingComment.body.trim();
  const canSubmit =
    canInteract &&
    currentUser !== null &&
    trimmedInput.length > 0 &&
    !isEditingUnchanged;

  const resetComposer = () => {
    setEditingComment(null);
    setInputValue('');
  };

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting.current) {
      return;
    }

    isSubmitting.current = true;
    try {
      if (editingComment) {
        onUpdateComment({
          body: trimmedInput,
          commentId: editingComment.id,
          postId: post.id,
        });
      } else {
        onCreateComment({body: trimmedInput, postId: post.id});
      }
      resetComposer();
    } finally {
      isSubmitting.current = false;
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="피드로 돌아가기"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <MaterialDesignIcons
            color={COLORS.background}
            name="chevron-left"
            size={28}
          />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>
          {currentGroupName}
        </Text>
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authorRow}>
          <View accessibilityElementsHidden style={styles.avatar}>
            <Text style={styles.avatarText}>{post.author.avatarText}</Text>
          </View>
          <View style={styles.authorText}>
            <Text style={styles.authorName}>{post.author.name}</Text>
            <Text style={styles.createdAt}>{post.createdAtLabel}</Text>
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

        <Text style={styles.body}>{post.body}</Text>
        <PostImageCarousel images={post.images} />

        <View style={styles.metaRow}>
          <ReactionBar
            canReact={canInteract}
            isPickerOpen={isReactionPickerOpen}
            onTogglePicker={anchor =>
              onToggleReactionPicker(post.id, anchor)
            }
            reactions={reactions}
            selectedReactionId={selectedReactionId}
          />
          <Text style={styles.commentCount}>댓글 {commentCount}</Text>
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
          ) : (
            <View accessibilityLabel="댓글 없음" style={styles.emptyComments}>
              <Text style={styles.emptyCommentsTitle}>
                아직 댓글이 없어요.
              </Text>
              <Text style={styles.emptyCommentsDescription}>
                가족에게 따뜻한 한마디를 남겨보세요.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {canInteract && currentUser ? (
        <View style={styles.composerSection}>
          {editingComment ? (
            <View style={styles.editingHeader}>
              <Text style={styles.editingLabel}>댓글 수정 중</Text>
              <Pressable
                accessibilityLabel="댓글 수정 취소"
                accessibilityRole="button"
                onPress={resetComposer}
                style={styles.cancelEditButton}
              >
                <Text style={styles.cancelEditText}>취소</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
            <View accessibilityElementsHidden style={styles.composerAvatar}>
              <Text style={styles.composerAvatarText}>
                {currentUser.avatarText}
              </Text>
            </View>
            <TextInput
              accessibilityLabel={
                editingComment ? '댓글 수정 입력' : '댓글 입력'
              }
              editable={!isSubmitting.current}
              maxLength={MAX_COMMENT_LENGTH}
              onChangeText={setInputValue}
              onSubmitEditing={handleSubmit}
              placeholder="댓글을 입력해 주세요"
              placeholderTextColor={COLORS.textSubtle}
              returnKeyType="send"
              style={styles.input}
              value={inputValue}
            />
            <Text
              accessibilityLabel={`댓글 글자 수 ${inputValue.length}/${MAX_COMMENT_LENGTH}`}
              style={styles.characterCount}
            >
              {inputValue.length}/{MAX_COMMENT_LENGTH}
            </Text>
            <Pressable
              accessibilityLabel={
                editingComment ? '댓글 수정 완료' : '댓글 등록'
              }
              accessibilityRole="button"
              accessibilityState={{disabled: !canSubmit}}
              disabled={!canSubmit}
              onPress={handleSubmit}
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
          <Text style={styles.readOnlyNoticeText}>
            그룹 구성원만 댓글과 반응을 남길 수 있어요.
          </Text>
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
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F7F5FF',
    borderColor: '#D1C9FF',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    color: '#C4BAFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavender,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
  composerAvatar: {
    alignItems: 'center',
    backgroundColor: '#F7F5FF',
    borderColor: '#D1C9FF',
    borderRadius: RADII.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  composerAvatarText: {
    color: '#C4BAFF',
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 0,
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
