import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS} from '../../../design/tokens';

interface MyPageFooterProps {
  onLogout: () => void;
}

// I-1·J-1 하단: 로그아웃. 앱 버전은 실제 빌드 정보와 무관한 고정 문자열이라
// 잘못된 정보를 보여 주고 있어서 뺐다. 실제 versionName을 읽어 올 수 있게 되면
// 다시 넣는다.
export function MyPageFooter({onLogout}: MyPageFooterProps) {
  return (
    <View style={styles.footer}>
      <Pressable
        accessibilityLabel="로그아웃"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onLogout}
      >
        <AppText style={styles.text}>로그아웃</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
    textDecorationLine: 'underline',
  },
});
