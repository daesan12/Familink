import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {PostImageCarousel} from '../components/PostImageCarousel';
import type {FeedPost} from '../types';

interface PostDetailScreenProps {
  currentGroupName: string;
  onBack: () => void;
  onMenuPress: () => void;
  post: FeedPost;
}

export function PostDetailScreen({
  currentGroupName,
  onBack,
  onMenuPress,
  post,
}: PostDetailScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="피드로 돌아가기"
          accessibilityRole="button"
          hitSlop={8}
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
        <View accessibilityElementsHidden style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
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
              hitSlop={10}
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
                size={17}
              />
            </Pressable>
          </View>
          <Text style={styles.commentCount}>댓글 {post.commentCount}</Text>
        </View>

        <View style={styles.comments}>
          <Text style={styles.commentsTitle}>댓글</Text>
          {post.commentCount > 0 ? (
            <Text style={styles.commentsPlaceholder}>
              댓글 기능은 후속 연동에서 제공됩니다.
            </Text>
          ) : (
            <Text style={styles.commentsPlaceholder}>
              아직 작성된 댓글이 없어요.
            </Text>
          )}
        </View>
      </ScrollView>
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
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavender,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  body: {
    color: COLORS.textStrong,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
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
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  commentsPlaceholder: {
    color: COLORS.textSubtle,
    fontSize: 14,
    lineHeight: 21,
  },
  commentsTitle: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '700',
  },
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 32,
    paddingTop: 20,
  },
  createdAt: {
    color: COLORS.textStrong,
    fontSize: 11,
    lineHeight: 15,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 20,
  },
  headerSpacer: {
    height: 36,
    width: 36,
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
  title: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
