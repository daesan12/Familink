import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useEffect,
  useRef,
  useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';

import {COLORS, FONT_FAMILY} from '../../../design/tokens';
import {useHardwareBack} from '../../../shared/hooks/useHardwareBack';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';

const FAMILINK_LOGO = require('../../../assets/images/familink-logo.png');

const MAX_INTERESTS = 10;
const MAX_INTEREST_LENGTH = 10;
const EMPTY_INTERESTS: readonly string[] = [];

export const PRESET_INTERESTS: readonly string[] = [
  '가족과 일상',
  '음식과 요리',
  '여행과 나들이',
  '텃밭과 식물',
  '산책과 운동',
  '반려동물',
  '음악',
  'TV와 방송',
  '영화와 공연',
  '스포츠',
  '역사와 추억',
  '종교와 마음',
  '취미와 여가',
  '뉴스와 세상 이야기',
  '독서',
  '배움과 새로운 도전',
  '우리 동네 이야기',
];

export interface InterestSavedContent {
  title: string;
  message: string;
  buttonLabel: string;
}

// 온보딩 회원가입 흐름의 저장 완료 문구(기본값).
const ONBOARDING_SAVED_CONTENT: InterestSavedContent = {
  title: '관심사 설정 완료',
  message: '선택한 관심사가 저장되었어요.\n가족 피드에서 다시 만나요!',
  buttonLabel: '피드로 이동',
};

export interface InterestSelectionScreenProps {
  getSaveErrorMessage?: (error: unknown) => string;
  initialInterests?: readonly string[];
  onBack: () => void;
  onComplete: () => void;
  onSave: (interests: readonly string[]) => Promise<void> | void;
  // 온보딩처럼 나중에 채울 수 있는 진입 경로에서만 넘긴다.
  // 이미 가입을 마친 사용자의 관심사 설정(J-4)에서는 넘기지 않아 버튼을 숨긴다.
  onSkip?: () => void;
  // 저장 완료 모달 문구. 온보딩과 마이페이지(J-4p)에서 다르게 쓴다.
  savedContent?: InterestSavedContent;
  // AppShell 하위 화면으로 임베드할 때는 자체 SafeAreaView를 끄고 부모 인셋을 따른다.
  embedded?: boolean;
}

