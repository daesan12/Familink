import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {launchImageLibrary} from 'react-native-image-picker';

import {ApiError} from '../../../shared/api';
import {useHardwareBack} from '../../../shared/hooks/useHardwareBack';
import {
  signupGateway,
  type SignupGateway,
} from '../api/signupApi';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {DatePickerSheet} from '../components/DatePickerSheet';
import {FloatingIllustration} from '../components/FloatingIllustration';
import {
  FocusedInputScrollContext,
  FormField,
} from '../components/FormField';
import {PrimaryButton} from '../components/PrimaryButton';
import {StepHeader} from '../components/StepHeader';
import {ValidationMessage} from '../components/ValidationMessage';
import {useScreenEntrance} from '../hooks/useScreenEntrance';
import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';
import type {
  Gender,
  LoginIdAvailability,
  SignupDraft,
  SignupStep,
} from '../types';
import {
  parsePickedProfileImage,
  type ProfileImageValidationError,
} from '../../profile/profileModel';
import type {ProfileImageAsset} from '../../profile/types';
import {
  canSubmitSignup,
  doPasswordsMatch,
  getPasswordRuleViolation,
  isValidLoginId,
  isValidName,
  isValidPassword,
  PASSWORD_RULE_MESSAGE,
} from '../validation';

const PROFILE_PLACEHOLDER = require('../../../assets/images/profile-placeholder.png');
const PASSWORD_ILLUSTRATION = require('../../../assets/images/password-setup.png');
const BIRTHDATE_ILLUSTRATION = require('../../../assets/images/birthdate-calendar.png');
const MALE_ILLUSTRATION = require('../../../assets/images/gender-male.png');
const FEMALE_ILLUSTRATION = require('../../../assets/images/gender-female.png');
const COMPLETE_ILLUSTRATION = require('../../../assets/images/signup-complete-family.png');
const FAMILINK_LOGO = require('../../../assets/images/familink-logo.png');
type SignupField = 'birthDate' | 'gender' | 'loginId' | 'name' | 'password';
type SignupFieldErrors = Partial<Record<SignupField, string>>;

const FIELD_ERROR_MESSAGES: Record<SignupField, string> = {
  birthDate: '생년월일을 다시 선택해주세요.',
  gender: '성별을 선택해주세요.',
  loginId: '아이디는 영문·숫자 5 ~ 15자로 입력해주세요.',
  name: '이름은 2 ~ 10자로 입력해주세요.',
  password: '비밀번호는 영문·숫자 8 ~ 16자로 입력해주세요.',
};
const FIELD_STEPS: Record<SignupField, Exclude<SignupStep, 5>> = {
  birthDate: 3,
  gender: 4,
  loginId: 1,
  name: 1,
  password: 2,
};
const NETWORK_ERROR_MESSAGE =
  '네트워크 연결을 확인하고 다시 시도해주세요.';
const SIGNUP_ERROR_MESSAGE =
  '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.';
const INITIAL_DRAFT: SignupDraft = {
  profileImageAsset: null,
  profileImageUri: null,
  name: '',
  loginId: '',
  password: '',
  passwordConfirmation: '',
  birthDate: '',
  gender: null,
};

interface SignupFlowScreenProps {
  gateway?: SignupGateway;
  onCancel: () => void;
  // 방금 가입한 로그인 ID를 전달해 로그인 화면에서 재입력을 줄인다.
  onComplete: (loginId: string, profileImageAsset?: ProfileImageAsset) => void;
}

// 생년월일 휠 첫 진입 기본값. 당해로 두면 고령 사용자가 수십 년을 스크롤해야 한다.
const BIRTHDATE_PICKER_DEFAULT = '1960-01-01';

