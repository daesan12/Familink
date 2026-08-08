import Calendar from 'lucide-react-native/icons/calendar';
import Check from 'lucide-react-native/icons/check';
import FileChartColumn from 'lucide-react-native/icons/file-chart-column';
import House from 'lucide-react-native/icons/house';
import Trash2 from 'lucide-react-native/icons/trash-2';
import UsersRound from 'lucide-react-native/icons/users-round';
import X from 'lucide-react-native/icons/x';
import {useCallback, useMemo, useRef, useState} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';

import {COLORS, RADII} from '../../../design/tokens';
import {AppText} from '../../../shared/components/AppText';
import type {AppNotification, NotificationType} from '../types';

// 프로필 사진이 없는 알림은 종류를 알려주는 아이콘으로 대체한다. 시스템이
// 만든 리포트·일정 알림은 보낸 사람 자체가 없어 사진을 띄울 대상이 없고,
// 사람이 보낸 알림도 사진 미등록이면 이니셜만으로는 무슨 알림인지 알 수 없다.
// 아이콘은 해당 알림이 이동하는 탭의 아이콘과 맞춰 목적지를 예측하게 한다.
const TYPE_ICONS = {
  CALL_REPORT: FileChartColumn,
  DAILY_REPORT: FileChartColumn,
  EVENT_CHANGED: Calendar,
  EVENT_REMINDER: Calendar,
  GROUP_JOIN_REQUEST: UsersRound,
  NEW_POST: House,
  POST_ACTIVITY: House,
} satisfies Record<NotificationType, typeof House>;

interface NotificationItemProps {
  // 가입 요청 처리(API 왕복)가 진행 중이면 승인·거부 버튼을 잠근다.
  decisionDisabled?: boolean;
  notification: AppNotification;
  onApprove: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
  onPress: (notification: AppNotification) => void;
  onReject: (notificationId: string) => void;
}

export function NotificationItem({
  decisionDisabled = false,
  notification,
  onApprove,
  onDelete,
  onPress,
  onReject,
}: NotificationItemProps) {
  const textStyle = notification.isRead
    ? styles.readText
    : styles.unreadText;
  const TypeIcon = TYPE_ICONS[notification.type];
  const translateX = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);
  const close = useCallback(() => {
    setRevealed(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [translateX]);
  const reveal = useCallback(() => {
    setRevealed(true);
    Animated.spring(translateX, {
      toValue: -72,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [translateX]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          const next = (revealed ? -72 : 0) + gesture.dx;
          translateX.setValue(Math.min(0, Math.max(-72, next)));
        },
        onPanResponderRelease: (_, gesture) => {
          const next = (revealed ? -72 : 0) + gesture.dx;
          next < -36 || gesture.vx < -0.4 ? reveal() : close();
        },
        onPanResponderTerminate: close,
      }),
    [close, reveal, revealed, translateX],
  );

  return (
    <View style={styles.swipeRoot}>
      <View style={styles.deleteAction}>
        <Pressable
          accessibilityLabel="알림 단건 삭제"
          accessibilityRole="button"
          onPress={() => {
            close();
            onDelete(notification.id);
          }}
          style={({pressed}) => [
            styles.deleteButton,
            pressed && styles.deleteButtonPressed,
          ]}
        >
          <Trash2 color={COLORS.background} size={22} />
        </Pressable>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.frontRow,
          {
            backgroundColor: notification.isRead
              ? COLORS.background
              : COLORS.lavenderSurface,
            transform: [{translateX}],
          },
        ]}
      >
        <Pressable
          accessibilityLabel={`${notification.title}, ${notification.createdAtLabel}`}
          accessibilityRole="button"
          onPress={() => {
            if (revealed) {
              close();
              return;
            }
            onPress(notification);
          }}
          style={({pressed}) => [
            styles.container,
            !notification.isRead && styles.unreadContainer,
            pressed && styles.pressed,
          ]}
        >
          {notification.actorProfileImageUrl === undefined ? (
            <View style={[styles.avatar, styles.typeAvatar]}>
              <TypeIcon
                color={COLORS.purpleDeep}
                size={24}
                strokeWidth={2}
              />
            </View>
          ) : (
            <CachedRemoteImage
              source={{uri: notification.actorProfileImageUrl}}
              style={styles.avatar}
            />
          )}
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
      </Animated.View>
    </View>
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
  // 사진 자리와 같은 원 안에 아이콘을 넣어 목록의 왼쪽 열이 어긋나지 않게 한다.
  typeAvatar: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.inactive,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  deleteAction: {
    alignItems: 'center',
    backgroundColor: '#A8243A',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 72,
    zIndex: 0,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#D34A5A',
    borderColor: '#F07A86',
    borderRadius: RADII.pill,
    borderWidth: 1,
    elevation: 6,
    height: 46,
    justifyContent: 'center',
    shadowColor: '#5C1020',
    shadowOffset: {height: 3, width: 0},
    shadowOpacity: 0.32,
    shadowRadius: 5,
    width: 46,
  },
  deleteButtonPressed: {
    backgroundColor: '#B83A4D',
    transform: [{scale: 0.96}],
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
  frontRow: {
    elevation: 1,
    zIndex: 1,
  },
  swipeRoot: {
    overflow: 'hidden',
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
