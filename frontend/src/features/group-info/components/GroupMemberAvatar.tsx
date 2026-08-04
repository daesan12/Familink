import {useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import type {GroupMember} from '../types';

const PROFILE_PLACEHOLDER = require('../../../assets/images/profile-placeholder.png');

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
        <Image
          onError={() => setFailedUrl(imageUrl)}
          resizeMode="cover"
          source={{uri: imageUrl}}
          style={styles.image}
        />
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          source={PROFILE_PLACEHOLDER}
          style={styles.image}
        />
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
  image: {
    height: '100%',
    width: '100%',
  },
});
