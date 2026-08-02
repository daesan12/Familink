import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS} from '../../../design/tokens';
import {APP_VERSION} from '../fixtures/profileFixtures';

interface MyPageFooterProps {
  onLogout: () => void;
}

// I-1·J-1 하단: 앱 버전 표기 + 로그아웃.
export function MyPageFooter({onLogout}: MyPageFooterProps) {
  return (
    <View style={styles.footer}>
      <Text style={styles.text}>앱 버전 {APP_VERSION}</Text>
      <Text style={styles.divider}>|</Text>
      <Pressable
        accessibilityLabel="로그아웃"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onLogout}
      >
        <Text style={styles.text}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    color: COLORS.inactive,
    fontSize: 13,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingTop: 24,
  },
  text: {
    color: COLORS.textSubtle,
    fontSize: 13,
  },
});