export function SignupFlowScreen({
  gateway = signupGateway,
  onCancel,
  onComplete,
}: SignupFlowScreenProps) {
  const [step, setStep] = useState<SignupStep>(1);
  const [draft, setDraft] = useState<SignupDraft>(INITIAL_DRAFT);
  const [loginIdAvailability, setLoginIdAvailability] =
    useState<LoginIdAvailability>('idle');
  const [showPasswordMismatch, setShowPasswordMismatch] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isMountedRef = useRef(true);
  const loginIdRef = useRef(draft.loginId);
  const loginIdRequestIdRef = useRef(0);
  const submitControllerRef = useRef<AbortController | null>(null);
  const submitAttemptIdRef = useRef(0);
  const submittingRef = useRef(false);
  const screenEntranceStyle = useScreenEntrance(step);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      loginIdRequestIdRef.current += 1;
      submitControllerRef.current?.abort();
      submitAttemptIdRef.current += 1;
    };
  }, []);

  const updateDraft = <Key extends keyof SignupDraft>(
    key: Key,
    value: SignupDraft[Key],
  ) => {
    setDraft(current => ({...current, [key]: value}));
  };

  const clearFieldError = (field: SignupField) => {
    setFieldErrors(current => {
      if (current[field] === undefined) {
        return current;
      }

      const next = {...current};
      delete next[field];
      return next;
    });
    setSubmissionError(null);
  };

  const handleBack = () => {
    if (submittingRef.current) {
      return;
    }
    // 가입이 이미 끝난 완료 단계에서는 되돌아갈 입력 단계가 없다.
    if (step === 5) {
      return;
    }
    if (step === 1) {
      onCancel();
      return;
    }
    setStep(current => (current - 1) as SignupStep);
  };

  useHardwareBack(() => {
    handleBack();
    return true;
  });

  const goForward = (nextStep: SignupStep) => {
    setStep(nextStep);
  };

  const handleCheckLoginId = async () => {
    if (!isValidLoginId(draft.loginId)) {
      // 형식 미달 상태의 중복확인 탭이 무반응으로 보이지 않게 이유를 안내한다.
      loginIdRequestIdRef.current += 1;
      setLoginIdAvailability('idle');
      setFieldErrors(current => ({
        ...current,
        loginId: FIELD_ERROR_MESSAGES.loginId,
      }));
      return;
    }
    const checkedLoginId = draft.loginId;
    const requestId = loginIdRequestIdRef.current + 1;
    loginIdRequestIdRef.current = requestId;
    clearFieldError('loginId');
    setLoginIdAvailability('checking');
    try {
      const available = await gateway.checkLoginIdAvailability(checkedLoginId);
      if (
        !isMountedRef.current ||
        loginIdRequestIdRef.current !== requestId ||
        loginIdRef.current !== checkedLoginId
      ) {
        return;
      }
      setLoginIdAvailability(available ? 'available' : 'duplicated');
    } catch (error) {
      if (
        !isMountedRef.current ||
        loginIdRequestIdRef.current !== requestId ||
        loginIdRef.current !== checkedLoginId
      ) {
        return;
      }
      setLoginIdAvailability('idle');
      setFieldErrors(current => ({
        ...current,
        loginId: getLoginIdCheckErrorMessage(error),
      }));
    }
  };

  const handleBasicInfoNext = () => {
    if (
      isValidName(draft.name) &&
      loginIdAvailability === 'available'
    ) {
      goForward(2);
    }
  };

  const handlePasswordNext = () => {
    const matches = doPasswordsMatch(
      draft.password,
      draft.passwordConfirmation,
    );
    setShowPasswordMismatch(!matches);
    if (isValidPassword(draft.password) && matches) {
      goForward(3);
    }
  };

  const handleSubmit = async () => {
    if (
      submittingRef.current ||
      !canSubmitSignup(draft) ||
      draft.gender === null
    ) {
      return;
    }
    submittingRef.current = true;
    setFieldErrors({});
    setSubmissionError(null);
    setSubmitting(true);
    const controller = new AbortController();
    submitControllerRef.current?.abort();
    submitControllerRef.current = controller;
    const attemptId = submitAttemptIdRef.current + 1;
    submitAttemptIdRef.current = attemptId;
    try {
      await gateway.signup(
        {
          birthDate: draft.birthDate,
          gender: draft.gender,
          loginId: draft.loginId,
          name: draft.name,
          password: draft.password,
        },
        controller.signal,
      );
      if (
        isMountedRef.current &&
        !controller.signal.aborted &&
        submitAttemptIdRef.current === attemptId
      ) {
        goForward(5);
      }
    } catch (error) {
      if (
        isMountedRef.current &&
        !controller.signal.aborted &&
        submitAttemptIdRef.current === attemptId
      ) {
        applySignupFailure(error);
      }
    } finally {
      if (submitAttemptIdRef.current === attemptId) {
        submitControllerRef.current = null;
        submittingRef.current = false;
      }
      if (
        isMountedRef.current &&
        submitAttemptIdRef.current === attemptId
      ) {
        setSubmitting(false);
      }
    }
  };

  const applySignupFailure = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'LOGIN_ID_DUPLICATED') {
      loginIdRequestIdRef.current += 1;
      setLoginIdAvailability('duplicated');
      setStep(1);
      return;
    }

    const mappedErrors = mapSignupFieldErrors(error);
    const fields = Object.keys(mappedErrors) as SignupField[];
    if (fields.length > 0) {
      setFieldErrors(mappedErrors);
      if (mappedErrors.loginId !== undefined) {
        loginIdRequestIdRef.current += 1;
        setLoginIdAvailability('idle');
      }
      setStep(
        fields.reduce<Exclude<SignupStep, 5>>(
          (earliest, field) => Math.min(earliest, FIELD_STEPS[field]) as Exclude<SignupStep, 5>,
          4,
        ),
      );
      return;
    }

    setSubmissionError(getSignupErrorMessage(error));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}>
        <Animated.View
          style={[
            styles.flex,
            screenEntranceStyle,
          ]}>
          {step === 1 && (
            <BasicInfoStep
              availability={loginIdAvailability}
              draft={draft}
              loginIdError={fieldErrors.loginId}
              nameError={fieldErrors.name}
              onBack={handleBack}
              onChangeLoginId={value => {
                const nextLoginId = value.replace(/[^A-Za-z0-9]/g, '');
                loginIdRequestIdRef.current += 1;
                loginIdRef.current = nextLoginId;
                clearFieldError('loginId');
                updateDraft('loginId', nextLoginId);
                setLoginIdAvailability('idle');
              }}
              onChangeName={value => {
                clearFieldError('name');
                updateDraft('name', value);
              }}
              onCheckLoginId={handleCheckLoginId}
              onNext={handleBasicInfoNext}
              onPickProfileImage={async () => {
                try {
                  const result = await launchImageLibrary({
                    mediaType: 'photo',
                    restrictMimeTypes: [
                      'image/jpeg',
                      'image/png',
                      'image/webp',
                    ],
                    selectionLimit: 1,
                  });
                  if (result.didCancel) {
                    return;
                  }
                  if (result.errorCode !== undefined) {
                    Alert.alert(
                      '프로필 사진을 선택할 수 없어요',
                      result.errorMessage ?? '사진 접근 권한을 확인해 주세요.',
                    );
                    return;
                  }
                  const picked = result.assets?.[0];
                  if (picked === undefined) {
                    return;
                  }
                  const parsed = parsePickedProfileImage(picked);
                  if (parsed.error !== null) {
                    Alert.alert(
                      '프로필 사진을 사용할 수 없어요',
                      getProfileImageValidationMessage(parsed.error),
                    );
                    return;
                  }
                  updateDraft('profileImageAsset', parsed.asset);
                  updateDraft('profileImageUri', parsed.asset.uri);
                } catch {
                  Alert.alert(
                    '프로필 사진을 선택할 수 없어요',
                    '잠시 후 다시 시도해 주세요.',
                  );
                }
              }}
              onRemoveProfileImage={() => {
                updateDraft('profileImageAsset', null);
                updateDraft('profileImageUri', null);
              }}
            />
          )}
          {step === 2 && (
            <PasswordStep
              draft={draft}
              errorMessage={fieldErrors.password}
              mismatch={showPasswordMismatch}
              onBack={handleBack}
              onChangeConfirmation={value => {
                clearFieldError('password');
                updateDraft(
                  'passwordConfirmation',
                  value.replace(/[^A-Za-z0-9]/g, ''),
                );
                setShowPasswordMismatch(false);
              }}
              onChangePassword={value => {
                clearFieldError('password');
                updateDraft(
                  'password',
                  value.replace(/[^A-Za-z0-9]/g, ''),
                );
                setShowPasswordMismatch(false);
              }}
              onNext={handlePasswordNext}
            />
          )}
          {step === 3 && (
            <BirthDateStep
              birthDate={draft.birthDate}
              errorMessage={fieldErrors.birthDate}
              onBack={handleBack}
              onNext={() => goForward(4)}
              onOpenPicker={() => setDatePickerVisible(true)}
            />
          )}
          {step === 4 && (
            <GenderStep
              errorMessage={fieldErrors.gender ?? submissionError ?? undefined}
              gender={draft.gender}
              loading={submitting}
              onBack={handleBack}
              onNext={handleSubmit}
              onSelect={value => {
                clearFieldError('gender');
                updateDraft('gender', value);
              }}
            />
          )}
          {step === 5 && (
            <CompleteStep
              onComplete={() =>
                draft.profileImageAsset == null
                  ? onComplete(draft.loginId)
                  : onComplete(draft.loginId, draft.profileImageAsset)
              }
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
      <DatePickerSheet
        initialValue={BIRTHDATE_PICKER_DEFAULT}
        onCancel={() => setDatePickerVisible(false)}
        onConfirm={value => {
          clearFieldError('birthDate');
          updateDraft('birthDate', value);
          setDatePickerVisible(false);
        }}
        value={draft.birthDate}
        visible={datePickerVisible}
      />
    </SafeAreaView>
  );
}

