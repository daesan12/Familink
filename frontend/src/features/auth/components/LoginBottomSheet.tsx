import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {ApiError} from '../../../shared/api';
import type {LoginCredentials} from '../types';
import {canSubmitLogin} from '../validation';
import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';
import {AnimatedPressable} from './AnimatedPressable';
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
  const [reduceMotion, setReduceMotion] = useState(false);
  const submittingRef = useRef(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => subscription.remove();
  }, []);

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

  useEffect(() => {
    if (!visible) {
      return;
    }

    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(reduceMotion ? 0 : 32);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: reduceMotion ? 120 : 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        duration: reduceMotion ? 0 : 260,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    backdropOpacity,
    reduceMotion,
    sheetTranslateY,
    visible,
  ]);

  const loginIdInvalid =
    loginIdTouched && credentials.loginId.trim().length === 0;
  const passwordInvalid =
    passwordTouched && credentials.password.trim().length === 0;
  const canLogin = canSubmitLogin(credentials);

  const handleDismiss = () => {
    if (submittingRef.current) {
      return;
    }
    onDismiss();
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

  if (!visible) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View accessibilityViewIsModal style={styles.modal}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, {opacity: backdropOpacity}]}
        />
        <Pressable
          accessibilityElementsHidden
          disabled={submitting}
          importantForAccessibility="no-hide-descendants"
          onPress={handleDismiss}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
          style={styles.keyboardArea}>
          <Animated.View
            style={[
              styles.sheet,
              {transform: [{translateY: sheetTranslateY}]},
            ]}>
            <ScrollView
              contentContainerStyle={styles.content}
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
                    color={AUTH_COLORS.background}
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
                    message="아이디를 입력해주세요."
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
                    message="비밀번호를 입력해주세요."
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
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  keyboardArea: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 1,
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
    paddingBottom: 24,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
    paddingTop: 22,
  },
  backButtonContainer: {
    alignSelf: 'flex-start',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
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
