import Check from 'lucide-react-native/icons/check';
import Trash2 from 'lucide-react-native/icons/trash-2';
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
import type {AppNotification} from '../types';

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
            <View style={styles.avatar}>
              <AppText style={styles.avatarText}>
                {notification.avatarText}
              </AppText>
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
