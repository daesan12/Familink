import {useEffect, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';

import {RADII} from '../../../design/tokens';
import type {FeedMember} from '../types';

const PROFILE_PLACEHOLDER = require('../../../assets/images/profile-placeholder.png');

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
      <Image
        accessibilityIgnoresInvertColors
        onError={() => setFailed(true)}
        source={{uri: member.profileImageUrl}}
        style={[styles.frame, frameStyle]}
      />
    );
  }

  return (
    <View accessibilityElementsHidden style={[styles.frame, frameStyle]}>
      <Image
        accessibilityIgnoresInvertColors
        source={PROFILE_PLACEHOLDER}
        style={styles.placeholderImage}
      />
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
  placeholderImage: {
    height: '100%',
    width: '100%',
  },
});
