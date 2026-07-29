import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Animated, Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {AnimatedPressable} from '../components/AnimatedPressable';
import {useScreenEntrance} from '../hooks/useScreenEntrance';
import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';

const FAMILINK_LOGO = require('../../../assets/images/familink-logo.png');

export interface PendingJoinRequest {
  groupName: string;
  id: string;
}

interface GroupOnboardingScreenProps {
  onBack: () => void;
  onCreateGroup: () => void;
  onJoinByCode: () => void;
  pendingRequests: readonly PendingJoinRequest[];
}

export function GroupOnboardingScreen({
  onBack,
  onCreateGroup,
  onJoinByCode,
  pendingRequests,
}: GroupOnboardingScreenProps) {
  const entranceStyle = useScreenEntrance('group-onboarding');

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.flex, entranceStyle]}>
        <View style={styles.header}>
          <AnimatedPressable
            accessibilityLabel="A-10으로 돌아가기"
            accessibilityRole="button"
            containerStyle={styles.backButtonContainer}
            hitSlop={8}
            onPress={onBack}>
            <View style={styles.backButton}>
              <MaterialDesignIcons
                color={AUTH_COLORS.background}
                name="chevron-left"
                size={28}
              />
            </View>
          </AnimatedPressable>
          <Image
            accessibilityLabel="Familink"
            resizeMode="contain"
            source={FAMILINK_LOGO}
            style={styles.logo}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{'가족과\n연결해볼까요?'}</Text>

          <View style={styles.options}>
            <GroupActionCard
              description="우리 가족만의 공간을 시작해요"
              label="새 그룹 만들기"
              onPress={onCreateGroup}
            />
            <GroupActionCard
              description="받은 코드로 기존 그룹에 들어가요"
              label="코드로 참여"
              onPress={onJoinByCode}
            />
          </View>

          <Text style={styles.pendingTitle}>승인 요청 대기</Text>
          {pendingRequests.length === 0 ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.emptyState}>
              <Text style={styles.emptyText}>
                아직 참가한 그룹이 없어요{'\n'}
                코드를 입력해서 참가해보세요
              </Text>
            </View>
          ) : (
            <View style={styles.pendingList}>
              {pendingRequests.map(request => (
                <View key={request.id} style={styles.pendingCard}>
                  <View style={styles.pendingCopy}>
                    <Text style={styles.pendingGroupName}>
                      {request.groupName}
                    </Text>
                    <Text style={styles.pendingDescription}>
                      관리자 승인을 기다리고 있어요
                    </Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>대기 중</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

interface GroupActionCardProps {
  description: string;
  label: string;
  onPress: () => void;
}

function GroupActionCard({
  description,
  label,
  onPress,
}: GroupActionCardProps) {
  return (
    <AnimatedPressable
      accessibilityHint={description}
      accessibilityRole="button"
      containerStyle={styles.optionContainer}
      onPress={onPress}>
      <View style={styles.optionCard}>
        <View>
          <Text style={styles.optionLabel}>{label}</Text>
          <Text style={styles.optionDescription}>{description}</Text>
        </View>
        <View style={styles.optionArrow}>
          <MaterialDesignIcons
            color={AUTH_COLORS.background}
            name="arrow-right"
            size={28}
          />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: AUTH_COLORS.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    height: 90,
    justifyContent: 'center',
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
  },
  backButtonContainer: {
    left: AUTH_LAYOUT.horizontalPadding,
    position: 'absolute',
    zIndex: 1,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  logo: {
    height: 120,
    width: 120,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding + 16,
  },
  title: {
    color: AUTH_COLORS.body,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 42,
  },
  options: {
    gap: 10,
    marginTop: 20,
  },
  optionContainer: {
    width: '100%',
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.surfaceTint,
    borderRadius: 20,
    flexDirection: 'row',
    height: 129,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  optionLabel: {
    color: AUTH_COLORS.body,
    fontSize: 25,
    fontWeight: '700',
    lineHeight: 34,
  },
  optionDescription: {
    color: '#666B7D',
    fontSize: 14,
    lineHeight: 22,
  },
  optionArrow: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.primarySoft,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  pendingTitle: {
    color: AUTH_COLORS.body,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 54,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 150,
  },
  emptyText: {
    color: AUTH_COLORS.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pendingList: {
    gap: 10,
    marginTop: 18,
  },
  pendingCard: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.surface,
    borderColor: AUTH_COLORS.hairline,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 88,
    paddingHorizontal: 18,
  },
  pendingCopy: {
    flex: 1,
  },
  pendingGroupName: {
    color: AUTH_COLORS.body,
    fontSize: 17,
    fontWeight: '700',
  },
  pendingDescription: {
    color: AUTH_COLORS.muted,
    fontSize: 13,
    marginTop: 5,
  },
  pendingBadge: {
    backgroundColor: AUTH_COLORS.primarySoft,
    borderRadius: 14,
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pendingBadgeText: {
    color: AUTH_COLORS.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
  },
});
