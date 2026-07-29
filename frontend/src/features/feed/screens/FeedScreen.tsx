import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useState} from 'react';
import {
  ActivityIndicator,
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
import {useFeed} from '../hooks/useFeed';
import {PostDetailScreen} from './PostDetailScreen';

interface FeedScreenProps extends AppScreenProps {
  loader?: FeedLoader;
}

export function FeedScreen({currentGroup, loader}: FeedScreenProps) {
  const feed = useFeed(currentGroup.id, loader);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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

  if (selectedPost) {
    return (
      <PostDetailScreen
        onBack={() => setSelectedPostId(null)}
        post={selectedPost}
      />
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
        아직 공유된 일상이 없어요{'\n'}
        사랑하는 가족에게 오늘의{'\n'}
        이야기를 전해보세요
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
