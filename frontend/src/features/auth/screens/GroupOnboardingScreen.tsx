import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {COLORS} from '../../../design/tokens';
import {AppText} from '../../../shared/components/AppText';
import {useHardwareBack} from '../../../shared/hooks/useHardwareBack';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {
  CreateGroupSheet,
  type CreateGroupInput,
} from '../components/CreateGroupSheet';
import {JoinGroupSheet} from '../components/JoinGroupSheet';
import {useScreenEntrance} from '../hooks/useScreenEntrance';
import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';

const FAMILINK_LOGO = require('../../../assets/images/familink-logo.png');

interface JoinRequestBase {
  groupName: string;
  id: string;
}

export interface ApprovedJoinRequest extends JoinRequestBase {
  groupId: string;
  myMemberId: string;
  role: CreateGroupInput['role'];
  status: 'APPROVED';
}

interface UnapprovedJoinRequest extends JoinRequestBase {
  groupId?: string;
  role?: CreateGroupInput['role'];
  status?: 'PENDING_ADMIN' | 'REJECTED';
}

export type PendingJoinRequest =
  | ApprovedJoinRequest
  | UnapprovedJoinRequest;

interface GroupOnboardingScreenProps {
  // 그룹 전환에서 진입한 그룹 보유 사용자인지. 빈 상태 문구를 상황에 맞게 바꾼다.
  hasJoinedGroups?: boolean;
  initialAction?: 'create' | 'join' | null;
  onBack: () => void;
  onCreateGroup: (
    input: CreateGroupInput,
    signal: AbortSignal,
  ) => Promise<void> | void;
  onJoinByCode: (
    inviteCode: string,
    signal: AbortSignal,
  ) => Promise<void> | void;
  onOpenApprovedGroup?: (request: ApprovedJoinRequest) => void;
  pendingRequests: readonly PendingJoinRequest[];
}

export function GroupOnboardingScreen({
  hasJoinedGroups = false,
  initialAction = null,
  onBack,
  onCreateGroup,
  onJoinByCode,
  onOpenApprovedGroup,
  pendingRequests,
}: GroupOnboardingScreenProps) {
  const entranceStyle = useScreenEntrance('group-onboarding');
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [joinGroupVisible, setJoinGroupVisible] = useState(false);
  const completedActionRef = useRef<'create' | 'join' | null>(null);

  useEffect(() => {
    if (initialAction === 'create') {
      completedActionRef.current = null;
      setCreateGroupVisible(true);
    }
    if (initialAction === 'join') {
      completedActionRef.current = null;
      setJoinGroupVisible(true);
    }
  }, [initialAction]);

  useHardwareBack(() => {
    onBack();
    return true;
  });
  const visibleRequests = pendingRequests.filter(
    request => request.status !== 'REJECTED',
  );

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
                color={COLORS.purpleDeep}
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
          <AppText style={styles.title}>{'가족과\n연결해볼까요?'}</AppText>

          <View style={styles.options}>
            <GroupActionCard
              description="우리 가족만의 공간을 시작해요"
              label="새 그룹 만들기"
              onPress={() => setCreateGroupVisible(true)}
            />
            <GroupActionCard
              description="받은 코드로 기존 그룹에 참여해요"
              label="코드로 참여"
              onPress={() => setJoinGroupVisible(true)}
            />
          </View>

          <AppText style={styles.pendingTitle}>승인 요청 대기</AppText>
          {visibleRequests.length === 0 ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.emptyState}>
              <AppText style={styles.emptyText}>
                {hasJoinedGroups
                  ? '대기 중인 참여 요청이 없어요\n코드를 입력해 다른 그룹에 참가할 수 있어요'
                  : '아직 참가한 그룹이 없어요\n코드를 입력해서 참가해보세요'}
              </AppText>
            </View>
          ) : (
            <ScrollView
              accessibilityLabel="승인 요청 목록"
              contentContainerStyle={styles.pendingList}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.pendingScroller}
              testID="join-request-carousel">
              {visibleRequests.map(request => {
                const approved = request.status === 'APPROVED';

                return (
                  <JoinRequestCard
                    approved={approved}
                    key={request.id}
                    onPress={
                      request.status === 'APPROVED' &&
                      onOpenApprovedGroup !== undefined
                        ? () => onOpenApprovedGroup(request)
                        : undefined
                    }
                    request={request}
                  />
                );
              })}
            </ScrollView>
          )}
        </ScrollView>

        <CreateGroupSheet
          onDismiss={() => {
            setCreateGroupVisible(false);
            if (
              initialAction === 'create' &&
              completedActionRef.current !== 'create'
            ) {
              onBack();
            }
            completedActionRef.current = null;
          }}
          onSubmit={async (input, signal) => {
            await onCreateGroup(input, signal);
            completedActionRef.current = 'create';
          }}
          visible={createGroupVisible}
        />
        <JoinGroupSheet
          onDismiss={() => {
            setJoinGroupVisible(false);
            if (
              initialAction === 'join' &&
              completedActionRef.current !== 'join'
            ) {
              onBack();
            }
            completedActionRef.current = null;
          }}
          onSubmit={async (inviteCode, signal) => {
            await onJoinByCode(inviteCode, signal);
            completedActionRef.current = 'join';
          }}
          visible={joinGroupVisible}
        />
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
        <View style={styles.optionCopy}>
          <AppText style={styles.optionLabel}>{label}</AppText>
          <AppText style={styles.optionDescription}>{description}</AppText>
        </View>
        <View style={styles.optionArrow}>
          <MaterialDesignIcons
            color={AUTH_COLORS.background}
            name="arrow-right"
            size={22}
          />
        </View>
      </View>
    </AnimatedPressable>
  );
}

