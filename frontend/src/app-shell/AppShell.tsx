import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../design/tokens';
import type { NotificationDeepLinkTarget } from '../features/notifications/deepLink';
import { useNotificationGateway } from '../features/notifications/NotificationGatewayContext';
import {
  subscribeNativePushReceived,
  type SubscribePushReceived,
} from '../features/notifications/pushReceivedProvider';
import { useHardwareBack } from '../shared/hooks/useHardwareBack';
import { BottomTabBar } from './BottomTabBar';
import { CurrentGroupSwitcher } from './CurrentGroupSwitcher';
import { resolveAllowedRoute, resolveCurrentGroup } from './navigation';
import type {
  AppRoute,
  AppAuthSession,
  AppScreenRegistry,
  CurrentGroupStore,
  FamilyGroup,
  ReportDeepLinkParams,
} from './types';

interface AppShellProps {
  apiBaseUrl?: string;
  authSession?: AppAuthSession;
  accessToken?: string | null;
  currentUserId?: number;
  currentUserName?: string;
  groupStore?: CurrentGroupStore;
  groups: readonly FamilyGroup[];
  initialGroupId?: string | null;
  initialRoute?: AppRoute;
  onCreateGroup?: () => void;
  onGroupChange?: (groupId: string) => void;
  onJoinGroup?: () => void;
  onCallResult?: (status: 'COMPLETED' | 'CANCELLED' | 'FAILED') => void;
  onCurrentGroupChange?: (groupId: string) => void;
  onRequestLogout?: () => void;
  onRequestWithdrawal?: () => Promise<void>;
  screens?: AppScreenRegistry;
  // 푸시 알림 탭 딥링크. requestId가 바뀔 때마다 target으로 이동한다.
  deepLinkTarget?: NotificationDeepLinkTarget | null;
  deepLinkRequestId?: number;
  // 딥링크 소비 직후 호출된다. 부모가 상태를 비워 재마운트 때 재소비되지 않게 한다.
  onDeepLinkConsumed?: () => void;
  // 앱 실행 중 푸시 도착 구독. 테스트에서 네이티브 브리지 없이 주입할 수 있다.
  subscribePushReceived?: SubscribePushReceived;
}