function mapSignupFieldErrors(error: unknown): SignupFieldErrors {
  if (!(error instanceof ApiError) || error.code !== 'INVALID_REQUEST') {
    return {};
  }

  const mapped: SignupFieldErrors = {};
  error.errors.forEach(({field}) => {
    if (isSignupField(field)) {
      mapped[field] = FIELD_ERROR_MESSAGES[field];
    }
  });
  return mapped;
}

function isSignupField(field: string): field is SignupField {
  return Object.prototype.hasOwnProperty.call(FIELD_STEPS, field);
}

function getLoginIdCheckErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_REQUEST') {
      return FIELD_ERROR_MESSAGES.loginId;
    }
    if (error.code === 'NETWORK_ERROR' || error.code === 'API_TIMEOUT') {
      return NETWORK_ERROR_MESSAGE;
    }
  }
  return '아이디 중복 확인에 실패했습니다. 다시 시도해주세요.';
}

function getSignupErrorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    (error.code === 'NETWORK_ERROR' || error.code === 'API_TIMEOUT')
  ) {
    return NETWORK_ERROR_MESSAGE;
  }
  return SIGNUP_ERROR_MESSAGE;
}

function getProfileImageValidationMessage(
  error: ProfileImageValidationError,
): string {
  switch (error) {
    case 'size':
      return '프로필 사진은 10MB 이하만 사용할 수 있어요.';
    case 'type':
      return 'JPEG, PNG, WebP 사진만 사용할 수 있어요.';
    default:
      return '사진 정보를 읽을 수 없어요. 다른 사진을 선택해 주세요.';
  }
}

