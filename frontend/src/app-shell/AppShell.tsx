import { useEffect, useRef, useState } from 'react';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../design/tokens';
import { useNotificationGateway } from '../features/notifications/NotificationGatewayContext';
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
  onRequestLogout?: () => void;
  onRequestWithdrawal?: () => Promise<void>;
  screens?: AppScreenRegistry;
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
  onRequestLogout,
  onRequestWithdrawal,
  screens = {},
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
  const [readNotificationIds, setReadNotificationIds] = useState<
    readonly string[]
  >([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  // 활성 탭을 다시 누르면 증가한다. 화면을 재마운트해 최신 데이터를 다시 조회하게 한다.
  const [screenRefreshNonce, setScreenRefreshNonce] = useState(0);
  // 직전 라우트. 알림 화면 복귀 시 배지 재조회를 건너뛰는 판단에 쓴다.
  const previousRouteRef = useRef<AppRoute | null>(null);
  const [isRestoringGroup, setIsRestoringGroup] = useState(
    Boolean(groupStore && !initialGroupId)
  );

  const currentGroup = resolveCurrentGroup(groups, currentGroupId);
  const currentRole = currentGroup?.role;
  const notificationGateway = useNotificationGateway();
  const resolvedRoute = currentRole
    ? resolveAllowedRoute(currentRole, activeRoute)
    : 'feed';
  const canReturnToFeed =
    resolvedRoute === 'archive' ||
    resolvedRoute === 'notifications' ||
    resolvedRoute === 'profile';

  useHardwareBack(() => {
    setIsScreenHeaderVisible(true);
    setOpenPostId(null);
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
    setOpenPostId(null);
    setOpenPostRequestId(0);
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
              <Pressable
                accessibilityLabel="새 게시글 작성"
                accessibilityRole="button"
                onPress={() =>
                  setCreatePostRequestId(requestId => requestId + 1)
                }
                style={styles.headerIconButton}
              >
                <MaterialDesignIcons
                  color={COLORS.textStrong}
                  name="plus"
                  size={29}
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
            onOpenPost={handleOpenPost}
            onRequestLogout={onRequestLogout}
            onRequestWithdrawal={onRequestWithdrawal}
            openPostId={openPostId}
            openPostRequestId={openPostRequestId}
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
      </View>

      {!isScreenFullscreen ? (
        <BottomTabBar
          activeRoute={resolvedRoute === 'archive' ? 'feed' : resolvedRoute}
          onSelect={route => {
            setIsScreenHeaderVisible(true);
            setOpenPostId(null);
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
