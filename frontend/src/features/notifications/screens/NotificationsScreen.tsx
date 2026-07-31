import BellOff from 'lucide-react-native/icons/bell-off';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import {useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {NotificationDecisionModal} from '../components/NotificationDecisionModal';
import {NotificationItem} from '../components/NotificationItem';
import {DEVELOPMENT_NOTIFICATIONS} from '../fixtures/notificationFixtures';
import type {AppNotification} from '../types';

export interface NotificationsScreenProps extends AppScreenProps {
  initialNotifications?: readonly AppNotification[];
}

const NO_READ_IDS: readonly string[] = [];

// 알림 탭은 알림 목록만 담당한다. 알림 설정(I-6)은 마이페이지에서 진입한다.
export function NotificationsScreen({
  initialNotifications,
  onCloseNotifications,
  onNotificationRead,
  onOpenPost,
  readNotificationIds = NO_READ_IDS,
}: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState(() => {
    const source =
      initialNotifications ?? (__DEV__ ? DEVELOPMENT_NOTIFICATIONS : []);
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
  const [decision, setDecision] = useState<{
    id: string;
    mode: 'approve' | 'reject';
  } | null>(null);
  const unreadCount = useMemo(
    () => notifications.filter(notification => !notification.isRead).length,
    [notifications],
  );

  const markAsRead = (notificationId: string) => {
    setNotifications(current =>
      current.map(notification =>
        notification.id === notificationId
          ? {...notification, isRead: true}
          : notification,
      ),
    );
    onNotificationRead?.(notificationId);
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
    if (mode === 'reject') {
      setNotifications(current =>
        current.filter(notification => notification.id !== notificationId),
      );
    } else {
      markAsRead(notificationId);
    }
    setDecision({id: notificationId, mode});
  };

  const handleDecisionComplete = () => {
    if (decision) {
      setNotifications(current =>
        current.filter(notification => notification.id !== decision.id),
      );
    }
    setDecision(null);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader onBack={onCloseNotifications} title="알림" />
      <View style={styles.summary}>
        <View>
          <Text style={styles.sectionTitle}>최근 알림</Text>
          <Text style={styles.unreadCount}>
            읽지 않은 알림 {unreadCount}개
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={unreadCount === 0}
          onPress={() => {
            notifications.forEach(notification => {
              if (!notification.isRead) {
                onNotificationRead?.(notification.id);
              }
            });
            setNotifications(current =>
              current.map(notification => ({
                ...notification,
                isRead: true,
              })),
            );
          }}
          style={styles.readAllButton}
        >
          <Text
            style={[
              styles.readAllText,
              unreadCount === 0 && styles.disabledText,
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
        ListEmptyComponent={<EmptyNotificationState />}
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
      <NotificationDecisionModal
        mode={decision?.mode ?? null}
        onClose={() => setDecision(null)}
        onSelectRole={handleDecisionComplete}
      />
    </View>
  );
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
