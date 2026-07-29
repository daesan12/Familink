import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import type {FeedPost} from '../types';
import {PostImageCarousel} from './PostImageCarousel';

interface FeedItemProps {
  onPress: (postId: string) => void;
  post: FeedPost;
}

export function FeedItem({onPress, post}: FeedItemProps) {
  const handlePress = () => onPress(post.id);

  return (
    <View style={styles.container}>
      <View style={styles.authorRow}>
        <View accessibilityElementsHidden style={styles.avatar}>
          <Text style={styles.avatarText}>{post.author.avatarText}</Text>
        </View>
        <View style={styles.authorText}>
          <Text style={styles.authorName}>{post.author.name}</Text>
          <Text style={styles.createdAt}>{post.createdAtLabel}</Text>
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
      <PostImageCarousel images={post.images} onImagePress={handlePress} />

      <View style={styles.metaRow}>
        <View style={styles.reactions}>
          {post.reactions.map(reaction => (
            <View key={reaction.id} style={styles.reactionChip}>
              <Text
                accessibilityLabel={`${reaction.id} 반응 ${reaction.count}개`}
                style={styles.reactionEmoji}
              >
                {reaction.emoji}
              </Text>
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            </View>
          ))}
          <Pressable
            accessibilityLabel="반응 추가"
            accessibilityRole="button"
            style={styles.addReaction}
          >
            <MaterialDesignIcons
              color={COLORS.textStrong}
              name="plus"
              size={16}
            />
          </Pressable>
        </View>
        <Pressable
          accessibilityLabel={`댓글 ${post.commentCount}개 보기`}
          accessibilityRole="button"
          onPress={handlePress}
          style={styles.commentButton}
        >
          <Text style={styles.commentText}>댓글 {post.commentCount}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addReaction: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
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
  reactionChip: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    flexDirection: 'row',
    gap: 4,
    height: 28,
    paddingHorizontal: 8,
  },
  reactionCount: {
    color: COLORS.textStrong,
    fontSize: 10,
    fontWeight: '600',
  },
  reactionEmoji: {
    color: '#FF7474',
    fontSize: 14,
  },
  reactions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
