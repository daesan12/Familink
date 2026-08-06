import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {ApiError} from '../../../shared/api';
import type {LoginCredentials} from '../types';
import {canSubmitLogin, SIGNUP_LIMITS} from '../validation';
import {COLORS} from '../../../design/tokens';
import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';
import {AnimatedPressable} from './AnimatedPressable';
import {DraggableBottomSheet} from '../../../shared/components/DraggableBottomSheet';
import {FormField} from './FormField';
import {PrimaryButton} from './PrimaryButton';
import {ValidationMessage} from './ValidationMessage';

const INITIAL_CREDENTIALS: LoginCredentials = {
  loginId: '',
  password: '',
};

interface LoginBottomSheetProps {
  // 시트가 열릴 때 미리 채울 로그인 ID(예: 방금 가입한 계정).
  initialLoginId?: string;
  onDismiss: () => void;
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  visible: boolean;
}

export function LoginBottomSheet({
  initialLoginId,
  onDismiss,
  onLogin,
  visible,
}: LoginBottomSheetProps) {
  // 아이디가 미리 채워져 있으면 다음 입력인 비밀번호로 포커스를 보낸다.
  const hasPrefilledLoginId =
    initialLoginId !== undefined && initialLoginId.length > 0;
  const [credentials, setCredentials] =
    useState<LoginCredentials>(INITIAL_CREDENTIALS);
  const [loginIdTouched, setLoginIdTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setCredentials(
      initialLoginId === undefined || initialLoginId.length === 0
        ? INITIAL_CREDENTIALS
        : {loginId: initialLoginId, password: ''},
    );
    setLoginIdTouched(false);
    setPasswordTouched(false);
    setPasswordVisible(false);
    setLoginError(null);
    setSubmitting(false);
    submittingRef.current = false;
  }, [initialLoginId, visible]);


  const loginIdInvalid =
    loginIdTouched &&
    (credentials.loginId.trim().length === 0 ||
      credentials.loginId.length > SIGNUP_LIMITS.loginIdMax);
  const passwordInvalid =
    passwordTouched &&
    (credentials.password.trim().length === 0 ||
      credentials.password.length > SIGNUP_LIMITS.passwordMax);
  const canLogin = canSubmitLogin(credentials);

  const handleDismiss = () => {
    if (submittingRef.current) {
      return;
    }
    onDismiss();
  };

  const handleRequestClose = () => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    handleDismiss();
  };

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    setLoginIdTouched(true);
    setPasswordTouched(true);

    if (!canLogin) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setLoginError(null);
    try {
      await onLogin(credentials);
    } catch (error) {
      setLoginError(
        error instanceof ApiError
          ? error.message
          : '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <DraggableBottomSheet
      accessibilityLabel="로그인 입력 바텀시트"
      backdropVisible={false}
      dismissDisabled={submitting}
      onClose={handleRequestClose}
      sheetStyle={styles.sheet}
      visible={visible}>
        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={styles.keyboardArea}>
            <ScrollView
              contentContainerStyle={[
                styles.content,
                {paddingBottom: Math.max(insets.bottom, 24)},
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <AnimatedPressable
                accessibilityLabel="로그인 닫기"
                accessibilityRole="button"
                containerStyle={styles.backButtonContainer}
                disabled={submitting}
                hitSlop={8}
                onPress={handleDismiss}>
                <View style={styles.backButton}>
                  <MaterialDesignIcons
                    color={COLORS.purpleDeep}
                    name="chevron-left"
                    size={28}
                  />
                </View>
              </AnimatedPressable>

              <View style={styles.fields}>
                <FormField
                  accessibilityLabel="로그인 아이디"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  autoFocus={!hasPrefilledLoginId}
                  editable={!submitting}
                  invalid={loginIdInvalid}
                  maxLength={SIGNUP_LIMITS.loginIdMax}
                  onBlur={() => setLoginIdTouched(true)}
                  onChangeText={value => {
                    setCredentials(current => ({
                      ...current,
                      loginId: value,
                    }));
                    setLoginError(null);
                  }}
                  placeholder="아이디"
                  returnKeyType="next"
                  value={credentials.loginId}
                />
                {loginIdInvalid && (
                  <ValidationMessage
                    message={
                      credentials.loginId.trim().length === 0
                        ? '아이디를 입력해주세요.'
                        : `아이디는 ${SIGNUP_LIMITS.loginIdMax}자 이내로 입력해주세요.`
                    }
                    variant="error"
                  />
                )}
                <FormField
                  accessibilityLabel="로그인 비밀번호"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  autoCorrect={false}
                  autoFocus={hasPrefilledLoginId}
                  editable={!submitting}
                  invalid={passwordInvalid}
                  maxLength={SIGNUP_LIMITS.passwordMax}
                  onBlur={() => setPasswordTouched(true)}
                  onChangeText={value => {
                    setCredentials(current => ({
                      ...current,
                      password: value,
                    }));
                    setLoginError(null);
                  }}
                  onSubmitEditing={handleSubmit}
                  placeholder="비밀번호"
                  returnKeyType="done"
                  secureTextEntry={!passwordVisible}
                  trailing={
                    <AnimatedPressable
                      accessibilityLabel={
                        passwordVisible
                          ? '비밀번호 숨기기'
                          : '비밀번호 표시'
                      }
                      accessibilityRole="button"
                      containerStyle={styles.visibilityButton}
                      disabled={submitting}
                      hitSlop={8}
                      onPress={() =>
                        setPasswordVisible(current => !current)
                      }>
                      <MaterialDesignIcons
                        color={AUTH_COLORS.muted}
                        name={passwordVisible ? 'eye-off' : 'eye'}
                        size={22}
                      />
                    </AnimatedPressable>
                  }
                  value={credentials.password}
                />
                {passwordInvalid && (
                  <ValidationMessage
                    message={
                      credentials.password.trim().length === 0
                        ? '비밀번호를 입력해주세요.'
                        : `비밀번호는 ${SIGNUP_LIMITS.passwordMax}자 이내로 입력해주세요.`
                    }
                    variant="error"
                  />
                )}
                {loginError !== null && (
                  <ValidationMessage
                    message={loginError}
                    variant="error"
                  />
                )}
              </View>

              <View style={styles.submit}>
                <PrimaryButton
                  disabled={!canLogin}
                  label="로그인"
                  loading={submitting}
                  onPress={handleSubmit}
                  tone="lavender"
                />
              </View>
            </ScrollView>
        </KeyboardAvoidingView>
    </DraggableBottomSheet>
  );
}

const styles = StyleSheet.create({
  keyboardArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AUTH_COLORS.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: '0px -10px 28px rgba(15, 23, 42, 0.12)',
    maxHeight: '78%',
    minHeight: 360,
    overflow: 'hidden',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
    paddingTop: 22,
  },
  backButtonContainer: {
    alignSelf: 'flex-start',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  fields: {
    gap: 8,
    marginTop: 26,
  },
  visibilityButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  submit: {
    marginTop: 28,
  },
});
