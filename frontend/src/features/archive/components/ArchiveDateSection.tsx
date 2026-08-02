import {StyleSheet, Text, View} from 'react-native';

import {COLORS} from '../../../design/tokens';
import type {ArchiveDateGroup, ArchivePost} from '../types';
import {ArchiveMediaTile} from './ArchiveMediaTile';

interface ArchiveDateSectionProps {
  group: ArchiveDateGroup;
  onOpenPost?: (post: ArchivePost) => void;
}

export function ArchiveDateSection({
  group,
  onOpenPost,
}: ArchiveDateSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.dateLabel}>{group.dateLabel}</Text>
      <View style={styles.grid}>
        {group.posts.map(post => (
          <View key={post.id} style={styles.cell}>
            <ArchiveMediaTile onPress={onOpenPost} post={post} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    marginBottom: 10,
    width: '48%',
  },
  dateLabel: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  section: {
    marginBottom: 20,
  },
});
