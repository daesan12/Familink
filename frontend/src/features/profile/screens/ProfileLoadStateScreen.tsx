import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS} from '../../../design/tokens';
import {BackButton} from '../../../shared/components/BackButton';
import {RetryButton} from '../../../shared/components/RetryButton';

interface ProfileLoadStateScreenProps {
  errorMessage?: string;
  onBack?: () => void;
  onRetry?: () => void;
}

export function ProfileLoadStateScreen({
  errorMessage,
  onBack,
  onRetry,
}: ProfileLoadStateScreenProps) {
  const isLoading = errorMessage === undefined;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {onBack ? (
          <BackButton
            accessibilityLabel="프로필 조회에서 뒤로 가기"
            onPress={onBack}
          />
        ) : null}
        <AppText style={styles.headerTitle}>마이페이지</AppText>
      </View>

      <View accessibilityLiveRegion="polite" style={styles.content}>
        {isLoading ? (
          <>
            <ActivityIndicator color={COLORS.purpleDeep} size="large" />
            <AppText style={styles.title}>프로필을 불러오는 중이에요.</AppText>
          </>
        ) : (
          <>
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="alert-circle-outline"
              size={34}
            />
            <AppText style={styles.title}>프로필을 불러오지 못했어요</AppText>
            <AppText style={styles.message}>{errorMessage}</AppText>
            <View style={styles.retryWrap}>
              <RetryButton
                accessibilityLabel="프로필 다시 시도"
                onPress={onRetry}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTitle: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: '700',
  },
  message: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  retryWrap: {
    marginTop: 20,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 27,
    marginTop: 16,
    textAlign: 'center',
  },
});
