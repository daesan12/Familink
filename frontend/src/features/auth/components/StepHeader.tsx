import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS} from '../../../design/tokens';
import {AUTH_COLORS} from '../theme';
import type {SignupStep} from '../types';

// 뒤로가기 버튼과 그 자리를 대신하는 여백이 같은 크기여야 단계마다 진행바가 같은 위치에 놓인다.
const BACK_BUTTON_SIZE = 40;

interface StepHeaderProps {
  backDisabled?: boolean;
  step: SignupStep;
  title: string;
  // 돌아갈 단계가 없는 단계에서는 넘기지 않아 버튼 자체를 숨긴다.
  onBack?: () => void;
}

export function StepHeader({
  backDisabled = false,
  step,
  title,
  onBack,
}: StepHeaderProps) {
  return (
    <>
      <View style={styles.topRow}>
        {onBack === undefined ? (
          // 진행바와 단계 표시가 다른 단계와 같은 위치에 놓이도록 자리만 유지한다.
          <View style={styles.backButtonPlaceholder} />
        ) : (
          <Pressable
            accessibilityLabel="이전 단계"
            accessibilityRole="button"
            accessibilityState={{disabled: backDisabled}}
            disabled={backDisabled}
            hitSlop={8}
            onPress={onBack}
            style={[
              styles.backButton,
              backDisabled && styles.backButtonDisabled,
            ]}>
            <MaterialDesignIcons
              name="chevron-left"
              size={28}
              color={COLORS.purpleDeep}
            />
          </Pressable>
        )}
        <View style={styles.progressTrack}>
          <View style={[styles.progressValue, {width: `${step * 20}%`}]} />
        </View>
        <AppText style={styles.stepText}>{step}/5</AppText>
      </View>
      <View style={styles.titleBlock}>
        <AppText style={styles.eyebrow}>회원가입</AppText>
        <AppText style={styles.title}>{title}</AppText>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 44,
    marginTop: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: BACK_BUTTON_SIZE / 2,
    boxShadow: '0px 4px 10px rgba(143, 125, 245, 0.18)',
    height: BACK_BUTTON_SIZE,
    justifyContent: 'center',
    width: BACK_BUTTON_SIZE,
  },
  backButtonDisabled: {
    opacity: 0.6,
  },
  backButtonPlaceholder: {
    height: BACK_BUTTON_SIZE,
    width: BACK_BUTTON_SIZE,
  },
  progressTrack: {
    backgroundColor: AUTH_COLORS.track,
    borderRadius: 2,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  progressValue: {
    backgroundColor: AUTH_COLORS.primary,
    borderRadius: 2,
    height: 4,
  },
  stepText: {
    color: '#7A7D8A',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'center',
  },
  titleBlock: {
    marginTop: 24,
  },
  eyebrow: {
    color: AUTH_COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 18,
    marginBottom: 6,
  },
  title: {
    color: AUTH_COLORS.body,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 38,
  },
});
