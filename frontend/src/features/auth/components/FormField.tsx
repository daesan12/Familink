import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';

interface FormFieldProps extends TextInputProps {
  label?: string;
  trailing?: React.ReactNode;
  invalid?: boolean;
}

export function FormField({
  label,
  trailing,
  invalid = false,
  style,
  ...props
}: FormFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label !== undefined && label.length > 0 && (
        <Text style={styles.label}>{label}</Text>
      )}
      <View style={[styles.field, invalid && styles.invalidField]}>
        <TextInput
          {...props}
          placeholderTextColor={AUTH_COLORS.placeholder}
          selectionColor={AUTH_COLORS.primary}
          style={[styles.input, style]}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    color: AUTH_COLORS.muted,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    marginLeft: 8,
  },
  field: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.surfaceRaised,
    borderColor: AUTH_COLORS.hairline,
    borderRadius: AUTH_LAYOUT.fieldRadius,
    borderWidth: 1,
    boxShadow: '0px 4px 10px rgba(74, 66, 112, 0.05)',
    flexDirection: 'row',
    height: AUTH_LAYOUT.fieldHeight,
    paddingHorizontal: 20,
  },
  invalidField: {
    borderColor: AUTH_COLORS.error,
  },
  input: {
    color: AUTH_COLORS.body,
    flex: 1,
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
});
