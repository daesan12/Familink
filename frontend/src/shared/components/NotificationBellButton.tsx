import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, View} from 'react-native';

import {COLORS} from '../../design/tokens';
import {AppText} from './AppText';

interface NotificationBellButtonProps {
  onPress: () => void;
  // 읽지 않은 알림 수. 0이면 배지를 그리지 않는다.
  unreadCount?: number;
}

// 셸 헤더와 게시글 상세가 함께 쓰는 알림 진입 버튼. 두 화면이 각자 벨과 배지를
// 그리던 탓에 위치와 배지 간격이 어긋났다(S15P11B104-341).
export function NotificationBellButton({
  onPress,
  unreadCount = 0,
}: NotificationBellButtonProps) {
  return (
    <Pressable
      accessibilityLabel="알림"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
    >
      {/* 배지는 버튼이 아니라 아이콘에 붙인다. 버튼 폭은 헤더 가운데 정렬용이라
          배지 좌표의 기준으로 쓰면 아이콘과 벌어진다. */}
      <View style={styles.icon}>
        <MaterialDesignIcons color={COLORS.textStrong} name="bell" size={28} />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: COLORS.purpleDeep,
    borderColor: COLORS.background,
    borderRadius: 9,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    position: 'absolute',
    right: -6,
    top: -6,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  // 슬롯 폭 80은 헤더 제목을 정중앙에 두기 위한 값이라 그대로 두고, 아이콘만
  // 바깥쪽으로 붙인다. 가운데 정렬하면 반대편 폴더 아이콘보다 20dp 안쪽으로 밀린다.
  button: {
    alignItems: 'flex-end',
    height: 44,
    justifyContent: 'center',
    paddingRight: 6,
    width: 80,
  },
  icon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
});
