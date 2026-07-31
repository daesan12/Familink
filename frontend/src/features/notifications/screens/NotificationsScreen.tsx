import BellOff from 'lucide-react-native/icons/bell-off';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import {useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {NotificationDecisionModal} from '../components/NotificationDecisionModal';
import {NotificationItem} from '../components/NotificationItem';
import {DEVELOPMENT_NOTIFICATIONS} from '../fixtures/notificationFixtures';
import {useNotificationGateway} from '../NotificationGatewayContext';
import type {AppNotification, NotificationGateway} from '../types';

export interface NotificationsScreenProps extends AppScreenProps {
  gateway?: NotificationGateway;
  initialNotifications?: readonly AppNotification[];
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
  onOpenPost,
  readNotificationIds = NO_READ_IDS,
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
  const loadingPageRef = useRef(false);
  const generationRef = useRef(0);
  const readNotificationIdsRef = useRef(readNotificationIds);
  const [decision, setDecision] = useState<{
    id: string;
    mode: 'approve' | 'reject';
  } | null>(null);
  const [decisionReadFailedId, setDecisionReadFailedId] = useState<string | null>(
    null,
  );
  const decisionGenerationRef = useRef(0);
  const unreadCount = useMemo(
    () => notifications.filter(notification => !notification.isRead).length,
    [notifications],
  );
  const displayedUnreadCount = serverUnreadCount ?? unreadCount;

  useEffect(() => {
    readNotificationIdsRef.current = readNotificationIds;
  }, [readNotificationIds]);

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
    setIsLoading(true);
    setErrorMessage(null);
    setPage(0);
    setHasNext(false);
    setNotifications([]);

    Promise.all([
      resolvedGateway.loadPage(0),
      resolvedGateway.getUnreadCount(),
    ])
      .then(([result, count]) => {
        if (disposed || generationRef.current !== generation) {
          return;
        }
        setNotifications(
          applyReadIds(result.notifications, readNotificationIdsRef.current),
        );
        setHasNext(result.hasNext);
        setServerUnreadCount(count);
      })
      .catch(error => {
        if (disposed || generationRef.current !== generation) {
          return;
        }
        setErrorMessage(toNotificationErrorMessage(error));
      })
      .finally(() => {
        if (!disposed && generationRef.current === generation) {
          setIsLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [
    currentUserId,
    resolvedGateway,
    usesInjectedNotifications,
  ]);

  const markAsRead = (
    notificationId: string,
    onSuccess?: () => void,
    onFailure?: () => void,
  ) => {
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
          onSuccess?.();
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
          onFailure?.();
          setErrorMessage(toNotificationErrorMessage(error));
        });
    } else {
      onNotificationRead?.(notificationId);
    }
  };

  const handleNotificationPress = (notification: AppNotification) => {
    markAsRead(notification.id);
    if (notification.postId) {
      onOpenPost?.(notification.postId, notification.groupId);
    }
  };

  const handleDecision = (
    notificationId: string,
    mode: 'approve' | 'reject',
  ) => {
    const decisionGeneration = ++decisionGenerationRef.current;
    setDecisionReadFailedId(null);
    if (mode === 'reject') {
      if (resolvedGateway !== null && !usesInjectedNotifications) {
        markAsRead(notificationId, () => {
          setNotifications(current =>
            current.filter(notification => notification.id !== notificationId),
          );
        });
      } else {
        setNotifications(current =>
          current.filter(notification => notification.id !== notificationId),
        );
      }
    } else {
      markAsRead(notificationId, undefined, () =>
        decisionGenerationRef.current === decisionGeneration
          ? setDecisionReadFailedId(notificationId)
          : undefined,
      );
    }
    setDecision({id: notificationId, mode});
  };

  const handleDecisionComplete = () => {
    if (decision && decisionReadFailedId !== decision.id) {
      setNotifications(current =>
        current.filter(notification => notification.id !== decision.id),
      );
    }
    setDecision(null);
    setDecisionReadFailedId(null);
  };

  const handleReadAll = () => {
    if (displayedUnreadCount === 0) {
      return;
    }
    const previous = notifications;
    const previousServerUnreadCount = serverUnreadCount;
    const unreadNotificationIds = notifications
      .filter(notification => !notification.isRead)
      .map(notification => notification.id);
    setNotifications(current =>
      current.map(notification => ({...notification, isRead: true})),
    );
    setServerUnreadCount(0);

    if (resolvedGateway !== null && !usesInjectedNotifications) {
      void resolvedGateway
        .markAllRead()
        .then(() => {
          unreadNotificationIds.forEach(notificationId =>
            onNotificationRead?.(notificationId),
          );
        })
        .catch(error => {
          setNotifications(previous);
          setServerUnreadCount(previousServerUnreadCount);
          setErrorMessage(toNotificationErrorMessage(error));
        });
    } else {
      unreadNotificationIds.forEach(notificationId =>
        onNotificationRead?.(notificationId),
      );
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
      <ScreenHeader onBack={onCloseNotifications} title="알림" />
      <View style={styles.summary}>
        <View>
          <Text style={styles.sectionTitle}>최근 알림</Text>
          <Text style={styles.unreadCount}>
            읽지 않은 알림 {displayedUnreadCount}개
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={displayedUnreadCount === 0}
          onPress={handleReadAll}
          style={styles.readAllButton}
        >
          <Text
            style={[
              styles.readAllText,
              displayedUnreadCount === 0 && styles.disabledText,
            ]}
          >
            모두 읽음
          </Text>
        </Pressable>
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
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        renderItem={({item}) => (
          <NotificationItem
            notification={item}
            onApprove={id => handleDecision(id, 'approve')}
            onPress={handleNotificationPress}
            onReject={id => handleDecision(id, 'reject')}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      {errorMessage ? (
        <Text accessibilityRole="alert" style={styles.errorMessage}>
          {errorMessage}
        </Text>
      ) : null}
      <NotificationDecisionModal
        mode={decision?.mode ?? null}
        onClose={() => setDecision(null)}
        onSelectRole={handleDecisionComplete}
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

function ScreenHeader({onBack, title}: {onBack?: () => void; title: string}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="알림 화면 닫기"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.headerButton}
      >
        <ChevronLeft color={COLORS.textStrong} size={27} strokeWidth={2.2} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

function EmptyNotificationState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <BellOff color={COLORS.purpleDeep} size={31} strokeWidth={1.8} />
      </View>
      <Text style={styles.emptyTitle}>새로운 알림이 없어요</Text>
      <Text style={styles.emptyDescription}>
        가족의 새로운 소식이 생기면{'\n'}여기에서 알려드릴게요.
      </Text>
    </View>
  );
}

function LoadingNotificationState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>알림을 불러오는 중이에요</Text>
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
  errorMessage: {
    color: COLORS.error,
    fontSize: 13,
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
    width: 44,
  },
  headerTitle: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  readAllButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  readAllText: {
    color: COLORS.purpleDeep,
    fontSize: 14,
    fontWeight: '700',
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
