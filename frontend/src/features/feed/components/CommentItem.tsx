import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {formatRelativeTime} from '../time';
import type {PostComment} from '../types';

interface CommentItemProps {
  comment: PostComment;
  currentUserId: string | null;
  onMenuPress: (comment: PostComment) => void;
}

export function CommentItem({
  comment,
  currentUserId,
  onMenuPress,
}: CommentItemProps) {
  const isOwnedByCurrentUser = comment.author.id === currentUserId;

  return (
    <View style={styles.container}>
      <View accessibilityElementsHidden style={styles.avatar}>
        <Text style={styles.avatarText}>{comment.author.avatarText}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.authorName}>{comment.author.name}</Text>
          <Text style={styles.createdAt}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </View>
        <Text style={styles.body}>{comment.body}</Text>
      </View>
      {isOwnedByCurrentUser ? (
        <Pressable
          accessibilityLabel={`${comment.author.name}님의 댓글 수정 및 삭제 메뉴`}
          accessibilityRole="button"
          onPress={() => onMenuPress(comment)}
          style={styles.menuButton}
        >
          <MaterialDesignIcons
            color={COLORS.textStrong}
            name="dots-horizontal"
            size={22}
          />
        </Pressable>
      ) : null}
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
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  container: {
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 96,
    paddingVertical: 16,
  },
  content: {
    flex: 1,
    marginLeft: 14,
    paddingTop: 1,
  },
  createdAt: {
    color: '#73706E',
    fontSize: 11,
    lineHeight: 15,
    marginLeft: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  menuButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginLeft: 4,
    width: 44,
  },
});