interface BasicInfoStepProps {
  availability: LoginIdAvailability;
  draft: SignupDraft;
  loginIdError?: string;
  nameError?: string;
  onBack: () => void;
  onChangeLoginId: (value: string) => void;
  onChangeName: (value: string) => void;
  onCheckLoginId: () => void;
  onNext: () => void;
  onPickProfileImage: () => void;
  onRemoveProfileImage: () => void;
}

function BasicInfoStep({
  availability,
  draft,
  loginIdError,
  nameError,
  onBack,
  onChangeLoginId,
  onChangeName,
  onCheckLoginId,
  onNext,
  onPickProfileImage,
  onRemoveProfileImage,
}: BasicInfoStepProps) {
  const canContinue =
    isValidName(draft.name) && availability === 'available';
  // 이름에서 키보드 "다음" 키를 누르면 아이디 입력으로 포커스를 넘긴다.
  const loginIdInputRef = useRef<TextInput>(null);

  return (
    <StepLayout
      button={
        <PrimaryButton
          disabled={!canContinue}
          label="다음"
          onPress={onNext}
        />
      }>
      <StepHeader
        onBack={onBack}
        step={1}
        title={'기본 정보를\n입력해주세요'}
      />
      <View style={styles.profileStageContainer}>
        <Pressable
          accessibilityLabel="프로필 사진 선택"
          accessibilityRole="button"
          onPress={onPickProfileImage}
          style={styles.profileStage}>
          <Image
            resizeMode="cover"
            source={
              draft.profileImageUri
                ? {uri: draft.profileImageUri}
                : PROFILE_PLACEHOLDER
            }
            style={styles.profileImage}
          />
          <View style={styles.profileImageBadge}>
            <MaterialDesignIcons
              color="#FFFFFF"
              name={draft.profileImageUri ? 'pencil' : 'camera-plus'}
              size={18}
            />
          </View>
        </Pressable>
        {draft.profileImageUri && (
          <Pressable
            accessibilityLabel="선택한 프로필 사진 삭제"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRemoveProfileImage}
            style={styles.profileImageRemove}>
            <MaterialDesignIcons color="#FFFFFF" name="close" size={14} />
          </Pressable>
        )}
      </View>
      <Text style={styles.profileHint}>
        {'선택 사항 · 가입 후 마이페이지에서 다시 등록할 수 있어요'}
      </Text>
      <View style={styles.basicFields}>
        <FormField
          accessibilityLabel="회원가입 이름"
          invalid={nameError !== undefined}
          label="이름"
          maxLength={10}
          onChangeText={onChangeName}
          onSubmitEditing={() => loginIdInputRef.current?.focus()}
          placeholder="이름은 2 ~ 10자로 입력해주세요."
          returnKeyType="next"
          submitBehavior="submit"
          value={draft.name}
        />
        {nameError !== undefined && (
          <ValidationMessage message={nameError} variant="error" />
        )}
        <FormField
          accessibilityLabel="회원가입 아이디"
          autoCapitalize="none"
          invalid={
            loginIdError !== undefined || availability === 'duplicated'
          }
          label="아이디"
          maxLength={15}
          onChangeText={onChangeLoginId}
          placeholder="영문·숫자 5 ~ 15자로 입력해주세요."
          ref={loginIdInputRef}
          returnKeyType="done"
          trailing={
            <Pressable
              accessibilityLabel="아이디 중복 확인"
              accessibilityRole="button"
              // 형식 미달이어도 탭을 받아 이유를 안내한다. 확인 중에만 잠근다.
              disabled={availability === 'checking'}
              hitSlop={6}
              onPress={onCheckLoginId}
              style={styles.duplicateButton}>
              <Text style={styles.duplicateButtonText}>
                {availability === 'checking' ? '확인 중' : '중복확인'}
              </Text>
            </Pressable>
          }
          value={draft.loginId}
        />
        {availability === 'available' && (
          <ValidationMessage
            message="사용 가능한 아이디입니다"
            variant="success"
          />
        )}
        {availability === 'duplicated' && (
          <ValidationMessage
            message="사용이 불가능한 아이디입니다"
            variant="error"
          />
        )}
        {loginIdError !== undefined && (
          <ValidationMessage message={loginIdError} variant="error" />
        )}
      </View>
    </StepLayout>
  );
}

