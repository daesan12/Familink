import {ScrollView, StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';
import {BackButton} from '../../../shared/components/BackButton';
import {QUICK_START_STEPS} from '../fixtures/profileFixtures';

interface ProfileGuideScreenProps {
  onBack: () => void;
}

// I-7 이용 가이드. '처음 시작하시나요?'와 빠른 시작 3단계만 보여주는 정적 안내 화면.
export function ProfileGuideScreen({onBack}: ProfileGuideScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <BackButton onPress={onBack} style={styles.backButton} />
        <AppText style={styles.headerTitle}>이용 가이드</AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introBlock}>
          <AppText style={styles.introTitle}>처음 시작하시나요?</AppText>
          <AppText style={styles.introDescription}>
            가족과 일상을 나누는 방법을 차근차근 알려드려요.
          </AppText>
        </View>

        <View style={styles.quickStartCard}>
          <AppText style={styles.quickStartLabel}>빠른 시작</AppText>
          {QUICK_START_STEPS.map((step, index) => (
            <View
              key={step.order}
              style={[
                styles.quickStartRow,
                index < QUICK_START_STEPS.length - 1 && styles.quickStartDivider,
              ]}
            >
              <View style={styles.stepBadge}>
                <AppText style={styles.stepBadgeText}>{step.order}</AppText>
              </View>
              <View style={styles.stepTexts}>
                <AppText style={styles.stepTitle}>{step.title}</AppText>
                <AppText style={styles.stepDescription}>{step.description}</AppText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    left: 20,
    position: 'absolute',
    zIndex: 1,
  },
  content: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  introBlock: {
    gap: 6,
    paddingVertical: 16,
  },
  introDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  introTitle: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: '700',
  },
  quickStartCard: {
    backgroundColor: COLORS.surface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  quickStartDivider: {
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quickStartLabel: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
    paddingBottom: 6,
    paddingTop: 14,
  },
  quickStartRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.purple,
    borderRadius: RADII.pill,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  stepBadgeText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '700',
  },
  stepDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  stepTexts: {
    flex: 1,
  },
  stepTitle: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '600',
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
});
