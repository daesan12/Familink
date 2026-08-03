import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
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
          <Pressable
            accessibilityLabel="프로필 조회에서 뒤로 가기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={styles.backButton}>
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="chevron-left"
              size={30}
            />
          </Pressable>
        ) : null}
        <Text style={styles.headerTitle}>마이페이지</Text>
      </View>

      <View accessibilityLiveRegion="polite" style={styles.content}>
        {isLoading ? (
          <>
            <ActivityIndicator color={COLORS.purpleDeep} size="large" />
            <Text style={styles.title}>프로필을 불러오는 중이에요.</Text>
          </>
        ) : (
          <>
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="alert-circle-outline"
              size={34}
            />
            <Text style={styles.title}>프로필을 불러오지 못했어요</Text>
            <Text style={styles.message}>{errorMessage}</Text>
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
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
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
