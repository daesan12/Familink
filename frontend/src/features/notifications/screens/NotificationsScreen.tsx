import BellOff from 'lucide-react-native/icons/bell-off';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Settings from 'lucide-react-native/icons/settings';
import {useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {NotificationDecisionModal} from '../components/NotificationDecisionModal';
import {NotificationItem} from '../components/NotificationItem';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEVELOPMENT_NOTIFICATIONS,
} from '../fixtures/notificationFixtures';
import type {
  AppNotification,
  DevicePermissionStatus,
  DeviceTokenStatus,
  NotificationSetting,
} from '../types';

export interface NotificationsScreenProps extends AppScreenProps {
  initialNotifications?: readonly AppNotification[];
  initialPermissionStatus?: DevicePermissionStatus;
  initialSettings?: readonly NotificationSetting[];
  initialTokenStatus?: DeviceTokenStatus;
  initialView?: 'list' | 'settings';
}

export function NotificationsScreen({
  initialNotifications,
  initialPermissionStatus = 'allowed',
  initialSettings = DEFAULT_NOTIFICATION_SETTINGS,
  initialTokenStatus = 'active',
  initialView = 'list',
  onCloseNotifications,
  onOpenPost,
}: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState(
    initialNotifications ?? (__DEV__ ? DEVELOPMENT_NOTIFICATIONS : []),
  );
  const [settings, setSettings] = useState(initialSettings);
  const [view, setView] = useState(initialView);
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

  if (view === 'settings') {
    return (
      <NotificationSettings
        onBack={() => setView('list')}
        onToggle={type =>
          setSettings(current =>
            current.map(setting =>
              setting.type === type
                ? {...setting, enabled: !setting.enabled}
                : setting,
            ),
          )
        }
        permissionStatus={initialPermissionStatus}
        settings={settings}
        tokenStatus={initialTokenStatus}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        onBack={onCloseNotifications}
        onSettings={() => setView('settings')}
        title="알림"
      />
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
          onPress={() =>
            setNotifications(current =>
              current.map(notification => ({
                ...notification,
                isRead: true,
              })),
            )
          }
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
          notifications.length === 0
            ? styles.emptyList
            : styles.listContent
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

function ScreenHeader({
  onBack,
  onSettings,
  title,
}: {
  onBack?: () => void;
  onSettings?: () => void;
  title: string;
}) {
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
      {onSettings ? (
        <Pressable
          accessibilityLabel="알림 설정 열기"
          accessibilityRole="button"
          onPress={onSettings}
          style={styles.headerButton}
        >
          <Settings color={COLORS.textStrong} size={23} strokeWidth={2} />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
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

function NotificationSettings({
  onBack,
  onToggle,
  permissionStatus,
  settings,
  tokenStatus,
}: {
  onBack: () => void;
  onToggle: (type: NotificationSetting['type']) => void;
  permissionStatus: DevicePermissionStatus;
  settings: readonly NotificationSetting[];
  tokenStatus: DeviceTokenStatus;
}) {
  return (
    <View style={styles.screen}>
      <ScreenHeader onBack={onBack} title="알림 설정" />
      <ScrollView
        contentContainerStyle={styles.settingsContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.settingsSectionTitle}>푸시 알림</Text>
        <View style={styles.settingsCard}>
          {settings.map((setting, index) => (
            <View
              key={setting.type}
              style={[
                styles.settingRow,
                index < settings.length - 1 && styles.settingDivider,
              ]}
            >
              <Text style={styles.settingLabel}>{setting.label}</Text>
              <Switch
                accessibilityLabel={`${setting.label} 푸시 알림`}
                onValueChange={() => onToggle(setting.type)}
                thumbColor={COLORS.background}
                trackColor={{
                  false: COLORS.inactive,
                  true: COLORS.purple,
                }}
                value={setting.enabled}
              />
            </View>
          ))}
        </View>
        <Text style={styles.settingsSectionTitle}>기기 상태</Text>
        <View style={styles.settingsCard}>
          <StatusRow
            label="알림 권한"
            positive={permissionStatus === 'allowed'}
            value={permissionStatus === 'allowed' ? '허용됨' : '거부됨'}
          />
          <View style={styles.settingDivider} />
          <StatusRow
            label="푸시 토큰"
            positive={tokenStatus === 'active'}
            value={tokenStatus === 'active' ? '활성' : '비활성'}
          />
        </View>
        {permissionStatus === 'denied' ? (
          <Text style={styles.permissionNotice}>
            기기 설정에서 알림 권한을 허용하면 푸시 알림을 받을 수 있어요.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatusRow({
  label,
  positive,
  value,
}: {
  label: string;
  positive: boolean;
  value: string;
}) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View
        style={[
          styles.statusBadge,
          positive ? styles.statusPositive : styles.statusNegative,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            positive
              ? styles.statusPositiveText
              : styles.statusNegativeText,
          ]}
        >
          {value}
        </Text>
      </View>
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
  permissionNotice: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
    paddingHorizontal: 4,
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
  settingDivider: {
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: 18,
  },
  settingsCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsContent: {
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  settingsSectionTitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 24,
  },
  statusBadge: {
    borderRadius: RADII.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusNegative: {
    backgroundColor: '#FDECEC',
  },
  statusNegativeText: {
    color: COLORS.error,
  },
  statusPositive: {
    backgroundColor: COLORS.lavenderSurface,
  },
  statusPositiveText: {
    color: COLORS.purpleDeep,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: 18,
  },
  statusText: {
    fontSize: 13,
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