interface PasswordStepProps {
  draft: SignupDraft;
  errorMessage?: string;
  mismatch: boolean;
  onBack: () => void;
  onChangeConfirmation: (value: string) => void;
  onChangePassword: (value: string) => void;
  onNext: () => void;
}

function PasswordStep({
  draft,
  errorMessage,
  mismatch,
  onBack,
  onChangeConfirmation,
  onChangePassword,
  onNext,
}: PasswordStepProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] =
    useState(false);
  // 비밀번호에서 키보드 "다음" 키를 누르면 비밀번호 확인으로 포커스를 넘긴다.
  const confirmationInputRef = useRef<TextInput>(null);
  const canAttempt =
    isValidPassword(draft.password) &&
    draft.passwordConfirmation.length > 0;
  // 입력 중 규칙 위반 이유를 바로 안내해 "다음" 비활성의 원인을 알 수 있게 한다.
  const passwordViolation = getPasswordRuleViolation(draft.password);

  const passwordVisibilityButton = (
    <Pressable
      accessibilityLabel={
        passwordVisible
          ? '회원가입 비밀번호 숨기기'
          : '회원가입 비밀번호 표시'
      }
      hitSlop={10}
      onPress={() => setPasswordVisible(current => !current)}>
      <MaterialDesignIcons
        color={AUTH_COLORS.placeholder}
        name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
        size={22}
      />
    </Pressable>
  );
  const passwordConfirmationVisibilityButton = (
    <Pressable
      accessibilityLabel={
        passwordConfirmationVisible
          ? '회원가입 비밀번호 확인 숨기기'
          : '회원가입 비밀번호 확인 표시'
      }
      hitSlop={10}
      onPress={() => setPasswordConfirmationVisible(current => !current)}>
      <MaterialDesignIcons
        color={AUTH_COLORS.placeholder}
        name={
          passwordConfirmationVisible ? 'eye-off-outline' : 'eye-outline'
        }
        size={22}
      />
    </Pressable>
  );

  return (
    <StepLayout
      button={
        <PrimaryButton disabled={!canAttempt} label="다음" onPress={onNext} />
      }>
      <StepHeader
        onBack={onBack}
        step={2}
        title={'비밀번호를\n설정해주세요'}
      />
      <ArtworkStage
        accessibilityIgnoresInvertColors
        source={PASSWORD_ILLUSTRATION}
      />
      <View style={styles.passwordFields}>
        <FormField
          accessibilityLabel="회원가입 비밀번호"
          autoCapitalize="none"
          invalid={errorMessage !== undefined || passwordViolation !== null}
          label="비밀번호"
          maxLength={16}
          onChangeText={onChangePassword}
          onSubmitEditing={() => confirmationInputRef.current?.focus()}
          placeholder="영문·숫자 8 ~ 16자로 입력해주세요."
          returnKeyType="next"
          secureTextEntry={!passwordVisible}
          submitBehavior="submit"
          trailing={passwordVisibilityButton}
          value={draft.password}
        />
        {errorMessage !== undefined ? (
          <ValidationMessage message={errorMessage} variant="error" />
        ) : passwordViolation !== null ? (
          <ValidationMessage message={passwordViolation} variant="error" />
        ) : (
          <Text style={styles.passwordRuleHint}>{PASSWORD_RULE_MESSAGE}</Text>
        )}
        <FormField
          accessibilityLabel="회원가입 비밀번호 확인"
          autoCapitalize="none"
          invalid={mismatch}
          label="비밀번호 확인"
          maxLength={16}
          onChangeText={onChangeConfirmation}
          ref={confirmationInputRef}
          returnKeyType="done"
          secureTextEntry={!passwordConfirmationVisible}
          trailing={passwordConfirmationVisibilityButton}
          value={draft.passwordConfirmation}
        />
        {mismatch && (
          <ValidationMessage
            message="비밀번호가 일치하지 않습니다"
            variant="error"
          />
        )}
      </View>
    </StepLayout>
  );
}

