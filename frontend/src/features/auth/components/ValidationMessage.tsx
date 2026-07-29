import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {StyleSheet, Text, View} from 'react-native';

import {AUTH_COLORS} from '../theme';

interface ValidationMessageProps {
  message: string;
  variant: 'success' | 'error';
}

export function ValidationMessage({
  message,
  variant,
}: ValidationMessageProps) {
  const color =
    variant === 'success' ? AUTH_COLORS.success : AUTH_COLORS.error;

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <MaterialDesignIcons
        name={variant === 'success' ? 'check-circle' : 'close-circle'}
        size={20}
        color={color}
      />
      <Text style={[styles.message, {color}]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 24,
    paddingHorizontal: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '700',
  },
});
