import {forwardRef, type ComponentRef} from 'react';
import {
  StyleSheet,
  Text as ReactNativeText,
  type TextProps,
} from 'react-native';

import {FONT_FAMILIES} from '../../design/tokens';

type ReactNativeTextRef = ComponentRef<typeof ReactNativeText>;

function resolveFontFamily(style: TextProps['style']): string {
  const flattenedStyle = StyleSheet.flatten(style) ?? {};
  if (flattenedStyle.fontFamily !== undefined) {
    return flattenedStyle.fontFamily;
  }

  const weight = flattenedStyle.fontWeight;
  if (weight === 'bold') {
    return FONT_FAMILIES.bold;
  }

  const numericWeight = typeof weight === 'number' ? weight : Number(weight);
  if (numericWeight >= 800) {
    return FONT_FAMILIES.extraBold;
  }
  if (numericWeight >= 700) {
    return FONT_FAMILIES.bold;
  }
  if (numericWeight >= 600) {
    return FONT_FAMILIES.semiBold;
  }
  if (numericWeight >= 500) {
    return FONT_FAMILIES.medium;
  }
  return FONT_FAMILIES.regular;
}

export const AppText = forwardRef<ReactNativeTextRef, TextProps>(
  ({style, ...props}, ref) => (
    <ReactNativeText
      {...props}
      ref={ref}
      style={[style, {fontFamily: resolveFontFamily(style)}]}
    />
  ),
);

AppText.displayName = 'AppText';
