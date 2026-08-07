import {StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {PrimaryButton} from '../components/PrimaryButton';
import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';

interface SessionRestoreErrorScreenProps {
  onRetry: () => void;
  // 재시도 복원이 진행 중이면 버튼을 로딩으로 잠가 화면이 백지로 돌아가지 않게 한다.
  retrying?: boolean;
}

// 세션 복원이 재시도 가능한 오류(네트워크·서버 장애)로 멈췄을 때
// 백지 화면 대신 상태를 안내하고 재시도 수단을 제공한다. 세션은 버리지 않는다.
export function SessionRestoreErrorScreen({
  onRetry,
  retrying = false,
}: SessionRestoreErrorScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.copy}>
        <AppText style={styles.title}>연결에 문제가 있어요</AppText>
        <AppText style={styles.description}>
          네트워크 상태를 확인한 뒤{'\n'}다시 시도해 주세요.
        </AppText>
      </View>
      <View style={styles.action}>
        <PrimaryButton label="다시 시도" loading={retrying} onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    paddingBottom: 48,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
    width: '100%',
  },
  copy: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  description: {
    color: AUTH_COLORS.muted,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 12,
    textAlign: 'center',
  },
  screen: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.background,
    flex: 1,
  },
  title: {
    color: AUTH_COLORS.body,
    fontSize: 22,
    fontWeight: '700',
  },
});
