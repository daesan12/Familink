import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {avatarInitial, formatWeekRange, rankEntries} from '../rankingModel';
import type {GroupMember, WeeklyRankingLoadState} from '../types';
import {GroupMemberAvatar} from './GroupMemberAvatar';

interface WeeklyRankingModalProps {
  // 모달 노출 여부. 랭킹 카드를 눌러 연다.
  visible: boolean;
  // 랭킹 조회 상태(로딩·실패·성공).
  state: WeeklyRankingLoadState;
  onClose: () => void;
  onRetry: () => void;
  members?: readonly GroupMember[];
}

// H-3 주간 효자 랭킹. 그룹정보의 "효자 랭킹 조회하기" 카드를 누르면 열린다.
// 카네이션은 보호자만 적립하므로 보호자만 순위에 오르며,
// 공동 순위를 허용하고 지난주 1위에게 왕관을 표시한다.
export function WeeklyRankingModal({
  visible,
  state,
  onClose,
  onRetry,
  members = [],
}: WeeklyRankingModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      {visible ? (
        <Pressable
          accessibilityLabel="랭킹 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        >
          {/* 카드 내부 터치가 배경 닫기로 전파되지 않도록 별도 Pressable로 감싼다. */}
          <Pressable
            accessibilityViewIsModal
            accessible={false}
            onPress={() => {}}
            style={styles.card}
          >
            <View style={styles.header}>
              <Pressable
                accessibilityLabel="뒤로 가기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={styles.backButton}
              >
                <MaterialDesignIcons
                  color={COLORS.textStrong}
                  name="chevron-left"
                  size={24}
                />
              </Pressable>
              <Text style={styles.title}>주간 효자 랭킹</Text>
            </View>

            <WeeklyRankingBody
              members={members}
              onRetry={onRetry}
              state={state}
            />
          </Pressable>
        </Pressable>
      ) : null}
    </Modal>
  );
}

function WeeklyRankingBody({
  state,
  onRetry,
  members,
}: {
  state: WeeklyRankingLoadState;
  onRetry: () => void;
  members: readonly GroupMember[];
}) {
  if (state.status === 'loading') {
    return (
      <View
        accessibilityLabel="랭킹 불러오는 중"
        style={styles.statusBlock}
      >
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
        <Text style={styles.errorText}>{state.message}</Text>
        <Pressable
          accessibilityLabel="다시 시도"
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retryButton}
        >
          <MaterialDesignIcons color={COLORS.text} name="refresh" size={18} />
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const {snapshot} = state;
  const ranked = rankEntries(snapshot.rankings);
  const weekRange = formatWeekRange(snapshot.weekStart, snapshot.weekEnd);

  return (
    <>
      {weekRange ? (
        <View style={styles.weekBlock}>
          <Text style={styles.weekLabel}>이번 주</Text>
          <Text style={styles.weekRange}>{weekRange}</Text>
        </View>
      ) : null}

      {ranked.length > 0 ? (
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        >
          {ranked.map((entry, index) => (
            <View
              accessibilityLabel={`${entry.rank}위 ${entry.displayName}${
                entry.previousWeekWinner ? ', 지난주 1위' : ''
              }`}
              accessible
              key={entry.memberId}
              style={[styles.row, index > 0 && styles.rowDivider]}
            >
              <Text style={styles.rank}>{entry.rank}</Text>
              <View style={styles.avatarWrap}>
                <GroupMemberAvatar
                  member={
                    members.find(
                      member => member.memberId === entry.memberId,
                    ) ?? {
                      avatarText: avatarInitial(entry.displayName),
                      name: entry.displayName,
                      profileImageUrl: null,
                    }
                  }
                />
                {entry.previousWeekWinner ? (
                  <View style={styles.crown}>
                    <MaterialDesignIcons
                      color={COLORS.textStrong}
                      name="crown"
                      size={18}
                    />
                  </View>
                ) : null}
              </View>
              <Text style={styles.name}>{entry.displayName}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>아직 집계된 랭킹이 없어요.</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    height: 40,
    width: 40,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    height: 36,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    width: 36,
    zIndex: 1,
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
    maxHeight: '80%',
    padding: 24,
    width: '100%',
  },
  crown: {
    left: 11,
    position: 'absolute',
    top: -12,
  },
  emptyText: {
    color: COLORS.textSubtle,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 36,
  },
  list: {
    flexGrow: 0,
  },
  name: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '600',
  },
  rank: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    width: 24,
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statusBlock: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 32,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  weekBlock: {
    gap: 4,
  },
  weekLabel: {
    color: COLORS.textSubtle,
    fontSize: 13,
  },
  weekRange: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
});
