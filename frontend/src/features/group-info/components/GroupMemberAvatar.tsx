import {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';
import type {GroupMember} from '../types';

interface GroupMemberAvatarProps {
  member: Pick<GroupMember, 'avatarText' | 'name' | 'profileImageUrl'>;
  size?: number;
}

export function GroupMemberAvatar({
  member,
  size = 44,
}: GroupMemberAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = member.profileImageUrl?.trim() || null;
  const showImage = imageUrl !== null && failedUrl !== imageUrl;

  return (
    <View
      accessibilityLabel={`${member.name} 프로필 사진`}
      style={[styles.container, {height: size, width: size}]}
    >
      {showImage ? (
        <CachedRemoteImage
          onError={() => setFailedUrl(imageUrl)}
          resizeMode="cover"
          source={{uri: imageUrl}}
          style={styles.image}
        />
      ) : (
        <Text style={[styles.fallbackText, {fontSize: Math.max(13, size * 0.36)}]}>
          {member.avatarText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackText: {
    color: COLORS.textMuted,
    fontWeight: '800',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