export function InterestSelectionScreen({
  getSaveErrorMessage = () =>
    '관심사를 저장하지 못했어요. 다시 시도해주세요.',
  initialInterests = EMPTY_INTERESTS,
  onBack,
  onComplete,
  onSave,
  onSkip,
  savedContent = ONBOARDING_SAVED_CONTENT,
  embedded = false,
}: InterestSelectionScreenProps) {
  const normalizedInitialInterests = normalizeInterests(initialInterests);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    normalizedInitialInterests,
  );
  const [customInterests, setCustomInterests] = useState<string[]>(
    normalizedInitialInterests.filter(
      interest => !PRESET_INTERESTS.includes(interest),
    ),
  );
  const [customInputVisible, setCustomInputVisible] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useHardwareBack(() => {
    if (saving) {
      return true;
    }
    onBack();
    return true;
  });
  const hasLocalChangesRef = useRef(false);
  const savingRef = useRef(false);
  const displayedInterests = [...PRESET_INTERESTS, ...customInterests];

  useEffect(() => {
    if (hasLocalChangesRef.current) {
      return;
    }

    const normalized = normalizeInterests(initialInterests);
    setSelectedInterests(normalized);
    setCustomInterests(
      normalized.filter(
        interest => !PRESET_INTERESTS.includes(interest),
      ),
    );
  }, [initialInterests]);

  const handleToggleInterest = (interest: string) => {
    hasLocalChangesRef.current = true;
    setErrorMessage(null);
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(current =>
        current.filter(item => item !== interest),
      );
      return;
    }

    if (selectedInterests.length >= MAX_INTERESTS) {
      setErrorMessage('관심사는 최대 10개까지 선택할 수 있어요.');
      return;
    }

    setSelectedInterests(current => [...current, interest]);
  };

  const handleAddCustomInterest = (interest: string) => {
    hasLocalChangesRef.current = true;
    setErrorMessage(null);

    if (selectedInterests.includes(interest)) {
      setErrorMessage('이미 선택한 관심사예요.');
      return false;
    }

    if (selectedInterests.length >= MAX_INTERESTS) {
      setErrorMessage('관심사는 최대 10개까지 선택할 수 있어요.');
      return false;
    }

    if (
      !PRESET_INTERESTS.includes(interest) &&
      !customInterests.includes(interest)
    ) {
      setCustomInterests(current => [...current, interest]);
    }
    setSelectedInterests(current => [...current, interest]);
    return true;
  };

  const handleSave = async () => {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setErrorMessage(null);
    setSaving(true);
    try {
      await onSave(selectedInterests);
      setSavedVisible(true);
    } catch (error) {
      setErrorMessage(getSaveErrorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const Container = embedded ? View : SafeAreaView;

  return (
    <Container style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <AnimatedPressable
            accessibilityLabel="관심사 설정에서 뒤로 가기"
            accessibilityRole="button"
            containerStyle={styles.backButtonContainer}
            hitSlop={8}
            onPress={onBack}>
            <View style={styles.backButton}>
              <MaterialDesignIcons
                color={COLORS.purpleDeep}
                name="chevron-left"
                size={28}
              />
            </View>
          </AnimatedPressable>
          <Image
            accessibilityLabel="Familink"
            resizeMode="contain"
            source={FAMILINK_LOGO}
            style={styles.logo}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <AppText style={styles.title}>관심사를 선택해주세요</AppText>
          <AppText style={styles.description}>
            {'AI 안부전화와 대화 주제를 위해\n관심사를 최대 10개까지 선택해주세요.'}
          </AppText>

          <View style={styles.chipList}>
            {displayedInterests.map(interest => (
              <InterestChip
                interest={interest}
                key={interest}
                onPress={() => handleToggleInterest(interest)}
                selected={selectedInterests.includes(interest)}
              />
            ))}
            <AnimatedPressable
              accessibilityLabel="관심사 직접 입력"
              accessibilityRole="button"
              onPress={() => {
                setErrorMessage(null);
                setCustomInputVisible(true);
              }}>
              <View style={styles.chip}>
                <MaterialDesignIcons
                  color={AUTH_COLORS.body}
                  name="plus"
                  size={18}
                />
                <AppText style={styles.chipLabel}>직접 입력</AppText>
              </View>
            </AnimatedPressable>
          </View>

          <View
            accessibilityLiveRegion="polite"
            style={styles.feedbackArea}>
            {errorMessage !== null && !customInputVisible && (
              <AppText style={styles.errorMessage}>{errorMessage}</AppText>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {onSkip !== undefined ? (
            <AnimatedPressable
              accessibilityLabel="관심사 설정 건너뛰기"
              accessibilityRole="button"
              containerStyle={styles.skipButton}
              disabled={saving}
              onPress={onSkip}>
              <View style={styles.skipContent}>
                <AppText style={styles.skipLabel}>건너뛰기</AppText>
                <MaterialDesignIcons
                  color={AUTH_COLORS.placeholder}
                  name="arrow-right"
                  size={22}
                />
              </View>
            </AnimatedPressable>
          ) : null}

          <AnimatedPressable
            accessibilityLabel="관심사 저장하고 다음"
            accessibilityRole="button"
            accessibilityState={{busy: saving}}
            containerStyle={styles.nextButtonContainer}
            disabled={saving}
            onPress={handleSave}>
            <View style={styles.nextButton}>
              {saving ? (
                <ActivityIndicator color={AUTH_COLORS.body} />
              ) : (
                <AppText style={styles.nextLabel}>다음</AppText>
              )}
            </View>
          </AnimatedPressable>
        </View>
      </View>

      <CustomInterestModal
        errorMessage={errorMessage}
        onAdd={handleAddCustomInterest}
        onDismiss={() => {
          setErrorMessage(null);
          setCustomInputVisible(false);
        }}
        visible={customInputVisible}
      />
      <InterestSavedModal
        content={savedContent}
        onConfirm={() => {
          setSavedVisible(false);
          onComplete();
        }}
        visible={savedVisible}
      />
    </Container>
  );
}

interface InterestChipProps {
  interest: string;
  onPress: () => void;
  selected: boolean;
}

function InterestChip({interest, onPress, selected}: InterestChipProps) {
  return (
    <AnimatedPressable
      accessibilityLabel={`${interest} 관심사`}
      accessibilityRole="checkbox"
      accessibilityState={{checked: selected}}
      onPress={onPress}>
      <View style={[styles.chip, selected && styles.selectedChip]}>
        <MaterialDesignIcons
          color={selected ? COLORS.purpleDeep : AUTH_COLORS.body}
          name={selected ? 'check' : 'plus'}
          size={18}
        />
        <AppText style={[styles.chipLabel, selected && styles.selectedChipLabel]}>
          {interest}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}

interface CustomInterestModalProps {
  errorMessage: string | null;
  onAdd: (interest: string) => boolean;
  onDismiss: () => void;
  visible: boolean;
}

function CustomInterestModal({
  errorMessage,
  onAdd,
  onDismiss,
  visible,
}: CustomInterestModalProps) {
  const [value, setValue] = useState('');
  const normalizedValue = value.trim();

  const handleAdd = () => {
    if (normalizedValue.length === 0) {
      return;
    }

    if (onAdd(normalizedValue)) {
      setValue('');
      onDismiss();
    }
  };

  const handleDismiss = () => {
    setValue('');
    onDismiss();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
      transparent
      visible={visible}>
      <KeyboardAvoidingView behavior="padding" style={styles.modal}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={handleDismiss}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel="관심사 직접 입력 창"
          accessibilityViewIsModal
          style={styles.inputCard}>
          <AnimatedPressable
            accessibilityLabel="직접 입력 창 닫기"
            accessibilityRole="button"
            containerStyle={styles.modalClose}
            hitSlop={8}
            onPress={handleDismiss}>
            <MaterialDesignIcons
              color={AUTH_COLORS.muted}
              name="close"
              size={26}
            />
          </AnimatedPressable>

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                accessibilityLabel="직접 입력할 관심사"
                autoFocus
                maxLength={MAX_INTEREST_LENGTH}
                onChangeText={setValue}
                onSubmitEditing={handleAdd}
                placeholder="예: 캠핑, 임영웅"
                placeholderTextColor="rgba(184, 185, 187, 0.6)"
                returnKeyType="done"
                style={styles.input}
                value={value}
              />
              <AppText style={styles.counter}>
                {value.length}/{MAX_INTEREST_LENGTH}
              </AppText>
            </View>
            <AnimatedPressable
              accessibilityLabel="직접 입력 관심사 추가"
              accessibilityRole="button"
              accessibilityState={{disabled: normalizedValue.length === 0}}
              containerStyle={styles.addButtonContainer}
              disabled={normalizedValue.length === 0}
              onPress={handleAdd}>
              <View style={styles.addButton}>
                <AppText style={styles.addLabel}>추가</AppText>
              </View>
            </AnimatedPressable>
          </View>

          <View
            accessibilityLiveRegion="polite"
            style={styles.modalFeedback}>
            {errorMessage !== null && (
              <AppText style={styles.modalError}>{errorMessage}</AppText>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface InterestSavedModalProps {
  content: InterestSavedContent;
  onConfirm: () => void;
  visible: boolean;
}

function InterestSavedModal({
  content,
  onConfirm,
  visible,
}: InterestSavedModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onConfirm}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.modal}>
        <View
          accessibilityLabel="관심사 저장 완료"
          accessibilityViewIsModal
          style={styles.savedCard}>
          <View style={styles.savedIcon}>
            <MaterialDesignIcons
              color={AUTH_COLORS.background}
              name="check"
              size={34}
            />
          </View>
          <AppText style={styles.savedTitle}>{content.title}</AppText>
          <AppText style={styles.savedMessage}>{content.message}</AppText>
          <AnimatedPressable
            accessibilityLabel={content.buttonLabel}
            accessibilityRole="button"
            containerStyle={styles.savedButtonContainer}
            onPress={onConfirm}>
            <View style={styles.savedButton}>
              <AppText style={styles.savedButtonLabel}>{content.buttonLabel}</AppText>
            </View>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

function normalizeInterests(interests: readonly string[]) {
  return Array.from(
    new Set(interests.map(interest => interest.trim()).filter(Boolean)),
  ).slice(0, MAX_INTERESTS);
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: AUTH_COLORS.background,
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    height: 104,
    justifyContent: 'center',
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
  },
  backButtonContainer: {
    left: AUTH_LAYOUT.horizontalPadding,
    position: 'absolute',
    zIndex: 1,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  logo: {
    height: 120,
    width: 120,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingHorizontal: 22,
  },
  title: {
    color: AUTH_COLORS.body,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 35,
    marginTop: 14,
  },
  description: {
    color: AUTH_COLORS.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 44,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.background,
    borderColor: '#C8CACC',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    height: 40,
    paddingHorizontal: 10,
  },
  selectedChip: {
    // 선택 표시는 앱 전체가 보라 계열을 쓴다. 같은 화면의 뒤로가기 버튼과 같은 연보라를
    // 써서 톤을 맞춘다.
    backgroundColor: COLORS.lavenderSurface,
    borderColor: COLORS.lavenderSurface,
  },
  chipLabel: {
    // 제목과 같은 색. 더 진한 색을 쓰면 칩 글자만 검정처럼 튄다.
    color: AUTH_COLORS.body,
    fontSize: 13,
    fontWeight: '500',
  },
  selectedChipLabel: {
    color: COLORS.purpleDeep,
    fontWeight: '700',
  },
  feedbackArea: {
    minHeight: 36,
    paddingTop: 12,
  },
  errorMessage: {
    color: AUTH_COLORS.error,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    backgroundColor: AUTH_COLORS.background,
    borderTopColor: AUTH_COLORS.hairline,
    borderTopWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  skipButton: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  skipContent: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  skipLabel: {
    color: AUTH_COLORS.placeholder,
    fontSize: 14,
    fontWeight: '500',
  },
  nextButtonContainer: {
    width: '100%',
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.action,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
  },
  nextLabel: {
    color: AUTH_COLORS.body,
    fontSize: 16,
    fontWeight: '700',
  },
  modal: {
    alignItems: 'center',
    backgroundColor: 'rgba(90, 90, 90, 0.62)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  inputCard: {
    backgroundColor: AUTH_COLORS.background,
    borderColor: '#78716C',
    borderRadius: 15,
    borderWidth: 1,
    maxWidth: 380,
    paddingBottom: 14,
    paddingHorizontal: 28,
    paddingTop: 32,
    width: '100%',
  },
  modalClose: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  inputContainer: {
    alignItems: 'center',
    borderColor: AUTH_COLORS.placeholder,
    borderRadius: 7,
    borderStyle: 'dashed',
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    height: 40,
    paddingLeft: 12,
    paddingRight: 8,
  },
  input: {
    color: AUTH_COLORS.body,
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    height: 40,
    paddingVertical: 0,
  },
  counter: {
    color: AUTH_COLORS.placeholder,
    fontSize: 13,
  },
  addButtonContainer: {
    width: 62,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.action,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
  },
  addLabel: {
    color: AUTH_COLORS.body,
    fontSize: 13,
    fontWeight: '600',
  },
  modalFeedback: {
    minHeight: 20,
    paddingTop: 5,
  },
  modalError: {
    color: AUTH_COLORS.error,
    fontSize: 12,
    lineHeight: 18,
  },
  savedCard: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.background,
    borderRadius: 28,
    maxWidth: 360,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 34,
    width: '100%',
  },
  savedIcon: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  savedTitle: {
    color: AUTH_COLORS.body,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginTop: 18,
  },
  savedMessage: {
    color: AUTH_COLORS.body,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    textAlign: 'center',
  },
  savedButtonContainer: {
    marginTop: 26,
    width: '100%',
  },
  savedButton: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.action,
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
  },
  savedButtonLabel: {
    color: AUTH_COLORS.body,
    fontSize: 17,
    fontWeight: '700',
  },
});
