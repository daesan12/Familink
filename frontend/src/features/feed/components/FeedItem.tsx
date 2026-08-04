import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS} from '../../../design/tokens';
import {formatRelativeTime} from '../time';
import type {FeedMember, FeedPost, ReactionId} from '../types';
import {FeedAvatar} from './FeedAvatar';
import {PostImageCarousel} from './PostImageCarousel';
import {ReactionBar, type ReactionAnchor} from './ReactionBar';

interface FeedItemProps {
  canInteract: boolean;
  commentCount: number;
  isVisible: boolean;
  isReactionPickerOpen: boolean;
  onPress: (postId: string) => void;
  onPressAuthor?: (author: FeedMember) => void;
  onToggleReactionPicker: (
    postId: string,
    anchor: ReactionAnchor,
  ) => void;
  post: FeedPost;
  selectedReactionId: ReactionId | null;
}

export function FeedItem({
  canInteract,
  commentCount,
  isVisible,
  isReactionPickerOpen,
  onPress,
  onPressAuthor,
  onToggleReactionPicker,
  post,
  selectedReactionId,
}: FeedItemProps) {
  const handlePress = () => onPress(post.id);

  return (
    <View style={styles.container}>
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
          <Text style={styles.authorName}>{post.author.name}</Text>
          <Text style={styles.createdAt}>
            {formatRelativeTime(post.createdAt)}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityHint="게시글 상세 화면으로 이동합니다"
        accessibilityLabel={`${post.author.name}님의 게시글: ${post.body}`}
        accessibilityRole="button"
        onPress={handlePress}
      >
        <Text style={styles.body}>{post.body}</Text>
      </Pressable>
      <PostImageCarousel
        images={post.images}
        isVisible={isVisible}
        onImagePress={handlePress}
      />

      <View style={styles.metaRow}>
        <ReactionBar
          canReact={canInteract}
          isPickerOpen={isReactionPickerOpen}
          onTogglePicker={anchor =>
            onToggleReactionPicker(post.id, anchor)
          }
          reactions={post.reactions}
          selectedReactionId={selectedReactionId}
        />
        <Pressable
          accessibilityLabel={`댓글 ${commentCount}개 보기`}
          accessibilityRole="button"
          onPress={handlePress}
          style={styles.commentButton}
        >
          <Text style={styles.commentText}>댓글 {commentCount}</Text>
        </Pressable>
      </View>
    </View>
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
    lineHeight: 21,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 9,
  },
  commentButton: {
    minHeight: 44,
    minWidth: 58,
    paddingVertical: 12,
  },
  commentText: {
    color: COLORS.textStrong,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  container: {
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
    paddingTop: 16,
  },
  createdAt: {
    color: COLORS.textStrong,
    fontSize: 11,
    lineHeight: 15,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
});