interface BirthDateStepProps {
  birthDate: string;
  errorMessage?: string;
  onBack: () => void;
  onNext: () => void;
  onOpenPicker: () => void;
}

function BirthDateStep({
  birthDate,
  errorMessage,
  onBack,
  onNext,
  onOpenPicker,
}: BirthDateStepProps) {
  return (
    <StepLayout
      button={
        <PrimaryButton
          disabled={birthDate.length === 0}
          label="다음"
          onPress={onNext}
        />
      }>
      <StepHeader
        onBack={onBack}
        step={3}
        title={'생년월일을\n선택해주세요'}
      />
      <ArtworkStage source={BIRTHDATE_ILLUSTRATION} />
      <View style={styles.birthdateField}>
        <Text style={styles.fieldLabel}>생년월일</Text>
        <AnimatedPressable
          accessibilityLabel="생년월일 선택"
          accessibilityRole="button"
          onPress={onOpenPicker}>
          <View style={styles.dateButton}>
            <Text
              style={[
                styles.dateText,
                birthDate.length === 0 && styles.datePlaceholder,
              ]}>
              {birthDate || 'YYYY-MM-DD'}
            </Text>
            <MaterialDesignIcons
              color={AUTH_COLORS.primary}
              name="calendar-blank-outline"
              size={25}
            />
          </View>
        </AnimatedPressable>
        {errorMessage !== undefined && (
          <ValidationMessage message={errorMessage} variant="error" />
        )}
      </View>
    </StepLayout>
  );
}

interface GenderStepProps {
  errorMessage?: string;
  gender: Gender | null;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onSelect: (gender: Gender) => void;
}

function GenderStep({
  errorMessage,
  gender,
  loading,
  onBack,
  onNext,
  onSelect,
}: GenderStepProps) {
  return (
    <StepLayout
      button={
        <PrimaryButton
          disabled={gender === null || loading}
          label="다음"
          loading={loading}
          onPress={onNext}
        />
      }>
      <StepHeader
        backDisabled={loading}
        onBack={onBack}
        step={4}
        title={'성별을\n선택해주세요'}
      />
      <View style={styles.genderRow}>
        <GenderCard
          disabled={loading}
          gender="MALE"
          image={MALE_ILLUSTRATION}
          label="남자"
          onPress={onSelect}
          selected={gender === 'MALE'}
        />
        <GenderCard
          disabled={loading}
          gender="FEMALE"
          image={FEMALE_ILLUSTRATION}
          label="여자"
          onPress={onSelect}
          selected={gender === 'FEMALE'}
        />
      </View>
      {errorMessage !== undefined && (
        <ValidationMessage message={errorMessage} variant="error" />
      )}
    </StepLayout>
  );
}

interface GenderCardProps {
  disabled?: boolean;
  gender: Gender;
  image: number;
  label: string;
  onPress: (gender: Gender) => void;
  selected: boolean;
}

