import {
  createContext,
  forwardRef,
  useContext,
  useRef} from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';
import {FONT_FAMILY} from '../../../design/tokens';

import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';

// 포커스된 입력이 키보드나 하단 고정 버튼에 가려지지 않도록,
// 감싸는 화면이 이 컨텍스트로 전달받은 입력을 보이는 위치로 스크롤한다.
export const FocusedInputScrollContext = createContext<
  ((input: TextInput) => void) | null
>(null);

interface FormFieldProps extends TextInputProps {
  label?: string;
  trailing?: React.ReactNode;
  invalid?: boolean;
}

// ref로 내부 TextInput을 노출해 "다음" 키로 다른 입력칸에 포커스를 넘길 수 있게 한다.
export const FormField = forwardRef<TextInput, FormFieldProps>(
  (
    {label, trailing, invalid = false, style, onFocus, ...props},
    forwardedRef,
  ) => {
    const scrollIntoView = useContext(FocusedInputScrollContext);
    const inputRef = useRef<TextInput>(null);

    return (
      <View style={styles.wrapper}>
        {label !== undefined && label.length > 0 && (
          <AppText style={styles.label}>{label}</AppText>
        )}
        <View style={[styles.field, invalid && styles.invalidField]}>
          <TextInput
            {...props}
            onFocus={event => {
              onFocus?.(event);
              if (inputRef.current !== null) {
                scrollIntoView?.(inputRef.current);
              }
            }}
            placeholderTextColor={AUTH_COLORS.placeholder}
            ref={node => {
              inputRef.current = node;
              if (typeof forwardedRef === 'function') {
                forwardedRef(node);
              } else if (forwardedRef !== null) {
                forwardedRef.current = node;
              }
            }}
            selectionColor={AUTH_COLORS.primary}
            style={[styles.input, style]}
          />
          {trailing}
        </View>
      </View>
    );
  },
);

FormField.displayName = 'FormField';

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
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
});
