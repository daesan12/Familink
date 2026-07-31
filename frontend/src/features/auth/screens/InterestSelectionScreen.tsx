import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

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

interface InterestSelectionScreenProps {
  initialInterests?: readonly string[];
  onBack: () => void;
  onComplete: () => void;
  onSave: (interests: readonly string[]) => Promise<void> | void;
  onSkip: () => void;
  // 저장 완료 모달 문구. 온보딩과 마이페이지(J-4p)에서 다르게 쓴다.
  savedContent?: InterestSavedContent;
  // AppShell 하위 화면으로 임베드할 때는 자체 SafeAreaView를 끄고 부모 인셋을 따른다.
  embedded?: boolean;
}

export function InterestSelectionScreen({
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
  const hasLocalChangesRef = useRef(false);
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
    if (saving) {
      return;
    }

    setErrorMessage(null);
    setSaving(true);
    try {
      await onSave(selectedInterests);
      setSavedVisible(true);
    } catch {
      setErrorMessage('관심사를 저장하지 못했어요. 다시 시도해주세요.');
    } finally {
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
                color={AUTH_COLORS.background}
                name="chevron-left"
                size={30}
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
          <Text style={styles.title}>관심사를 선택해주세요</Text>
          <Text style={styles.description}>
            {'AI 안부전화와 대화 주제를 위해\n관심사를 최대 10개까지 선택해주세요.'}
          </Text>

          <View style={styles.chipList}>
            {displayedInterests.map(interest => (
              <InterestChip
                custom={customInterests.includes(interest)}
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
                  color={AUTH_COLORS.placeholder}
                  name="plus"
                  size={18}
                />
                <Text style={styles.chipLabel}>직접 입력</Text>
              </View>
            </AnimatedPressable>
          </View>

          <View
            accessibilityLiveRegion="polite"
            style={styles.feedbackArea}>
            {errorMessage !== null && !customInputVisible && (
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <AnimatedPressable
            accessibilityLabel="관심사 설정 건너뛰기"
            accessibilityRole="button"
            containerStyle={styles.skipButton}
            disabled={saving}
            onPress={onSkip}>
            <View style={styles.skipContent}>
              <Text style={styles.skipLabel}>건너뛰기</Text>
              <MaterialDesignIcons
                color={AUTH_COLORS.placeholder}
                name="arrow-right"
                size={22}
              />
            </View>
          </AnimatedPressable>

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
                <Text style={styles.nextLabel}>다음</Text>
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
  custom: boolean;
  interest: string;
  onPress: () => void;
  selected: boolean;
}

function InterestChip({
  custom,
  interest,
  onPress,
  selected,
}: InterestChipProps) {
  const customSelected = custom && selected;

  return (
    <AnimatedPressable
      accessibilityLabel={`${interest} 관심사`}
      accessibilityRole="checkbox"
      accessibilityState={{checked: selected}}
      onPress={onPress}>
      <View
        style={[
          styles.chip,
          selected && styles.selectedChip,
          customSelected && styles.customSelectedChip,
        ]}>
        <MaterialDesignIcons
          color={
            customSelected
              ? AUTH_COLORS.body
              : selected
                ? AUTH_COLORS.background
                : AUTH_COLORS.placeholder
          }
          name={selected ? 'check' : 'plus'}
          size={18}
        />
        <Text
          style={[
            styles.chipLabel,
            selected && styles.selectedChipLabel,
            customSelected && styles.customSelectedChipLabel,
          ]}>
          {interest}
        </Text>
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
      <View style={styles.modal}>
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
              <Text style={styles.counter}>
                {value.length}/{MAX_INTEREST_LENGTH}
              </Text>
            </View>
            <AnimatedPressable
              accessibilityLabel="직접 입력 관심사 추가"
              accessibilityRole="button"
              accessibilityState={{disabled: normalizedValue.length === 0}}
              containerStyle={styles.addButtonContainer}
              disabled={normalizedValue.length === 0}
              onPress={handleAdd}>
              <View style={styles.addButton}>
                <Text style={styles.addLabel}>추가</Text>
              </View>
            </AnimatedPressable>
          </View>

          <View
            accessibilityLiveRegion="polite"
            style={styles.modalFeedback}>
            {errorMessage !== null && (
              <Text style={styles.modalError}>{errorMessage}</Text>
            )}
          </View>
        </View>
      </View>
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
          <Text style={styles.savedTitle}>{content.title}</Text>
          <Text style={styles.savedMessage}>{content.message}</Text>
          <AnimatedPressable
            accessibilityLabel={content.buttonLabel}
            accessibilityRole="button"
            containerStyle={styles.savedButtonContainer}
            onPress={onConfirm}>
            <View style={styles.savedButton}>
              <Text style={styles.savedButtonLabel}>{content.buttonLabel}</Text>
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
    backgroundColor: AUTH_COLORS.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
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
    backgroundColor: AUTH_COLORS.primarySoft,
    borderColor: AUTH_COLORS.primarySoft,
  },
  customSelectedChip: {
    backgroundColor: '#FFF7D6',
    borderColor: '#FFF7D6',
  },
  chipLabel: {
    color: AUTH_COLORS.placeholder,
    fontSize: 13,
    fontWeight: '500',
  },
  selectedChipLabel: {
    color: AUTH_COLORS.background,
    fontWeight: '700',
  },
  customSelectedChipLabel: {
    color: AUTH_COLORS.body,
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