function GenderCard({
  disabled = false,
  gender,
  image,
  label,
  onPress,
  selected,
}: GenderCardProps) {
  return (
    <AnimatedPressable
      accessibilityLabel={`성별 ${label}`}
      accessibilityRole="radio"
      accessibilityState={{disabled, selected}}
      containerStyle={styles.genderCardWrapper}
      disabled={disabled}
      onPress={() => onPress(gender)}>
      <View style={[styles.genderCard, selected && styles.selectedGenderCard]}>
        <Image resizeMode="contain" source={image} style={styles.genderImage} />
      </View>
      <Text style={[styles.genderLabel, selected && styles.selectedGenderLabel]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

interface CompleteStepProps {
  onComplete: () => void;
}

function CompleteStep({onComplete}: CompleteStepProps) {
  return (
    <StepLayout
      button={<PrimaryButton label="완료" onPress={onComplete} />}>
      {/* 가입이 끝난 단계이므로 이전 단계로 돌아가는 경로를 두지 않는다. */}
      <StepHeader step={5} title={'회원가입이\n완료되었습니다!'} />
      <View style={styles.completeArtwork}>
        <FloatingIllustration
          containerStyle={styles.completeFloating}
          groundShadowStyle={styles.completeGroundShadow}
          source={COMPLETE_ILLUSTRATION}
          style={styles.completeFamily}
        />
        <Image
          accessibilityLabel="Familink"
          resizeMode="contain"
          source={FAMILINK_LOGO}
          style={styles.completeLogo}
        />
      </View>
    </StepLayout>
  );
}

interface ArtworkStageProps {
  accessibilityIgnoresInvertColors?: boolean;
  source: number;
}

function ArtworkStage({
  accessibilityIgnoresInvertColors,
  source,
}: ArtworkStageProps) {
  return (
    <View style={styles.artworkStage}>
      <FloatingIllustration
        accessibilityIgnoresInvertColors={accessibilityIgnoresInvertColors}
        groundShadowStyle={styles.artworkGroundShadow}
        source={source}
        style={styles.mainIllustration}
      />
    </View>
  );
}

interface StepLayoutProps {
  children: React.ReactNode;
  button: React.ReactNode;
}

// KeyboardAvoidingView 패딩이 자리 잡은 뒤 측정해야 가려짐 판정이 정확하다.
// 기기에 따라 정착 시점이 달라 두 번 측정한다. 두 번째 시도는 이미 보이면 아무것도 하지 않는다.
const FOCUS_SCROLL_ATTEMPT_DELAYS_MS = [150, 600];
const FOCUS_SCROLL_MARGIN = 16;

function StepLayout({children, button}: StepLayoutProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  // 하단 버튼은 absolute로 ScrollView 위에 겹치므로, 가려짐 판정에서 그 높이를 빼야 한다.
  const buttonAreaHeightRef = useRef(0);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const keyboardSubscriptionRef = useRef<ReturnType<
    typeof Keyboard.addListener
  > | null>(null);

  // 이전 포커스가 남긴 시도가 다음 포커스나 사용자 스크롤을 되돌리지 않도록 정리한다.
  const clearPendingScroll = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    keyboardSubscriptionRef.current?.remove();
    keyboardSubscriptionRef.current = null;
  }, []);

  useEffect(() => clearPendingScroll, [clearPendingScroll]);

  // 포커스된 입력칸이 키보드·하단 버튼에 가려지면 보이는 위치까지 스크롤한다.
  const scrollInputIntoView = useCallback((input: TextInput) => {
    clearPendingScroll();
    const measureAndScroll = () => {
      const scrollView = scrollViewRef.current;
      const scrollHost = scrollView?.getNativeScrollRef();
      if (scrollView === null || scrollHost == null) {
        return;
      }
      input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
        scrollHost.measureInWindow(
          (_scrollX, scrollY, _scrollWidth, scrollHeight) => {
            const visibleBottom =
              scrollY +
              scrollHeight -
              buttonAreaHeightRef.current -
              FOCUS_SCROLL_MARGIN;
            const inputBottom = inputY + inputHeight;
            if (inputBottom > visibleBottom) {
              scrollView.scrollTo({
                animated: true,
                y: scrollOffsetRef.current + (inputBottom - visibleBottom),
              });
            }
          },
        );
      });
    };

    const scheduleAttempts = () => {
      FOCUS_SCROLL_ATTEMPT_DELAYS_MS.forEach(delay => {
        pendingTimersRef.current.push(setTimeout(measureAndScroll, delay));
      });
    };

    // 키보드가 이미 떠 있으면 바로 측정한다. 단 "떠 있지만 내려가는 중"(스텝 전환 직후 등)일 수
    // 있으므로, 아래 리스너도 함께 걸어 키보드가 다시 올라오는 시점에도 측정한다.
    if (Keyboard.isVisible()) {
      scheduleAttempts();
    }
    // 키보드 표시 완료 시점에 맞춰 측정한다.
    // 키보드가 끝내 뜨지 않으면 리스너는 다음 포커스나 언마운트 때 정리된다.
    keyboardSubscriptionRef.current = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        keyboardSubscriptionRef.current?.remove();
        keyboardSubscriptionRef.current = null;
        scheduleAttempts();
      },
    );
  }, [clearPendingScroll]);

  return (
    <View style={styles.step}>
      <FocusedInputScrollContext.Provider value={scrollInputIntoView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScroll={event => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          ref={scrollViewRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </FocusedInputScrollContext.Provider>
      <View
        onLayout={event => {
          buttonAreaHeightRef.current = event.nativeEvent.layout.height;
        }}
        style={styles.bottomButton}>
        {button}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: AUTH_COLORS.background,
    flex: 1,
  },
  step: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 128,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
  },
  bottomButton: {
    backgroundColor: AUTH_COLORS.background,
    bottom: 0,
    left: AUTH_LAYOUT.horizontalPadding,
    paddingBottom: 24,
    paddingTop: 16,
    position: 'absolute',
    right: AUTH_LAYOUT.horizontalPadding,
  },
  profileStageContainer: {
    alignSelf: 'center',
    height: 160,
    marginTop: 20,
    position: 'relative',
    width: 160,
  },
  profileStage: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: AUTH_COLORS.background,
    borderColor: '#C7BBFF',
    borderRadius: 80,
    borderWidth: 3,
    boxShadow: '0px 7px 14px rgba(102, 83, 188, 0.12)',
    height: 160,
    justifyContent: 'center',
    padding: 3,
    width: 160,
  },
  profileImage: {
    borderColor: AUTH_COLORS.background,
    borderRadius: 74,
    borderWidth: 1,
    height: 148,
    width: 148,
  },
  profileImageBadge: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.primary,
    borderColor: AUTH_COLORS.background,
    borderRadius: 16,
    borderWidth: 2,
    bottom: 4,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 32,
  },
  profileImageRemove: {
    alignItems: 'center',
    backgroundColor: '#454957',
    borderColor: AUTH_COLORS.background,
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 24,
  },
  profileHint: {
    color: AUTH_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    textAlign: 'center',
  },
  basicFields: {
    gap: 10,
    marginTop: 12,
  },
  duplicateButton: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.primary,
    borderRadius: 18,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  duplicateButtonText: {
    color: AUTH_COLORS.background,
    fontSize: 12,
    fontWeight: '700',
  },
  mainIllustration: {
    height: 220,
    width: 220,
  },
  artworkStage: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 235,
    justifyContent: 'center',
    marginTop: 8,
    position: 'relative',
    width: 240,
  },
  artworkGroundShadow: {
    bottom: 25,
    height: 34,
    position: 'absolute',
    width: 104,
  },
  passwordFields: {
    gap: 10,
    marginTop: 20,
  },
  passwordRuleHint: {
    color: AUTH_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  birthdateField: {
    gap: 8,
    marginTop: 24,
  },
  fieldLabel: {
    color: AUTH_COLORS.muted,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.surfaceRaised,
    borderColor: AUTH_COLORS.hairline,
    borderRadius: AUTH_LAYOUT.fieldRadius,
    borderWidth: 1,
    boxShadow: '0px 4px 10px rgba(74, 66, 112, 0.05)',
    flexDirection: 'row',
    height: AUTH_LAYOUT.fieldHeight,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  dateText: {
    color: AUTH_COLORS.black,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  datePlaceholder: {
    color: AUTH_COLORS.placeholder,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 56,
  },
  genderCardWrapper: {
    flex: 1,
  },
  genderCard: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.surfaceRaised,
    borderColor: AUTH_COLORS.hairline,
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0px 9px 20px rgba(74, 66, 112, 0.10)',
    height: 168,
    justifyContent: 'center',
  },
  selectedGenderCard: {
    backgroundColor: AUTH_COLORS.surfaceTint,
    borderColor: AUTH_COLORS.primary,
    borderWidth: 2,
    boxShadow: '0px 12px 24px rgba(143, 125, 245, 0.20)',
  },
  genderImage: {
    height: 132,
    width: 132,
  },
  genderLabel: {
    color: AUTH_COLORS.muted,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  selectedGenderLabel: {
    color: AUTH_COLORS.primary,
  },
  completeArtwork: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingBottom: 8,
    paddingTop: 4,
    position: 'relative',
    width: 300,
  },
  completeGroundShadow: {
    bottom: 22,
    height: 42,
    position: 'absolute',
    width: 148,
  },
  completeFloating: {
    height: 260,
    width: 300,
  },
  completeFamily: {
    height: 236,
    width: 236,
  },
  completeLogo: {
    height: 100,
    marginTop: -30,
    width: 100,
  },
});
