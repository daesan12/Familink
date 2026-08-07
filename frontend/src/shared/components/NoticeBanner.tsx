import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from './AppText';

import {COLORS, RADII} from '../../design/tokens';

interface NoticeBannerProps {
  message: string;
  // 있으면 배너 오른쪽에 재시도 텍스트 버튼을 함께 보여준다.
  onRetry?: () => void;
  retryLabel?: string;
}

// 요청 실패·진행 상태를 화면 안에서 알리는 공용 노란 배너.
// 게시글 업로드 배너의 모양을 기준으로 앱 전체 알림 문구를 통일한다.
export function NoticeBanner({
  message,
  onRetry,
  retryLabel = '다시 시도',
}: NoticeBannerProps) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.banner}>
      <AppText accessibilityRole="alert" style={styles.message}>
        {message}
      </AppText>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <AppText style={styles.retryText}>{retryLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: COLORS.lemon,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  message: {
    color: COLORS.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  retryText: {
    color: COLORS.purpleDeep,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
  },
});
