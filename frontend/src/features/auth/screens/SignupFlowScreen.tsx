import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useRef, useState} from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {SafeAreaView} from 'react-native-safe-area-context';

import {
  checkLoginIdAvailability,
  submitSignup,
} from '../api/mockSignupApi';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {DatePickerSheet} from '../components/DatePickerSheet';
import {FloatingIllustration} from '../components/FloatingIllustration';
import {FormField} from '../components/FormField';
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
  canSubmitSignup,
  doPasswordsMatch,
  isValidLoginId,
  isValidName,
  isValidPassword,
} from '../validation';

const PROFILE_PLACEHOLDER = require('../../../assets/images/profile-placeholder.png');
const PASSWORD_ILLUSTRATION = require('../../../assets/images/password-setup.png');
const BIRTHDATE_ILLUSTRATION = require('../../../assets/images/birthdate-calendar.png');
const MALE_ILLUSTRATION = require('../../../assets/images/gender-male.png');
const FEMALE_ILLUSTRATION = require('../../../assets/images/gender-female.png');
const COMPLETE_ILLUSTRATION = require('../../../assets/images/signup-complete-family.png');
const FAMILINK_LOGO = require('../../../assets/images/familink-logo.png');
const INITIAL_DRAFT: SignupDraft = {
  profileImageUri: null,
  name: '',
  loginId: '',
  password: '',
  passwordConfirmation: '',
  birthDate: '',
  gender: null,
};

interface SignupFlowScreenProps {
  onCancel: () => void;
  onComplete: () => void;
}

