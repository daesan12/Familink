import BellOff from 'lucide-react-native/icons/bell-off';
import Trash2 from 'lucide-react-native/icons/trash-2';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import type {AppScreenProps, GroupRole} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {AppText} from '../../../shared/components/AppText';
import {BackButton} from '../../../shared/components/BackButton';
import {NoticeBanner} from '../../../shared/components/NoticeBanner';
import {
  processJoinRequest as processJoinRequestApi,
  type JoinRequestProcessor,
} from '../../group-info/api/groupMembershipApi';
import {
  isJoinRequestAlreadyProcessed,
  joinRequestDecisionErrorMessage,
} from '../../group-info/joinRequestModel';
import {resolveNotificationTarget} from '../deepLink';
import {NotificationDecisionModal} from '../components/NotificationDecisionModal';
import {NotificationItem} from '../components/NotificationItem';
import {DEVELOPMENT_NOTIFICATIONS} from '../fixtures/notificationFixtures';
import {useNotificationGateway} from '../NotificationGatewayContext';
import {
  subscribeNativePushReceived,
  type SubscribePushReceived,
} from '../pushReceivedProvider';
import type {
  AppNotification,
  NotificationGateway,
  NotificationJoinRequestStatus,
} from '../types';

export interface NotificationsScreenProps extends AppScreenProps {
  gateway?: NotificationGateway;
  initialNotifications?: readonly AppNotification[];
  // 가입 요청 승인·거절 커맨드 주입(테스트용). 없으면 API-GROUPS-009를 호출한다.
  processJoinRequest?: JoinRequestProcessor;
  // 앱 실행 중 푸시 도착 구독. 테스트에서 네이티브 브리지 없이 주입할 수 있다.
  subscribePushReceived?: SubscribePushReceived;
}
const NO_READ_IDS: readonly string[] = [];
// 알림 탭은 알림 목록만 담당한다. 알림 설정(I-6)은 마이페이지에서 진입한다.
export function NotificationsScreen({
  currentUserId,
  gateway,
  initialNotifications,
  onCloseNotifications,
  onNotificationRead,
  onUnreadCountChange,
  onOpenNotificationTarget,
  onOpenPost,
  processJoinRequest,
  readNotificationIds = NO_READ_IDS,
  subscribePushReceived = subscribeNativePushReceived,
}: NotificationsScreenProps) {
  const contextGateway = useNotificationGateway();
  const resolvedGateway = gateway ?? contextGateway;
  const usesInjectedNotifications = initialNotifications !== undefined;
  const [notifications, setNotifications] = useState(() => {
    const source =
      initialNotifications ??
      (resolvedGateway === null && __DEV__ ? DEVELOPMENT_NOTIFICATIONS : []);
    if (readNotificationIds.length === 0) {
      return source;
    }
    // 화면을 벗어났다 돌아와도 읽음 상태가 유지되도록 상위에 보존된 읽음 id를 덮어쓴다.
    return source.map(notification =>
      notification.isRead || readNotificationIds.includes(notification.id)
        ? {...notification, isRead: true}
      : notification,
    );
  });
  const [isLoading, setIsLoading] = useState(
    resolvedGateway !== null && !usesInjectedNotifications,
  );
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(0);
  const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteAllArmed, setDeleteAllArmed] = useState(false);
  const deleteAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteAnimationTimersRef = useRef<
    ReturnType<typeof setTimeout>[]
  >([]);
  // 초기 조회 경로를 다시 실행하는 트리거. 목록 조회가 실패한 상태에서 푸시가
  // 도착하면 증분 병합 대신 이 값을 올려 절대값으로 복구한다.
  const [reloadNonce, setReloadNonce] = useState(0);
  const loadingPageRef = useRef(false);
  const generationRef = useRef(0);
  const readNotificationIdsRef = useRef(readNotificationIds);
  const [decision, setDecision] = useState<{
    applicantName: string | null;
    id: string;
    mode: 'approve' | 'reject';
  } | null>(null);
  const [processingDecisionId, setProcessingDecisionId] = useState<
    string | null
  >(null);
  const unreadCount = useMemo(
    () => notifications.filter(notification => !notification.isRead).length,
    [notifications],
  );
  const displayedUnreadCount = serverUnreadCount ?? unreadCount;
  useEffect(() => {
    readNotificationIdsRef.current = readNotificationIds;
  }, [readNotificationIds]);
  const notificationsRef = useRef(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);
  // 초기 조회가 진행 중인지의 동기 신호. isLoading 상태는 effect로만 미러링하면
  // 늦게 반영되므로 푸시 병합이 초기 조회와 겹치는지 판정할 때는 이 ref를 쓴다.
  const isInitialLoadingRef = useRef(false);
  // 푸시 병합에서 실제로 삽입한 미읽음 개수. 목록 업데이터가 기록하고 같은
  // 배치의 카운트 업데이터가 읽는다(hook 선언 순서상 목록 업데이터가 먼저 실행).
  const pendingUnreadDeltaRef = useRef(0);
  // 초기 조회 중 푸시가 도착한 흔적. 초기 조회 응답이 새 알림 생성보다 먼저
  // 만들어졌을 수 있으므로, 조회 완료 후 아래 병합 함수를 한 번 흘려준다.
  const pendingMergeAfterInitialLoadRef = useRef(false);
  const mergeFreshNotificationsRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    return () => {
      if (deleteAllTimerRef.current !== null) {
        clearTimeout(deleteAllTimerRef.current);
      }
      deleteAnimationTimersRef.current.forEach(clearTimeout);
      deleteAnimationTimersRef.current = [];
    };
  }, []);
  // 마지막 초기 조회에서 목록(page 0)을 성공적으로 받았는지. 실패했다면 목록과
  // serverUnreadCount가 같은 스냅샷이 아니어서 증분 병합의 전제가 깨진 상태다.
  const hasLoadedInitialPageRef = useRef(false);
  useEffect(() => {
    onUnreadCountChange?.(displayedUnreadCount);
  }, [displayedUnreadCount, onUnreadCountChange]);
  useEffect(() => {
    if (resolvedGateway === null || usesInjectedNotifications) {
      setIsLoading(false);
      setServerUnreadCount(null);
      return;
    }
    const generation = ++generationRef.current;
    let disposed = false;
    loadingPageRef.current = false;
    isInitialLoadingRef.current = true;
    // 이 조회가 시작되기 전에 도착한 푸시는 이 조회의 응답이 포함하므로 버린다.
    pendingMergeAfterInitialLoadRef.current = false;
    setIsLoading(true);
    setErrorMessage(null);
    setPage(0);
    setHasNext(false);
    setNotifications([]);
    // 사용자·게이트웨이 전환 시 이전 세대의 badge 값이 남지 않게 초기화한다.
    setServerUnreadCount(null);
    // 목록과 badge를 독립 처리해 unread-count 한 건의 실패가 목록까지 지우지 않게 한다.
    void Promise.allSettled([
      resolvedGateway.loadPage(0),
      resolvedGateway.getUnreadCount(),
    ]).then(([pageResult, countResult]) => {
      if (disposed || generationRef.current !== generation) {
        return;
      }
      hasLoadedInitialPageRef.current = pageResult.status === 'fulfilled';
      if (pageResult.status === 'fulfilled') {
        setNotifications(
          applyReadIds(
            pageResult.value.notifications,
            readNotificationIdsRef.current,
          ),
        );
        setHasNext(pageResult.value.hasNext);
      } else {
        setErrorMessage(toNotificationErrorMessage(pageResult.reason));
      }
      // badge 실패 시 serverUnreadCount는 null로 남아 목록 기준 개수로 대체된다.
      if (countResult.status === 'fulfilled') {
        setServerUnreadCount(countResult.value);
      }
      isInitialLoadingRef.current = false;
      setIsLoading(false);
      // 조회 중 도착한 푸시가 있으면 한 번 병합해, 이 조회의 서버 스냅샷 이후에
      // 생성된 알림이 화면에서 누락되지 않게 한다.
      if (pendingMergeAfterInitialLoadRef.current) {
        pendingMergeAfterInitialLoadRef.current = false;
        mergeFreshNotificationsRef.current?.();
      }
    });
    return () => {
      disposed = true;
    };
  }, [
    currentUserId,
    reloadNonce,
    resolvedGateway,
    usesInjectedNotifications,
  ]);
  // 앱 실행 중 푸시가 도착하면 첫 페이지를 다시 조회해 새 알림만 목록 맨 위에
  // 끼워 넣는다. 기존 항목은 덮어쓰지 않아 낙관적 읽음 처리·가입 요청 결정
  // 상태와 스크롤 위치를 유지하고, 미읽음 수는 실제로 삽입한 새 미읽음 개수만큼만
  // 올린다(읽음 API 커밋 전 서버 값으로 되돌아가는 경쟁 방지). 초기 조회가
  // 진행 중이면 즉시 병합하지 않고 흔적만 남긴다 — 병합 결과를 초기 조회의
  // 덮어쓰기가 지울 수 있어서다. 남긴 흔적은 초기 조회 완료 후 한 번 병합해
  // 조회 스냅샷 이후에 생성된 알림도 놓치지 않는다. 연속 푸시는 진행 중
  // 조회 1건 + 후속 조회 1건으로 합친다.
  useEffect(() => {
    if (resolvedGateway === null || usesInjectedNotifications) {
      return;
    }
    let disposed = false;
    let isFetching = false;
    let hasPendingRefresh = false;
    const mergeFreshNotifications = () => {
      if (isInitialLoadingRef.current) {
        pendingMergeAfterInitialLoadRef.current = true;
        return;
      }
      // 목록 조회가 실패한 상태에서는 목록과 serverUnreadCount의 스냅샷이 어긋나
      // 증분 가산이 이중 계산되므로, 초기 조회 경로를 다시 실행해 절대값으로
      // 복구한다.
      if (!hasLoadedInitialPageRef.current) {
        setReloadNonce(nonce => nonce + 1);
        return;
      }
      if (isFetching) {
        hasPendingRefresh = true;
        return;
      }
      isFetching = true;
      resolvedGateway
        .loadPage(0)
        .then(result => {
          if (disposed || isInitialLoadingRef.current) {
            return;
          }
          const knownIds = new Set(
            notificationsRef.current.map(notification => notification.id),
          );
          const fresh = applyReadIds(
            result.notifications.filter(
              notification => !knownIds.has(notification.id),
            ),
            readNotificationIdsRef.current,
          );
          if (fresh.length === 0) {
            return;
          }
          pendingUnreadDeltaRef.current = 0;
          setNotifications(current => {
            const currentIds = new Set(
              current.map(notification => notification.id),
            );
            const stillFresh = fresh.filter(
              notification => !currentIds.has(notification.id),
            );
            pendingUnreadDeltaRef.current = stillFresh.filter(
              notification => !notification.isRead,
            ).length;
            return stillFresh.length === 0
              ? current
              : [...stillFresh, ...current];
          });
          setServerUnreadCount(current =>
            current === null ? null : current + pendingUnreadDeltaRef.current,
          );
        })
        .catch(() => undefined)
        .finally(() => {
          isFetching = false;
          if (hasPendingRefresh && !disposed) {
            hasPendingRefresh = false;
            mergeFreshNotifications();
          }
        });
    };
    mergeFreshNotificationsRef.current = mergeFreshNotifications;
    const unsubscribe = subscribePushReceived(mergeFreshNotifications);
    return () => {
      disposed = true;
      mergeFreshNotificationsRef.current = null;
      unsubscribe();
    };
  }, [
    currentUserId,
    resolvedGateway,
    subscribePushReceived,
    usesInjectedNotifications,
  ]);
  const markAsRead = (notificationId: string) => {
    const target = notifications.find(notification => notification.id === notificationId);
    if (target === undefined || target.isRead) {
      return;
    }
    setNotifications(current =>
      current.map(notification =>
        notification.id === notificationId
          ? {...notification, isRead: true}
          : notification,
      ),
    );
    setServerUnreadCount(current =>
      current === null ? null : Math.max(0, current - 1),
    );
    if (resolvedGateway !== null && !usesInjectedNotifications) {
      void resolvedGateway
        .markRead(notificationId)
        .then(() => {
          onNotificationRead?.(notificationId);
        })
        .catch(error => {
          setNotifications(current => {
            const restored = current.map(notification =>
              notification.id === notificationId
                ? {...notification, isRead: false}
                : notification,
            );
            return restored.some(notification => notification.id === notificationId)
              ? restored
              : [...restored, {...target, isRead: false}];
          });
          setServerUnreadCount(current =>
            current === null ? null : current + 1,
          );
          setErrorMessage(toNotificationErrorMessage(error));
        });
    } else {
      onNotificationRead?.(notificationId);
    }
  };
  const handleNotificationPress = (notification: AppNotification) => {
    markAsRead(notification.id);
    const target = resolveNotificationTarget(notification);
    if (target === null) {
      return;
    }
    // 게시글은 기존 콜백 경로를 유지하고, 나머지 목적지는 공용 라우팅에 위임한다.
    if (target.kind === 'post') {
      onOpenPost?.(target.postId, target.groupId, 'notification');
      return;
    }
    onOpenNotificationTarget?.(target);
  };
  const handleDeleteNotification = (notificationId: string) => {
    const target = notifications.find(
      notification => notification.id === notificationId,
    );
    if (target === undefined) {
      return;
    }
    setErrorMessage(null);
    const remove = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setNotifications(current =>
        current.filter(notification => notification.id !== notificationId),
      );
      if (!target.isRead) {
        setServerUnreadCount(current =>
          current === null ? null : Math.max(0, current - 1),
        );
      }
    };
    if (resolvedGateway !== null && !usesInjectedNotifications) {
      void resolvedGateway
        .deleteNotification(notificationId)
        .then(remove)
        .catch(error => setErrorMessage(toNotificationErrorMessage(error)));
      return;
    }
    remove();
  };
  const usesRemoteDecisions =
    resolvedGateway !== null && !usesInjectedNotifications;
  const resolvedProcessJoinRequest =
    processJoinRequest ?? processJoinRequestApi;

  const markDecidedNotification = (
    target: AppNotification,
    status: NotificationJoinRequestStatus | null,
  ) => {
    setNotifications(current =>
      current.map(notification =>
        notification.id === target.id
          ? {
              ...notification,
              isRead: true,
              relatedJoinRequestStatus: status,
              requestKind: undefined,
            }
          : notification,
      ),
    );
    if (!target.isRead) {
      setServerUnreadCount(current =>
        current === null ? null : Math.max(0, current - 1),
      );
    }
    // 가입 요청은 이미 서버에서 처리됐으므로 읽음 동기화 실패는 목록 제거를 되돌리지 않는다.
    if (usesRemoteDecisions && !target.isRead) {
      void resolvedGateway
        .markRead(target.id)
        .then(() => onNotificationRead?.(target.id))
        .catch(() => undefined);
    } else if (!usesRemoteDecisions) {
      onNotificationRead?.(target.id);
    }
  };
  // API-GROUPS-009 처리에 성공한 뒤에만 알림을 정리한다. 실패하면 알림을 유지해 재시도하게 한다.
  const applyDecision = async (
    target: AppNotification,
    role?: GroupRole,
  ): Promise<boolean> => {
    if (!usesRemoteDecisions) {
      markDecidedNotification(target, role ? 'APPROVED' : 'REJECTED');
      return true;
    }
    if (target.relatedJoinRequestStatus !== 'PENDING_ADMIN') {
      return false;
    }
    if (
      target.groupId === undefined ||
      target.relatedJoinRequestId === undefined
    ) {
      setErrorMessage(
        '가입 요청 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
      return false;
    }
    setProcessingDecisionId(target.id);
    setErrorMessage(null);
    try {
      await resolvedProcessJoinRequest(target.groupId, {
        assignedRole: role,
        decision: role ? 'APPROVE' : 'REJECT',
        joinRequestId: target.relatedJoinRequestId,
      });
    } catch (error) {
      if (isJoinRequestAlreadyProcessed(error)) {
        markDecidedNotification(target, null);
      }
      setErrorMessage(joinRequestDecisionErrorMessage(error));
      return false;
    } finally {
      setProcessingDecisionId(null);
    }
    markDecidedNotification(target, role ? 'APPROVED' : 'REJECTED');
    return true;
  };
  const handleDecision = (
    notificationId: string,
    mode: 'approve' | 'reject',
  ) => {
    const target = notifications.find(
      notification => notification.id === notificationId,
    );
    if (target === undefined || processingDecisionId !== null) {
      return;
    }
    if (target.relatedJoinRequestStatus !== 'PENDING_ADMIN') {
      return;
    }
    const applicantName = target.actorName ?? null;
    if (mode === 'approve') {
      // 승인은 역할 선택 후에 처리하므로 팝업만 연다.
      setDecision({applicantName, id: notificationId, mode});
      return;
    }
    void applyDecision(target).then(succeeded => {
      if (succeeded) {
        setDecision({applicantName, id: notificationId, mode});
      }
    });
  };
  const handleSelectRole = (role: GroupRole) => {
    if (decision === null || processingDecisionId !== null) {
      return;
    }
    const target = notifications.find(
      notification => notification.id === decision.id,
    );
    if (target === undefined) {
      setDecision(null);
      return;
    }
    // 실패해도 팝업은 닫고 오류 문구를 보여준다. 알림이 남아 있어 재시도할 수 있다.
    void applyDecision(target, role).then(() => setDecision(null));
  };
  const handleCloseDecision = () => {
    if (processingDecisionId === null) {
      setDecision(null);
    }
  };
  const handleDeleteAll = () => {
    if (notifications.length === 0) {
      return;
    }
    if (!deleteAllArmed) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDeleteAllArmed(true);
      if (deleteAllTimerRef.current !== null) {
        clearTimeout(deleteAllTimerRef.current);
      }
      deleteAllTimerRef.current = setTimeout(
        () => setDeleteAllArmed(false),
        3_000,
      );
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDeleteAllArmed(false);
    setErrorMessage(null);
    deleteAnimationTimersRef.current.forEach(clearTimeout);
    deleteAnimationTimersRef.current = [];
    const deleteIds = notificationsRef.current.map(notification => notification.id);
    const animateRemoveAll = () => {
      const ids = deleteIds;
      ids.forEach((id, index) => {
        const timer = setTimeout(() => {
          LayoutAnimation.configureNext(
            LayoutAnimation.Presets.easeInEaseOut,
          );
          setNotifications(current =>
            current.filter(notification => notification.id !== id),
          );
        }, index * 90);
        deleteAnimationTimersRef.current.push(timer);
      });
      const finalTimer = setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setNotifications(current =>
          current.filter(notification => !ids.includes(notification.id)),
        );
        deleteAnimationTimersRef.current = [];
      }, Math.max(ids.length * 90, 1));
      deleteAnimationTimersRef.current.push(finalTimer);
    };
    if (resolvedGateway !== null && !usesInjectedNotifications) {
      void resolvedGateway
        .deleteAllNotifications()
        .then(() => {
          animateRemoveAll();
          setServerUnreadCount(0);
        })
        .catch(error => {
          setErrorMessage(toNotificationErrorMessage(error));
        });
    } else {
      animateRemoveAll();
      setServerUnreadCount(0);
    }
  };
  const handleLoadMore = () => {
    if (
      resolvedGateway === null ||
      usesInjectedNotifications ||
      !hasNext ||
      loadingPageRef.current
    ) {
      return;
    }
    loadingPageRef.current = true;
    const nextPage = page + 1;
    void resolvedGateway
      .loadPage(nextPage)
      .then(result => {
        setNotifications(current => mergeNotificationPages(current, result.notifications));
        setPage(nextPage);
        setHasNext(result.hasNext);
      })
      .catch(error => setErrorMessage(toNotificationErrorMessage(error)))
      .finally(() => {
        loadingPageRef.current = false;
      });
  };
  return (
    <View style={styles.screen}>
      <ScreenHeader
        canDelete={notifications.length > 0}
        deleteAllArmed={deleteAllArmed}
        onBack={onCloseNotifications}
        onDeleteAll={handleDeleteAll}
        title="알림"
      />
      <View style={styles.summary}>
        <View>
          <AppText style={styles.sectionTitle}>최근 알림</AppText>
          <AppText style={styles.unreadCount}>
            읽지 않은 알림 {displayedUnreadCount}개
          </AppText>
        </View>
        <View />
      </View>
      <FlatList
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyList : styles.listContent
        }
        data={notifications}
        keyExtractor={notification => notification.id}
        ListEmptyComponent={
          isLoading ? <LoadingNotificationState /> : <EmptyNotificationState />
        }
        // 푸시 병합이 목록 맨 위에 항목을 끼워 넣어도 읽고 있던 위치를 유지한다.
        // 맨 위 근처에서는 자동으로 위로 스크롤해 새 알림을 바로 보여준다.
        maintainVisibleContentPosition={{
          autoscrollToTopThreshold: 80,
          minIndexForVisible: 0,
        }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        renderItem={({item}) => (
          <NotificationItem
            decisionDisabled={processingDecisionId !== null}
            notification={item}
            onApprove={id => handleDecision(id, 'approve')}
            onDelete={handleDeleteNotification}
            onPress={handleNotificationPress}
            onReject={id => handleDecision(id, 'reject')}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      {errorMessage ? (
        <View style={styles.errorBannerWrap}>
          <NoticeBanner message={errorMessage} />
        </View>
      ) : null}
      <NotificationDecisionModal
        applicantName={decision?.applicantName ?? null}
        mode={decision?.mode ?? null}
        onClose={handleCloseDecision}
        onSelectRole={handleSelectRole}
        submitting={processingDecisionId !== null}
      />
    </View>
  );
}
function applyReadIds(
  notifications: readonly AppNotification[],
  readIds: readonly string[],
): readonly AppNotification[] {
  if (readIds.length === 0) {
    return notifications;
  }
  return notifications.map(notification =>
    notification.isRead || readIds.includes(notification.id)
      ? {...notification, isRead: true}
      : notification,
  );
}
function mergeNotificationPages(
  current: readonly AppNotification[],
  next: readonly AppNotification[],
): readonly AppNotification[] {
  const merged = new Map(current.map(notification => [notification.id, notification]));
  next.forEach(notification => {
    if (!merged.has(notification.id)) {
      merged.set(notification.id, notification);
    }
  });
  return [...merged.values()];
}
function toNotificationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return '알림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
}
function ScreenHeader({
  canDelete,
  deleteAllArmed,
  onBack,
  onDeleteAll,
  title,
}: {
  canDelete: boolean;
  deleteAllArmed: boolean;
  onBack?: () => void;
  onDeleteAll: () => void;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        <BackButton accessibilityLabel="알림 화면 닫기" onPress={onBack} />
      </View>
      <AppText style={styles.headerTitle}>{title}</AppText>
      <Pressable
        accessibilityLabel={deleteAllArmed ? '전체 지우기' : '알림 삭제'}
        accessibilityRole="button"
        disabled={!canDelete}
        onPress={onDeleteAll}
        style={styles.headerButton}
      >
        {deleteAllArmed ? (
          <AppText style={styles.deleteAllText}>전체 지우기</AppText>
        ) : (
          <Trash2
            color={canDelete ? COLORS.purpleDeep : COLORS.textDisabled}
            size={21}
          />
        )}
      </Pressable>
    </View>
  );
}
function EmptyNotificationState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <BellOff color={COLORS.purpleDeep} size={31} strokeWidth={1.8} />
      </View>
      <AppText style={styles.emptyTitle}>새로운 알림이 없어요</AppText>
      <AppText style={styles.emptyDescription}>
        가족의 새로운 소식이 생기면{'\n'}여기에서 알려드릴게요.
      </AppText>
    </View>
  );
}
function LoadingNotificationState() {
  return (
    <View style={styles.emptyState}>
      <AppText style={styles.emptyTitle}>알림을 불러오는 중이에요</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  disabledText: {
    color: COLORS.textDisabled,
  },
  emptyDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
    paddingHorizontal: 24,
  },
  errorBannerWrap: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  emptyTitle: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 18,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 12,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 86,
  },
  deleteAllText: {
    color: COLORS.purpleDeep,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  headerTitle: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSide: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 86,
  },
  listContent: {
    paddingBottom: 24,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  summary: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 76,
    paddingHorizontal: 20,
  },
  unreadCount: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
});
