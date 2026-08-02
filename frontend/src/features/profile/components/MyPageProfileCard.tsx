import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import type {Gender} from '../types';
import {formatGenderLabel} from '../profileModel';

const PROFILE_PLACEHOLDER = require('../../../assets/images/profile-placeholder.png');

interface MyPageProfileCardProps {
  name: string;
  age: number;
  gender: Gender;
  profileImageUrl?: string | null;
  onEdit: () => void;
  // 보호자만 사용하는 주간 랭킹 배지와 지난주 1위 왕관. 피보호자는 넘기지 않는다.
  rank?: number;
  hasCrown?: boolean;
}

// I-1·J-1 마이페이지 상단 프로필 카드. 더보기(···)로 프로필 편집에 진입한다.
export function MyPageProfileCard({
  name,
  age,
  gender,
  profileImageUrl,
  onEdit,
  rank,
  hasCrown = false,
}: MyPageProfileCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel="프로필 편집"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onEdit}
        style={styles.moreButton}
      >
        <MaterialDesignIcons
          color={COLORS.textMuted}
          name="dots-vertical"
          size={22}
        />
      </Pressable>

      <View style={styles.avatarColumn}>
        {hasCrown ? (
          <View style={styles.crown}>
            <MaterialDesignIcons
              color={COLORS.textMuted}
              name="crown"
              size={30}
            />
          </View>
        ) : null}
        <Image
          accessibilityIgnoresInvertColors
          source={
            profileImageUrl ? {uri: profileImageUrl} : PROFILE_PLACEHOLDER
          }
          style={styles.avatar}
        />
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          {rank !== undefined ? (
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{rank}</Text>
            </View>
          ) : null}
          <Text style={styles.name}>{name} 님</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>나이</Text>
          <Text style={styles.metaValue}>만 {age}세</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>성별</Text>
          <Text style={styles.metaValue}>{formatGenderLabel(gender)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    height: 96,
    width: 96,
  },
  avatarColumn: {
    alignItems: 'center',
  },
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  crown: {
    marginBottom: -8,
    zIndex: 1,
  },
  info: {
    flex: 1,
  },
  metaLabel: {
    color: COLORS.textStrong,
    fontSize: 13,
    fontWeight: '700',
    width: 34,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  metaValue: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  moreButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
    zIndex: 1,
  },
  name: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: '700',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.textMuted,
    borderRadius: RADII.pill,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  rankBadgeText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '700',
  },
});
