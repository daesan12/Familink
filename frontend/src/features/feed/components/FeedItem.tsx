import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS} from '../../../design/tokens';
import {formatRelativeTime} from '../time';
import type {FeedMember, FeedPost, ReactionId} from '../types';
import {FeedAvatar} from './FeedAvatar';
import {PostImageCarousel} from './PostImageCarousel';
import {ReactionBar, type ReactionAnchor} from './ReactionBar';

// 본문·사진·반응은 모두 프로필 사진 왼쪽 끝에 맞춘다.
// 사진은 가로 폭을 직접 계산하므로 본문만 들여쓰면 왼쪽 선이 어긋난다.
const SCREEN_PADDING = 20;

// 댓글 수는 화면 끝에 붙지 않도록 글쓰기 버튼 여백만큼 한 번 더 들여쓴다.
const META_RIGHT_PADDING = SCREEN_PADDING * 2;

interface FeedItemProps {
  canInteract: boolean;
  commentCount: number;
  isVisible: boolean;
  isReactionPickerOpen: boolean;
  onPress: (postId: string) => void;
  onPressAuthor?: (author: FeedMember) => void;
  onSelectReaction: (postId: string, reactionId: ReactionId) => void;
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
  onSelectReaction,
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
        enableFullscreen
        images={post.images}
        isVisible={isVisible}
      />

      <View style={styles.metaRow}>
        <ReactionBar
          canReact={canInteract}
          isVisible={isVisible}
          isPickerOpen={isReactionPickerOpen}
          onSelectReaction={reactionId =>
            onSelectReaction(post.id, reactionId)
          }
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
    paddingHorizontal: SCREEN_PADDING,
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
    paddingLeft: SCREEN_PADDING,
    paddingRight: META_RIGHT_PADDING,
  },
});
