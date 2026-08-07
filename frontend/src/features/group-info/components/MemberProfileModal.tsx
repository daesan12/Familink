import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';
import {RetryButton} from '../../../shared/components/RetryButton';
import {formatAge, formatGender} from '../groupInfoModel';
import {WEEKLY_STAMP_DAYS, type GroupMember} from '../types';
import {GroupMemberAvatar} from './GroupMemberAvatar';

const CARNATION_IMAGE = require('../../../assets/images/carnation.png');

interface MemberProfileModalProps {
  errorMessage?: string | null;
  isLoading?: boolean;
  member: GroupMember | null;
  onClose: () => void;
  onRetry?: () => void;
}

// H-1p 축소 프로필 팝업. 구성원 아바타를 누르면 열리며
// 이름·순위·나이·성별과 일주일 도장 현황을 보여준다.
export function MemberProfileModal({
  errorMessage,
  isLoading = false,
  member,
  onClose,
  onRetry,
}: MemberProfileModalProps) {
  const isWeeklyWinner =
    member?.previousWeekWinner ?? member?.weeklyRank === 1;
  // 도장·순위·왕관은 효자 랭킹 요소라 보호자에게만 보여준다.
  // 피보호자는 이름·나이·성별만 표시한다.
  const showRanking =
    member?.role === 'guardian' &&
    (member.weeklyRank !== undefined ||
      member.weeklyStamps !== undefined ||
      member.previousWeekWinner !== undefined);
  // 계약이 7이 아닌 길이를 주더라도 항상 7칸으로 고정한다.
  const stamps = Array.from(
    {length: WEEKLY_STAMP_DAYS},
    (_, index) => member?.weeklyStamps?.[index] ?? false,
  );
  const earnedCount = stamps.filter(Boolean).length;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={member !== null}
    >
      <Pressable
        accessibilityLabel="프로필 닫기"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
      >
        {member ? (
          // 카드 내부 터치가 배경 닫기로 전파되지 않도록 별도 Pressable로 감싼다.
          // accessible={false}로 두어 카드 전체가 하나의 버튼 노드로 묶이지 않게 한다.
          <Pressable
            accessibilityViewIsModal
            accessible={false}
            onPress={() => {}}
            style={styles.card}
          >
            {isLoading ? (
              <View accessibilityLabel="프로필 정보를 불러오는 중" style={styles.statusBlock}>
                <ActivityIndicator color={COLORS.purple} />
              </View>
            ) : errorMessage ? (
              <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
                <AppText style={styles.errorText}>{errorMessage}</AppText>
                {onRetry ? (
                  <RetryButton
                    accessibilityLabel="프로필 정보 다시 시도"
                    onPress={onRetry}
                  />
                ) : null}
              </View>
            ) : null}
            <View style={styles.headerRow}>
              <View style={styles.avatarWrap}>
                <GroupMemberAvatar member={member} size={88} />
                {showRanking && isWeeklyWinner ? (
                  <View
                    accessibilityLabel="이번 주 1위"
                    accessible
                    style={styles.crown}
                  >
                    <MaterialDesignIcons
                      color={COLORS.textStrong}
                      name="crown"
                      size={22}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.info}>
                <View style={styles.nameRow}>
                  {showRanking && member.weeklyRank !== undefined ? (
                    <View
                      accessibilityLabel={`순위 ${member.weeklyRank}위`}
                      accessible
                      style={styles.rankBadge}
                    >
                      <AppText style={styles.rankBadgeText}>
                        {member.weeklyRank}
                      </AppText>
                    </View>
                  ) : null}
                  <AppText style={styles.name}>{member.name} 님</AppText>
                </View>
                <View style={styles.metaRow}>
                  <AppText style={styles.metaLabel}>나이</AppText>
                  <AppText style={styles.metaValue}>{formatAge(member.age)}</AppText>
                </View>
                <View style={styles.metaRow}>
                  <AppText style={styles.metaLabel}>성별</AppText>
                  <AppText style={styles.metaValue}>
                    {formatGender(member.gender)}
                  </AppText>
                </View>
              </View>
            </View>

            {showRanking ? (
              <View
                accessibilityLabel={`일주일 도장 현황, 이번 주 ${earnedCount}/${WEEKLY_STAMP_DAYS}일 적립`}
                accessible
                style={styles.stampRow}
              >
                {stamps.map((earned, index) => (
                  <View
                    importantForAccessibility="no-hide-descendants"
                    key={index}
                    style={[styles.stamp, earned && styles.stampEarned]}
                  >
                    {earned ? (
                      <Image
                        resizeMode="contain"
                        source={CARNATION_IMAGE}
                        style={styles.stampImage}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    height: 88,
    width: 88,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderRadius: RADII.sheet,
    gap: 20,
    padding: 24,
    width: '100%',
  },
  crown: {
    left: -6,
    position: 'absolute',
    top: -12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  metaLabel: {
    color: COLORS.textSubtle,
    fontSize: 13,
    fontWeight: '700',
    width: 34,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  metaValue: {
    color: COLORS.text,
    fontSize: 14,
  },
  name: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.textStrong,
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
  stamp: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    // 고정 폭 대신 가용 폭을 7칸이 균등하게 나눠 좁은 단말에서도 한 줄에 들어온다.
    flex: 1,
    justifyContent: 'center',
    maxWidth: 40,
  },
  stampEarned: {
    backgroundColor: COLORS.lemon,
  },
  // 칸 크기가 단말 폭에 따라 달라지므로 마이페이지 도장판과 같은 80% 비율로 맞춘다.
  stampImage: {
    height: '80%',
    width: '80%',
  },
  stampRow: {
    flexDirection: 'row',
    gap: 6,
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  statusBlock: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