export function AppShell({
  apiBaseUrl,
  authSession,
  accessToken,
  currentUserId,
  currentUserName,
  groupStore,
  groups,
  initialGroupId,
  initialRoute = 'feed',
  onCreateGroup,
  onGroupChange,
  onJoinGroup,
  onCallResult,
  onCurrentGroupChange,
  onRequestLogout,
  onRequestWithdrawal,
  screens = {},
  deepLinkTarget,
  deepLinkRequestId = 0,
  onDeepLinkConsumed,
  subscribePushReceived = subscribeNativePushReceived,
}: AppShellProps) {
  const [activeRoute, setActiveRoute] = useState(initialRoute);
  const [currentGroupId, setCurrentGroupId] = useState(initialGroupId);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [createPostRequestId, setCreatePostRequestId] = useState(0);
  const [createCalendarEventRequestId, setCreateCalendarEventRequestId] =
    useState(0);
  const [isScreenFullscreen, setIsScreenFullscreen] = useState(false);
  const [isScreenHeaderVisible, setIsScreenHeaderVisible] = useState(true);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [openPostRequestId, setOpenPostRequestId] = useState(0);
  const [openCalendarEventId, setOpenCalendarEventId] = useState<string | null>(
    null
  );
  const [openCalendarEventRequestId, setOpenCalendarEventRequestId] =
    useState(0);
  const [openReportTarget, setOpenReportTarget] =
    useState<ReportDeepLinkParams | null>(null);
  const [openReportRequestId, setOpenReportRequestId] = useState(0);
  const [openJoinApprovalRequestId, setOpenJoinApprovalRequestId] = useState(0);
  const [readNotificationIds, setReadNotificationIds] = useState<
    readonly string[]
  >([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  // 활성 탭을 다시 누르면 증가한다. 화면을 재마운트해 최신 데이터를 다시 조회하게 한다.
  const [screenRefreshNonce, setScreenRefreshNonce] = useState(0);
  // 직전 라우트. 알림 화면 복귀 시 배지 재조회를 건너뛰는 판단에 쓴다.
  const previousRouteRef = useRef<AppRoute | null>(null);
  // 푸시 딥링크 소비. 라우팅 함수가 렌더 본문(조기 반환 뒤)에서 정의되므로
  // ref로 최신 참조를 유지하고, 그룹 복원 중에는 소비하지 않고 다음 렌더에 재시도한다.
  const consumedDeepLinkRequestIdRef = useRef(0);
  const openNotificationTargetRef = useRef<
    ((target: NotificationDeepLinkTarget) => void) | null
  >(null);
  useEffect(() => {
    const openTarget = openNotificationTargetRef.current;
    if (
      deepLinkTarget != null &&
      deepLinkRequestId > 0 &&
      deepLinkRequestId !== consumedDeepLinkRequestIdRef.current &&
      openTarget !== null
    ) {
      consumedDeepLinkRequestIdRef.current = deepLinkRequestId;
      openTarget(deepLinkTarget);
      onDeepLinkConsumed?.();
    }
  });
  const [isRestoringGroup, setIsRestoringGroup] = useState(
    Boolean(groupStore && !initialGroupId)
  );

  const currentGroup = resolveCurrentGroup(groups, currentGroupId);
  const currentRole = currentGroup?.role;
  const notificationGateway = useNotificationGateway();
  const resolvedRoute = currentRole
    ? resolveAllowedRoute(currentRole, activeRoute)
    : 'feed';
  // 피드는 홈이므로 뒤로가기를 처리하지 않는다(처리하는 리스너가 없으면 앱이 종료된다).
  // 나머지 라우트는 모두 피드로 복귀한다. 라우트를 열거하지 않아야 화면이 늘어도
  // 목록 갱신을 빠뜨려 앱이 종료되는 일이 생기지 않는다.
  const canReturnToFeed = resolvedRoute !== 'feed';

  useHardwareBack(() => {
    setIsScreenHeaderVisible(true);
    setOpenPostId(null);
    setOpenCalendarEventId(null);
    setOpenReportTarget(null);
    setActiveRoute('feed');
    return true;
  }, canReturnToFeed && !isScreenFullscreen);

  useEffect(() => {
    if (!currentRole) {
      return;
    }

    setActiveRoute(currentRoute =>
      resolveAllowedRoute(currentRole, currentRoute)
    );
  }, [currentRole]);

  useLayoutEffect(() => {
    if (!isRestoringGroup && currentGroup !== null) {
      onCurrentGroupChange?.(currentGroup.id);
    }
  }, [currentGroup, isRestoringGroup, onCurrentGroupChange]);

  useEffect(() => {
    const previousRoute = previousRouteRef.current;
    previousRouteRef.current = resolvedRoute;
    if (notificationGateway === null) {
      setUnreadNotificationCount(0);
      return;
    }

    // 배지는 피드 헤더에서만 표시하므로 피드 진입·재탭 시에만 다시 조회한다.
    // 알림 화면에서 복귀할 때는 화면이 보고한 값을 유지한다(읽음 반영 전 값으로
    // 되돌아가는 경쟁 방지 — 읽음 API가 아직 커밋되기 전일 수 있다).
    if (resolvedRoute !== 'feed' || previousRoute === 'notifications') {
      return;
    }

    let disposed = false;
    notificationGateway
      .getUnreadCount()
      .then(count => {
        if (!disposed) {
          setUnreadNotificationCount(count);
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
    };
  }, [currentUserId, notificationGateway, resolvedRoute, screenRefreshNonce]);

  // 앱 실행 중 푸시가 도착하면 배지를 즉시 갱신한다. 알림 화면에서는 구독하지
  // 않고 화면이 보고한 값을 유지한다. 알림 화면에서 나온 직후 읽음 API 커밋 전에
  // 푸시가 도착하는 좁은 경쟁까지는 막지 않으며, 이때는 다음 조회에서 수렴한다.
  // 연속 푸시는 진행 중 조회 1건 + 후속 조회 1건으로 합쳐 마지막 푸시 이후
  // 값으로 확정한다(응답 역전으로 오래된 값이 남는 것 방지).
  useEffect(() => {
    if (notificationGateway === null || resolvedRoute === 'notifications') {
      return;
    }

    let disposed = false;
    let isFetching = false;
    let hasPendingRefresh = false;
    const refreshUnreadCount = () => {
      if (isFetching) {
        hasPendingRefresh = true;
        return;
      }
      isFetching = true;
      notificationGateway
        .getUnreadCount()
        .then(count => {
          if (!disposed) {
            setUnreadNotificationCount(count);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          isFetching = false;
          if (hasPendingRefresh && !disposed) {
            hasPendingRefresh = false;
            refreshUnreadCount();
          }
        });
    };
    const unsubscribe = subscribePushReceived(refreshUnreadCount);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [notificationGateway, resolvedRoute, subscribePushReceived]);

  useEffect(() => {
    if (initialGroupId || !groupStore) {
      setIsRestoringGroup(false);
      return;
    }

    let isMounted = true;
    setIsRestoringGroup(true);

    groupStore
      .load()
      .then(savedGroupId => {
        if (isMounted && savedGroupId) {
          setCurrentGroupId(savedGroupId);
        }
      })
      .catch(() => {
        // 최근 그룹 복원 실패는 첫 사용 가능한 그룹으로 안전하게 대체한다.
      })
      .finally(() => {
        if (isMounted) {
          setIsRestoringGroup(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [groupStore, initialGroupId]);

  // 상위 앱이 그룹 탈퇴·삭제 후 선택한 다음 그룹을 전달하면 현재 그룹도 동기화한다.
  useEffect(() => {
    const currentGroupStillExists = groups.some(
      group => group.id === currentGroupId,
    );
    const initialGroupStillExists = groups.some(
      group => group.id === initialGroupId,
    );

    // The parent updates initialGroupId after the selected group is removed.
    // Do not treat it as a controlled value during ordinary group switching.
    if (
      !currentGroupStillExists &&
      initialGroupId !== undefined &&
      initialGroupId !== currentGroupId &&
      initialGroupStillExists
    ) {
      setCurrentGroupId(initialGroupId);
      // 삭제·탈퇴한 그룹의 하위 화면을 다음 그룹에 그대로 보여주면 삭제된
      // 그룹 정보가 남은 것처럼 보인다. 대체 그룹은 피드에서 새로 시작한다.
      setActiveRoute('feed');
      setIsScreenFullscreen(false);
      setIsScreenHeaderVisible(true);
      setIsGroupMenuOpen(false);
      setOpenPostId(null);
      setOpenPostRequestId(0);
      setOpenCalendarEventId(null);
      setOpenReportTarget(null);
    }
  }, [currentGroupId, groups, initialGroupId]);

  if (isRestoringGroup) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text accessibilityRole="text" style={styles.emptyDescription}>
          최근 이용 그룹을 불러오고 있어요.
        </Text>
      </SafeAreaView>
    );
  }

  if (!currentGroup) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>참여 중인 그룹이 없어요</Text>
        <Text style={styles.emptyDescription}>
          그룹을 만들거나 초대 코드로 가입을 요청해 주세요.
        </Text>
        <View style={styles.emptyActions}>
          <Pressable
            accessibilityRole="button"
            disabled={!onCreateGroup}
            onPress={onCreateGroup}
            style={[
              styles.primaryAction,
              !onCreateGroup && styles.disabledAction,
            ]}
          >
            <Text style={styles.primaryActionText}>그룹 만들기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!onJoinGroup}
            onPress={onJoinGroup}
            style={[
              styles.secondaryAction,
              !onJoinGroup && styles.disabledAction,
            ]}
          >
            <Text style={styles.secondaryActionText}>초대 코드 입력</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const Screen = screens[resolvedRoute];

  const handleGroupSelect = (groupId: string) => {
    setCurrentGroupId(groupId);
    onCurrentGroupChange?.(groupId);
    setOpenPostId(null);
    setOpenPostRequestId(0);
    setOpenCalendarEventId(null);
    setOpenReportTarget(null);
    setIsGroupMenuOpen(false);
    onGroupChange?.(groupId);
    if (groupStore) {
      groupStore.save(groupId).catch(() => {
        // 화면 전환은 유지하고 영속화 오류 처리는 상위 앱 계층에 위임한다.
      });
    }
  };

  const handleNotificationRead = (notificationId: string) => {
    setReadNotificationIds(current =>
      current.includes(notificationId) ? current : [...current, notificationId]
    );
  };

  const handleOpenPost = (postId: string, groupId?: string) => {
    if (
      groupId &&
      groupId !== currentGroup.id &&
      groups.some(group => group.id === groupId)
    ) {
      handleGroupSelect(groupId);
    }
    setOpenPostId(postId);
    setOpenPostRequestId(requestId => requestId + 1);
    setIsScreenHeaderVisible(true);
    setActiveRoute('feed');
  };

  const handleOpenNotificationTarget = (target: NotificationDeepLinkTarget) => {
    if (target.kind === 'post') {
      handleOpenPost(target.postId, target.groupId);
      return;
    }
    if (target.kind === 'notifications') {
      setIsScreenHeaderVisible(true);
      setActiveRoute('notifications');
      return;
    }
    if (
      target.groupId &&
      target.groupId !== currentGroup.id &&
      groups.some(group => group.id === target.groupId)
    ) {
      handleGroupSelect(target.groupId);
    }
    setIsScreenHeaderVisible(true);
    if (target.kind === 'calendarEvent') {
      setOpenCalendarEventId(target.eventId);
      setOpenCalendarEventRequestId(requestId => requestId + 1);
      setActiveRoute('calendar');
      return;
    }
    if (target.kind === 'callReport' || target.kind === 'dailyReport') {
      setOpenReportTarget({
        ...(target.kind === 'callReport'
          ? {callSessionId: target.callSessionId}
          : {}),
        memberId: target.memberId,
        reportDate: target.reportDate,
      });
      setOpenReportRequestId(requestId => requestId + 1);
      setActiveRoute('report');
      return;
    }
    setOpenJoinApprovalRequestId(requestId => requestId + 1);
    setActiveRoute('groupInfo');
  };
  openNotificationTargetRef.current = handleOpenNotificationTarget;

  return (
    <SafeAreaView style={styles.safeArea}>
      {!isScreenFullscreen &&
      isScreenHeaderVisible &&
      resolvedRoute !== 'notifications' &&
      resolvedRoute !== 'archive' &&
      resolvedRoute !== 'groupInfo' &&
      resolvedRoute !== 'profile' ? (
        <View style={styles.header} testID="app-shell-header">
          {resolvedRoute === 'calendar' ? (
            <View style={styles.headerSide} />
          ) : resolvedRoute === 'feed' ? (
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="게시글 보관함"
                accessibilityRole="button"
                onPress={() => setActiveRoute('archive')}
                style={styles.headerIconButton}
              >
                <MaterialDesignIcons
                  color={COLORS.textStrong}
                  name="folder"
                  size={27}
                />
              </Pressable>
            </View>
          ) : (
            <View style={styles.headerSide} />
          )}
          {resolvedRoute === 'calendar' ? (
            <Pressable
              accessibilityLabel="일정 추가"
              accessibilityRole="button"
              onPress={() =>
                setCreateCalendarEventRequestId(requestId => requestId + 1)
              }
              style={({ pressed }) => [
                styles.calendarAddButton,
                pressed && styles.calendarAddButtonPressed,
              ]}
            >
              <MaterialDesignIcons
                color={COLORS.purpleDeep}
                name="calendar-plus"
                size={26}
              />
            </Pressable>
          ) : (
            <CurrentGroupSwitcher
              currentGroup={currentGroup}
              groups={groups}
              isOpen={isGroupMenuOpen}
              onClose={() => setIsGroupMenuOpen(false)}
              onCreateGroup={onCreateGroup}
              onJoinGroup={onJoinGroup}
              onSelect={handleGroupSelect}
              onToggle={() => setIsGroupMenuOpen(isOpen => !isOpen)}
            />
          )}
          {resolvedRoute === 'calendar' ? (
            <View style={styles.headerCenterAbsolute}>
              <CurrentGroupSwitcher
                currentGroup={currentGroup}
                groups={groups}
                isOpen={isGroupMenuOpen}
                onClose={() => setIsGroupMenuOpen(false)}
                onCreateGroup={onCreateGroup}
                onJoinGroup={onJoinGroup}
                onSelect={handleGroupSelect}
                onToggle={() => setIsGroupMenuOpen(isOpen => !isOpen)}
              />
            </View>
          ) : resolvedRoute === 'feed' ? (
            <Pressable
              accessibilityLabel="알림"
              accessibilityRole="button"
              onPress={() => setActiveRoute('notifications')}
              style={styles.headerSide}
            >
              <MaterialDesignIcons
                color={COLORS.textStrong}
                name="bell"
                size={28}
              />
              {unreadNotificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotificationCount > 99
                      ? '99+'
                      : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <View style={styles.headerSide} />
          )}
        </View>
      ) : null}

      <View style={styles.content}>
        {Screen ? (
          <Screen
            key={`${resolvedRoute}:${screenRefreshNonce}`}
            apiBaseUrl={apiBaseUrl}
            authSession={authSession}
            accessToken={accessToken}
            createCalendarEventRequestId={createCalendarEventRequestId}
            createPostRequestId={createPostRequestId}
            currentGroup={currentGroup}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onCloseArchive={() => setActiveRoute('feed')}
            onCloseNotifications={() => setActiveRoute('feed')}
            onCloseProfile={() => setActiveRoute('feed')}
            onCallResult={onCallResult}
            onFullscreenChange={setIsScreenFullscreen}
            onHeaderVisibilityChange={setIsScreenHeaderVisible}
            onNotificationRead={handleNotificationRead}
            onUnreadCountChange={setUnreadNotificationCount}
            onOpenNotifications={() => setActiveRoute('notifications')}
            onOpenNotificationTarget={handleOpenNotificationTarget}
            onOpenPost={handleOpenPost}
            onRequestLogout={onRequestLogout}
            onRequestWithdrawal={onRequestWithdrawal}
            openCalendarEventId={openCalendarEventId}
            openCalendarEventRequestId={openCalendarEventRequestId}
            openJoinApprovalRequestId={openJoinApprovalRequestId}
            openPostId={openPostId}
            openPostRequestId={openPostRequestId}
            openReportRequestId={openReportRequestId}
            openReportTarget={openReportTarget}
            readNotificationIds={readNotificationIds}
            role={currentGroup.role}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>
              {getPlaceholderTitle(resolvedRoute)}
            </Text>
            <Text style={styles.placeholderDescription}>
              담당 기능 화면이 연결될 예정입니다.
            </Text>
          </View>
        )}
        {resolvedRoute === 'feed' &&
        !isScreenFullscreen &&
        isScreenHeaderVisible ? (
          <Pressable
            accessibilityLabel="새 게시글 작성"
            accessibilityRole="button"
            onPress={() => setCreatePostRequestId(requestId => requestId + 1)}
            style={({ pressed }) => [
              styles.feedFab,
              pressed && styles.feedFabPressed,
            ]}
          >
            <MaterialDesignIcons
              color={COLORS.background}
              name="plus"
              size={32}
            />
          </Pressable>
        ) : null}
      </View>

      {!isScreenFullscreen ? (
        <BottomTabBar
          activeRoute={resolvedRoute === 'archive' ? 'feed' : resolvedRoute}
          onSelect={route => {
            if (route === resolvedRoute && route === 'aiCall') {
              return;
            }
            setIsScreenHeaderVisible(true);
            setOpenPostId(null);
            setOpenCalendarEventId(null);
            setOpenReportTarget(null);
            // 같은 화면의 탭을 다시 누르면 재마운트해 최신 데이터를 다시 조회한다.
            // 아카이브처럼 탭과 화면이 다른 상태에서는 일반 이동으로 처리한다.
            if (route === resolvedRoute) {
              // AI 전화는 재마운트하면 네이티브 통화 선택 상태를 잃으므로 제외한다.
              if (route !== 'aiCall') {
                setScreenRefreshNonce(nonce => nonce + 1);
              }
              return;
            }
            setActiveRoute(route);
          }}
          role={currentGroup.role}
        />
      ) : null}
    </SafeAreaView>
  );
}

function getPlaceholderTitle(route: AppRoute): string {
  const titles: Record<AppRoute, string> = {
    aiCall: 'AI 전화',
    calendar: '일정',
    feed: '피드',
    groupInfo: '그룹정보',
    profile: '프로필',
    report: '리포트',
    notifications: '알림',
    archive: '보관함',
  };

  return titles[route];
}

const styles = StyleSheet.create({
  calendarAddButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  calendarAddButtonPressed: {
    opacity: 0.72,
  },
  content: {
    flex: 1,
  },
  feedFab: {
    alignItems: 'center',
    backgroundColor: COLORS.purple,
    borderRadius: 30,
    bottom: 24,
    elevation: 6,
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: COLORS.textStrong,
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: 60,
  },
  feedFabPressed: {
    opacity: 0.85,
  },
  emptyContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyDescription: {
    color: '#737373',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: 24,
    width: '100%',
  },
  emptyTitle: {
    color: '#292929',
    fontSize: 20,
    fontWeight: '700',
  },
  disabledAction: {
    opacity: 0.45,
  },
  header: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 16,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    width: 80,
  },
  headerCenterAbsolute: {
    alignItems: 'center',
    bottom: 8,
    justifyContent: 'center',
    left: 80,
    position: 'absolute',
    right: 80,
    top: 8,
  },
  headerIconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 40,
  },
  headerSide: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 80,
  },
  notificationBadge: {
    alignItems: 'center',
    backgroundColor: '#D92D20',
    borderColor: COLORS.background,
    borderRadius: 9,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    position: 'absolute',
    right: 5,
    top: 2,
  },
  notificationBadgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  placeholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  placeholderDescription: {
    color: '#8A8A8A',
    fontSize: 15,
    marginTop: 8,
  },
  placeholderTitle: {
    color: '#34312F',
    fontSize: 24,
    fontWeight: '700',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#6F6B68',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: '#D6D6D6',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: '#525252',
    fontSize: 16,
    fontWeight: '700',
  },
});