export function SignupFlowScreen({
  onCancel,
  onComplete,
}: SignupFlowScreenProps) {
  const [step, setStep] = useState<SignupStep>(1);
  const [draft, setDraft] = useState<SignupDraft>(INITIAL_DRAFT);
  const [loginIdAvailability, setLoginIdAvailability] =
    useState<LoginIdAvailability>('idle');
  const [showPasswordMismatch, setShowPasswordMismatch] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const loginIdRef = useRef(draft.loginId);
  const screenEntranceStyle = useScreenEntrance(step);

  const updateDraft = <Key extends keyof SignupDraft>(
    key: Key,
    value: SignupDraft[Key],
  ) => {
    setDraft(current => ({...current, [key]: value}));
  };

  const handleBack = () => {
    if (step === 1) {
      onCancel();
      return;
    }
    setStep(current => (current - 1) as SignupStep);
  };

  const goForward = (nextStep: SignupStep) => {
    setStep(nextStep);
  };

  const handlePickProfile = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    const selectedUri = result.assets?.[0]?.uri;
    if (selectedUri !== undefined) {
      updateDraft('profileImageUri', selectedUri);
    }
  };

  const handleCheckLoginId = async () => {
    if (!isValidLoginId(draft.loginId)) {
      return;
    }
    const checkedLoginId = draft.loginId;
    setLoginIdAvailability('checking');
    const available = await checkLoginIdAvailability(checkedLoginId);
    if (loginIdRef.current !== checkedLoginId) {
      return;
    }
    setLoginIdAvailability(available ? 'available' : 'duplicated');
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
    if (!canSubmitSignup(draft)) {
      return;
    }
    setSubmitting(true);
    try {
      await submitSignup(draft);
      goForward(5);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              onBack={handleBack}
              onChangeLoginId={value => {
                const nextLoginId = value.replace(/[^A-Za-z0-9]/g, '');
                loginIdRef.current = nextLoginId;
                updateDraft('loginId', nextLoginId);
                setLoginIdAvailability('idle');
              }}
              onChangeName={value => updateDraft('name', value)}
              onCheckLoginId={handleCheckLoginId}
              onNext={handleBasicInfoNext}
              onPickProfile={handlePickProfile}
            />
          )}
          {step === 2 && (
            <PasswordStep
              draft={draft}
              mismatch={showPasswordMismatch}
              onBack={handleBack}
              onChangeConfirmation={value => {
                updateDraft(
                  'passwordConfirmation',
                  value.replace(/[^A-Za-z0-9]/g, ''),
                );
                setShowPasswordMismatch(false);
              }}
              onChangePassword={value => {
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
              onBack={handleBack}
              onNext={() => goForward(4)}
              onOpenPicker={() => setDatePickerVisible(true)}
            />
          )}
          {step === 4 && (
            <GenderStep
              gender={draft.gender}
              loading={submitting}
              onBack={handleBack}
              onNext={handleSubmit}
              onSelect={value => updateDraft('gender', value)}
            />
          )}
          {step === 5 && (
            <CompleteStep onBack={handleBack} onComplete={onComplete} />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
      <DatePickerSheet
        onCancel={() => setDatePickerVisible(false)}
        onConfirm={value => {
          updateDraft('birthDate', value);
          setDatePickerVisible(false);
        }}
        value={draft.birthDate}
        visible={datePickerVisible}
      />
    </SafeAreaView>
  );
}

interface BasicInfoStepProps {
  availability: LoginIdAvailability;
  draft: SignupDraft;
  onBack: () => void;
  onChangeLoginId: (value: string) => void;
  onChangeName: (value: string) => void;
  onCheckLoginId: () => void;
  onNext: () => void;
  onPickProfile: () => void;
}

function BasicInfoStep({
  availability,
  draft,
  onBack,
  onChangeLoginId,
  onChangeName,
  onCheckLoginId,
  onNext,
  onPickProfile,
}: BasicInfoStepProps) {
  const canContinue =
    isValidName(draft.name) && availability === 'available';

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
      <AnimatedPressable
        accessibilityLabel="프로필 사진 선택"
        accessibilityRole="button"
        containerStyle={styles.profileContainer}
        onPress={onPickProfile}>
        <View style={styles.profileStage}>
          <Image
            resizeMode="cover"
            source={
              draft.profileImageUri === null
                ? PROFILE_PLACEHOLDER
                : {uri: draft.profileImageUri}
            }
            style={styles.profileImage}
          />
          <View style={styles.plusBadge}>
            <MaterialDesignIcons name="plus" size={26} color="#FFFFFF" />
          </View>
        </View>
      </AnimatedPressable>
      <Text style={styles.profileHint}>프로필 사진은 나중에 등록해도 돼요</Text>
      <View style={styles.basicFields}>
        <FormField
          label="이름"
          maxLength={10}
          onChangeText={onChangeName}
          placeholder="이름은 2 ~ 10자로 입력해주세요."
          value={draft.name}
        />
        <FormField
          autoCapitalize="none"
          label="아이디"
          maxLength={15}
          onChangeText={onChangeLoginId}
          placeholder="영문·숫자 5 ~ 15자로 입력해주세요."
          trailing={
            <Pressable
              accessibilityRole="button"
              disabled={
                !isValidLoginId(draft.loginId) ||
                availability === 'checking'
              }
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
      </View>
    </StepLayout>
  );
}

interface PasswordStepProps {
  draft: SignupDraft;
  mismatch: boolean;
  onBack: () => void;
  onChangeConfirmation: (value: string) => void;
  onChangePassword: (value: string) => void;
  onNext: () => void;
}

function PasswordStep({
  draft,
  mismatch,
  onBack,
  onChangeConfirmation,
  onChangePassword,
  onNext,
}: PasswordStepProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const canAttempt =
    isValidPassword(draft.password) &&
    draft.passwordConfirmation.length > 0;

  const visibilityButton = (
    <Pressable
      accessibilityLabel={
        passwordVisible ? '비밀번호 숨기기' : '비밀번호 표시'
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
          autoCapitalize="none"
          label="비밀번호"
          maxLength={16}
          onChangeText={onChangePassword}
          placeholder="영문·숫자 8 ~ 16자로 입력해주세요."
          secureTextEntry={!passwordVisible}
          trailing={visibilityButton}
          value={draft.password}
        />
        <FormField
          autoCapitalize="none"
          invalid={mismatch}
          label="비밀번호 확인"
          maxLength={16}
          onChangeText={onChangeConfirmation}
          secureTextEntry={!passwordVisible}
          trailing={visibilityButton}
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
  onBack: () => void;
  onNext: () => void;
  onOpenPicker: () => void;
}

function BirthDateStep({
  birthDate,
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
              name="calendar-month-outline"
              size={25}
            />
          </View>
        </AnimatedPressable>
      </View>
    </StepLayout>
  );
}

interface GenderStepProps {
  gender: Gender | null;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onSelect: (gender: Gender) => void;
}

function GenderStep({
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
          disabled={gender === null}
          label="다음"
          loading={loading}
          onPress={onNext}
        />
      }>
      <StepHeader
        onBack={onBack}
        step={4}
        title={'성별을\n선택해주세요'}
      />
      <View style={styles.genderRow}>
        <GenderCard
          gender="MALE"
          image={MALE_ILLUSTRATION}
          label="남자"
          onPress={onSelect}
          selected={gender === 'MALE'}
        />
        <GenderCard
          gender="FEMALE"
          image={FEMALE_ILLUSTRATION}
          label="여자"
          onPress={onSelect}
          selected={gender === 'FEMALE'}
        />
      </View>
    </StepLayout>
  );
}

interface GenderCardProps {
  gender: Gender;
  image: number;
  label: string;
  onPress: (gender: Gender) => void;
  selected: boolean;
}

function GenderCard({
  gender,
  image,
  label,
  onPress,
  selected,
}: GenderCardProps) {
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{selected}}
      containerStyle={styles.genderCardWrapper}
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
  onBack: () => void;
  onComplete: () => void;
}

function CompleteStep({onBack, onComplete}: CompleteStepProps) {
  return (
    <StepLayout
      button={<PrimaryButton label="완료" onPress={onComplete} />}>
      <StepHeader
        onBack={onBack}
        step={5}
        title={'회원가입이\n완료되었습니다!'}
      />
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

function StepLayout({children, button}: StepLayoutProps) {
  return (
    <View style={styles.step}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <View style={styles.bottomButton}>{button}</View>
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
  profileContainer: {
    alignSelf: 'center',
    marginTop: 20,
  },
  profileStage: {
    alignItems: 'center',
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
  plusBadge: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderColor: AUTH_COLORS.background,
    borderRadius: 21,
    borderWidth: 4,
    bottom: 3,
    boxShadow: '0px 5px 10px rgba(15, 23, 42, 0.22)',
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 3,
    width: 42,
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
