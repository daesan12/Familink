import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS} from '../../../design/tokens';
import {AUTH_COLORS} from '../theme';
import type {SignupStep} from '../types';

interface StepHeaderProps {
  backDisabled?: boolean;
  step: SignupStep;
  title: string;
  onBack: () => void;
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
        <View style={styles.progressTrack}>
          <View style={[styles.progressValue, {width: `${step * 20}%`}]} />
        </View>
        <Text style={styles.stepText}>{step}/5</Text>
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>회원가입</Text>
        <Text style={styles.title}>{title}</Text>
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
    borderRadius: 20,
    boxShadow: '0px 4px 10px rgba(143, 125, 245, 0.18)',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backButtonDisabled: {
    opacity: 0.6,
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
