import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';
import {AnimatedPressable} from './AnimatedPressable';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: PrimaryButtonProps) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{disabled: disabled || loading, busy: loading}}
      containerStyle={styles.container}
      disabled={disabled || loading}
      onPress={onPress}>
      <View style={styles.button}>
        {loading ? (
          <ActivityIndicator color={AUTH_COLORS.body} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  button: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.action,
    borderRadius: AUTH_LAYOUT.buttonRadius,
    boxShadow: '0px 7px 16px rgba(177, 145, 53, 0.14)',
    height: AUTH_LAYOUT.buttonHeight,
    justifyContent: 'center',
  },
  label: {
    color: AUTH_COLORS.body,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
