import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';
import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';
import type {AppNotification} from '../types';

interface NotificationItemProps {
  // 가입 요청 처리(API 왕복)가 진행 중이면 승인·거부 버튼을 잠근다.
  decisionDisabled?: boolean;
  notification: AppNotification;
  onApprove: (notificationId: string) => void;
  onPress: (notification: AppNotification) => void;
  onReject: (notificationId: string) => void;
}

export function NotificationItem({
  decisionDisabled = false,
  notification,
  onApprove,
  onPress,
  onReject,
}: NotificationItemProps) {
  const textStyle = notification.isRead
    ? styles.readText
    : styles.unreadText;

  return (
    <Pressable
      accessibilityLabel={`${notification.title}, ${notification.createdAtLabel}`}
      accessibilityRole="button"
      onPress={() => onPress(notification)}
      style={({pressed}) => [
        styles.container,
        !notification.isRead && styles.unreadContainer,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.avatar}>
        <AppText style={styles.avatarText}>{notification.avatarText}</AppText>
      </View>
      <View style={styles.copy}>
        <AppText numberOfLines={1} style={[styles.title, textStyle]}>
          {notification.title}
        </AppText>
        <AppText style={[styles.body, textStyle]}>{notification.body}</AppText>
        <AppText style={styles.time}>{notification.createdAtLabel}</AppText>
      </View>
      {notification.requestKind === 'groupJoin' &&
      notification.relatedJoinRequestStatus === 'PENDING_ADMIN' ? (
        <View style={styles.decisionActions}>
          <DecisionButton
            accessibilityLabel="그룹 요청 승인"
            color={COLORS.purpleDeep}
            disabled={decisionDisabled}
            icon="check"
            onPress={() => onApprove(notification.id)}
          />
          <DecisionButton
            accessibilityLabel="그룹 요청 거부"
            color={COLORS.textMuted}
            disabled={decisionDisabled}
            icon="x"
            onPress={() => onReject(notification.id)}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function DecisionButton({
  accessibilityLabel,
  color,
  disabled,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  disabled: boolean;
  icon: 'check' | 'x';
  onPress: () => void;
}) {
  const Icon = icon === 'check' ? Check : X;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={6}
      onPress={event => {
        event.stopPropagation();
        onPress();
      }}
      style={({pressed}) => [
        styles.decisionButton,
        {backgroundColor: color},
        pressed && styles.decisionButtonPressed,
        disabled && styles.decisionButtonDisabled,
      ]}
    >
      <Icon color={COLORS.background} size={18} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.divider,
    borderRadius: RADII.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  container: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 110,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  copy: {
    flex: 1,
  },
  decisionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  decisionButton: {
    alignItems: 'center',
    borderRadius: RADII.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  decisionButtonDisabled: {
    opacity: 0.5,
  },
  decisionButtonPressed: {
    opacity: 0.76,
    transform: [{scale: 0.96}],
  },
  pressed: {
    backgroundColor: COLORS.surface,
  },
  readText: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  time: {
    color: COLORS.textSubtle,
    fontSize: 12,
    marginTop: 6,
  },
  title: {
    fontSize: 15,
    lineHeight: 21,
  },
  unreadContainer: {
    backgroundColor: COLORS.lavenderSurface,
  },
  unreadText: {
    color: COLORS.textStrong,
    fontWeight: '700',
  },
});
