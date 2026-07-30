import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import type {ArchivePost} from '../types';

interface ArchiveMediaTileProps {
  onPress?: (post: ArchivePost) => void;
  post: ArchivePost;
}

export function ArchiveMediaTile({onPress, post}: ArchiveMediaTileProps) {
  const accessibilityLabel =
    post.mediaKind === 'text'
      ? `글 게시물: ${post.text ?? ''}`
      : post.thumbnailAccessibilityLabel;

  return (
    <Pressable
      accessibilityHint="게시글 상세 화면으로 이동합니다"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => onPress?.(post)}
      style={({pressed}) => [
        styles.tile,
        post.mediaKind === 'text' && styles.textTile,
        pressed && styles.tilePressed,
      ]}
    >
      {post.mediaKind === 'text' ? (
        <Text numberOfLines={4} style={styles.textBody}>
          {post.text}
        </Text>
      ) : (
        <>
          {post.thumbnail ? (
            <Image
              resizeMode="cover"
              source={post.thumbnail}
              style={styles.thumbnail}
            />
          ) : null}
          {post.mediaKind === 'video' ? (
            <View accessibilityElementsHidden style={styles.playOverlay}>
              <View style={styles.playBadge}>
                <MaterialDesignIcons
                  color={COLORS.background}
                  name="play"
                  size={26}
                />
              </View>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  playBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.imageOverlay,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 46,
    justifyContent: 'center',
    paddingLeft: 3,
    width: 46,
  },
  playOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  textBody: {
    color: COLORS.textMuted,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  textTile: {
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: 'center',
    padding: 16,
  },
  thumbnail: {
    height: '100%',
    width: '100%',
  },
  tile: {
    aspectRatio: 1,
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    overflow: 'hidden',
    width: '100%',
  },
  tilePressed: {
    opacity: 0.85,
  },
});
