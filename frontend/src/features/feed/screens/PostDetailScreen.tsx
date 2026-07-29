import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {PostImageCarousel} from '../components/PostImageCarousel';
import type {FeedPost} from '../types';

interface PostDetailScreenProps {
  onBack: () => void;
  post: FeedPost;
}

export function PostDetailScreen({onBack, post}: PostDetailScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="피드로 돌아가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={styles.headerButton}
        >
          <MaterialDesignIcons
            color={COLORS.textStrong}
            name="arrow-left"
            size={24}
          />
        </Pressable>
        <Text style={styles.title}>게시글 상세</Text>
        <Pressable
          accessibilityLabel="게시글 메뉴"
          accessibilityRole="button"
          hitSlop={8}
          style={styles.headerButton}
        >
          <MaterialDesignIcons
            color={COLORS.textStrong}
            name="dots-horizontal"
            size={24}
          />
        </Pressable>
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
        </View>

        <Text style={styles.body}>{post.body}</Text>
        <PostImageCarousel images={post.images} variant="detail" />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            반응 {post.reactions.reduce((sum, reaction) => sum + reaction.count, 0)}
          </Text>
          <Text style={styles.summaryText}>댓글 {post.commentCount}</Text>
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
  authorName: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  authorText: {
    flex: 1,
    gap: 2,
    marginLeft: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F7F5FF',
    borderColor: '#D1C9FF',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: '#C4BAFF',
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    color: COLORS.textStrong,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  comments: {
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 16,
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
    paddingTop: 16,
  },
  createdAt: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 8,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  summaryText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
});
