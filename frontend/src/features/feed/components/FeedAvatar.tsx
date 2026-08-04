import {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {RADII} from '../../../design/tokens';
import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';
import type {FeedMember} from '../types';

interface FeedAvatarProps {
  member: FeedMember;
  size?: number;
}

export function FeedAvatar({member, size = 44}: FeedAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [member.profileImageUrl]);

  const frameStyle = {height: size, width: size};
  if (member.profileImageUrl && !failed) {
    return (
      <CachedRemoteImage
        accessibilityIgnoresInvertColors
        onError={() => setFailed(true)}
        source={{uri: member.profileImageUrl}}
        style={[styles.frame, frameStyle]}
      />
    );
  }

  return (
    <View accessibilityElementsHidden style={[styles.frame, frameStyle]}>
      <Text style={styles.text}>{member.avatarText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: '#F7F5FF',
    borderColor: '#D1C9FF',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    color: '#C4BAFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
