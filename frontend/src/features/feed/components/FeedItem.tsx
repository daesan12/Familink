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
    <Pressable
      accessible={false}
      onPress={handlePress}
      style={styles.container}
      testID={`feed-post-card-${post.id}`}
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
        <Pressable
          accessibilityLabel={`${post.author.name}의 게시글 상세 보기`}
          accessibilityRole="button"
          hitSlop={{bottom: 8, left: 0, right: 8, top: 8}}
          onPress={handlePress}
          style={styles.authorText}
        >
          <Text style={styles.authorName}>{post.author.name}</Text>
          <Text style={styles.createdAt}>
            {formatRelativeTime(post.createdAt)}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityHint="게시글 상세 화면으로 이동합니다"
        accessibilityLabel={`${post.author.name}님의 게시글: ${post.body}`}
        accessibilityRole="button"
        hitSlop={{bottom: 8, left: 0, right: 0, top: 8}}
        onPress={handlePress}
        style={styles.detailBodyPressable}
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
    </Pressable>
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
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
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
  detailBodyPressable: {
    alignSelf: 'stretch',
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: SCREEN_PADDING,
    paddingRight: META_RIGHT_PADDING,
  },
});
