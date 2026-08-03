import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
import {Animated, Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

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
  const hasApprovedRequest = visibleRequests.some(
    request => request.status === 'APPROVED',
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
              onPress={() => setCreateGroupVisible(true)}
            />
            <GroupActionCard
              description="받은 코드로 기존 그룹에 들어가요"
              label="코드로 참여"
              onPress={() => setJoinGroupVisible(true)}
            />
          </View>

          {!hasApprovedRequest && (
            <Text style={styles.pendingTitle}>승인 요청 대기</Text>
          )}
          {visibleRequests.length === 0 ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {hasJoinedGroups
                  ? '대기 중인 참여 요청이 없어요\n코드를 입력해 다른 그룹에 참가할 수 있어요'
                  : '아직 참가한 그룹이 없어요\n코드를 입력해서 참가해보세요'}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.pendingList,
                hasApprovedRequest && styles.approvedList,
              ]}>
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
            </View>
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
    <View style={[styles.pendingCard, approved && styles.approvedCard]}>
      <View style={[styles.requestAvatar, approved && styles.approvedAvatar]} />
      <View style={styles.pendingCopy}>
        <Text
          style={[
            styles.pendingGroupName,
            approved && styles.approvedGroupName,
          ]}>
          {request.groupName}
        </Text>
        {approved ? (
          <Text style={styles.approvedDescription}>
            가입이 승인되었어요{'\n'}
            눌러서 입장하기
          </Text>
        ) : (
          <Text style={styles.pendingDescription}>
            참여 요청을 보냈어요{'\n'}
            관리자 승인을 기다리고 있어요
          </Text>
        )}
      </View>
      <MaterialDesignIcons
        color={approved ? '#FFE273' : AUTH_COLORS.body}
        name="chevron-right"
        size={34}
      />
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
  approvedList: {
    marginTop: 58,
  },
  pendingCardContainer: {
    width: '100%',
  },
  pendingCard: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderCurve: 'continuous',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 110,
    paddingHorizontal: 16,
  },
  approvedCard: {
    backgroundColor: AUTH_COLORS.action,
  },
  requestAvatar: {
    backgroundColor: '#D9D9D9',
    borderCurve: 'continuous',
    borderRadius: 30,
    height: 59,
    marginRight: 16,
    width: 59,
  },
  approvedAvatar: {
    backgroundColor: '#FFEB98',
  },
  pendingCopy: {
    flex: 1,
  },
  pendingGroupName: {
    color: AUTH_COLORS.body,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
  },
  approvedGroupName: {
    marginTop: 0,
  },
  approvedDescription: {
    color: AUTH_COLORS.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
  pendingDescription: {
    color: AUTH_COLORS.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