interface JoinRequestCardProps {
  approved: boolean;
  onPress?: () => void;
  request: PendingJoinRequest;
}

function JoinRequestCard({
  approved,
  onPress,
  request,
}: JoinRequestCardProps) {
  const content = (
    <View
      accessible={onPress === undefined}
      accessibilityLabel={
        onPress === undefined
          ? `${request.groupName}, ${approved ? '환영해요!' : '대기 중'}`
          : undefined
      }
      style={[styles.pendingCard, approved && styles.approvedCard]}
      testID={`join-request-card-${request.id}`}>
      <View style={styles.requestNameArea}>
        <AppText
          numberOfLines={2}
          style={[
            styles.pendingGroupName,
            approved && styles.approvedGroupName,
          ]}>
          {request.groupName}
        </AppText>
      </View>
      <MaterialDesignIcons
        color={approved ? AUTH_COLORS.black : AUTH_COLORS.muted}
        name={approved ? 'check-circle-outline' : 'clock-outline'}
        size={34}
        style={styles.requestStatusIcon}
      />
      <AppText
        style={[
          styles.requestStatusText,
          approved && styles.approvedStatusText,
        ]}>
        {approved ? '환영해요!' : '대기 중'}
      </AppText>
    </View>
  );

  if (onPress === undefined) {
    return content;
  }

  return (
    <AnimatedPressable
      accessibilityHint="승인된 가족 그룹으로 이동합니다"
      accessibilityLabel={`${request.groupName} 열기`}
      accessibilityRole="button"
      containerStyle={styles.pendingCardContainer}
      onPress={onPress}>
      {content}
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
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  logo: {
    height: 120,
    width: 120,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
  },
  title: {
    color: AUTH_COLORS.black,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 38,
    marginLeft: 6,
  },
  options: {
    gap: 7,
    marginTop: 30,
  },
  optionContainer: {
    width: '100%',
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.surfaceTint,
    borderCurve: 'continuous',
    borderRadius: 20,
    flexDirection: 'row',
    height: 129,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  optionCopy: {
    alignSelf: 'stretch',
    flex: 1,
    paddingTop: 21,
  },
  optionLabel: {
    color: AUTH_COLORS.black,
    fontSize: 27,
    fontWeight: '600',
    lineHeight: 36,
  },
  optionDescription: {
    color: AUTH_COLORS.black,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 17,
  },
  optionArrow: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.black,
    borderCurve: 'continuous',
    borderRadius: 16,
    bottom: 29,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    width: 32,
  },
  pendingTitle: {
    color: AUTH_COLORS.black,
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    marginLeft: 5,
    marginTop: 43,
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
    gap: 13,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
  },
  pendingScroller: {
    marginHorizontal: -AUTH_LAYOUT.horizontalPadding,
    marginTop: 8,
  },
  pendingCardContainer: {
    width: 114,
  },
  pendingCard: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderCurve: 'continuous',
    borderRadius: 25,
    height: 138,
    paddingBottom: 11,
    paddingHorizontal: 8,
    paddingTop: 11,
    width: 114,
  },
  approvedCard: {
    backgroundColor: AUTH_COLORS.action,
  },
  requestNameArea: {
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
    width: 98,
  },
  pendingGroupName: {
    color: '#6A6A6A',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'center',
  },
  approvedGroupName: {
    color: AUTH_COLORS.black,
    fontSize: 20,
    lineHeight: 26,
  },
  requestStatusIcon: {
    marginTop: 4,
  },
  requestStatusText: {
    color: '#6A6A6A',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 2,
    textAlign: 'center',
  },
  approvedStatusText: {
    color: AUTH_COLORS.black,
  },
});
