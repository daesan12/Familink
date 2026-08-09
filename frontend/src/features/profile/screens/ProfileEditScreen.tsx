import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useRef,
  useState,
  type ReactNode} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';
import {launchImageLibrary} from 'react-native-image-picker';

import {
  DatePickerSheet,
  isValidName,
  SIGNUP_LIMITS,
  ValidationMessage,
} from '../../auth';
import {COLORS, FONT_FAMILY, RADII} from '../../../design/tokens';
import {useHardwareBack} from '../../../shared/hooks/useHardwareBack';
import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';
import {
  getProfileSaveErrorMessage,
  getProfileWithdrawErrorMessage,
} from '../api/profileApi';
import {
  formatDisplayDate,
  formatGenderLabel,
  GENDER_OPTIONS,
  parseDisplayDate,
  parsePickedProfileImage,
  type ProfileImageValidationError,
  toIsoDate,
} from '../profileModel';
import type {BaseProfile, Gender, ProfileImageChange} from '../types';

const PROFILE_PLACEHOLDER = require('../../../assets/images/profile-placeholder.png');

// 이름 검증 문구. OS 팝업이 아니라 회원가입처럼 입력칸 아래 인라인으로 보여준다.
const NAME_EMPTY_MESSAGE = '빈 칸을 채워주세요.';
const NAME_LENGTH_MESSAGE = '이름은 2 ~ 10자로 입력해주세요.';

interface ProfileEditScreenProps<T extends BaseProfile> {
  profile: T;
  onBack: () => void;
  onSave: (profile: T, imageChange: ProfileImageChange) => Promise<void>;
  onWithdraw?: () => Promise<void> | void;
}

// 'YYYY.MM.DD' 표시 문자열을 DatePickerSheet가 쓰는 'YYYY-MM-DD'로 바꾼다.
function toIsoValue(display: string): string {
  const parts = parseDisplayDate(display);
  return parts ? toIsoDate(parts.year, parts.month, parts.day) : '';
}

// I-2·J-2 프로필 편집. 성별 드롭다운(I-3), 생년월일 스크롤 휠 선택기(회원가입과 동일)를 포함한다.
// 이름·성별·생년월일만 편집하고 역할별 추가 필드(랭킹·관심사 등)는 그대로 보존한다.
export function ProfileEditScreen<T extends BaseProfile>({
  profile,
  onBack,
  onSave,
  onWithdraw,
}: ProfileEditScreenProps<T>) {
  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState<Gender>(profile.gender);
  const [birthDate, setBirthDate] = useState(profile.birthDate);
  const [imageChange, setImageChange] = useState<ProfileImageChange>({
    type: 'unchanged',
  });
  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  // 이름 칸에도 성별·생년월일과 같은 포커스 테두리를 주기 위한 표시 전용 상태다.
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useHardwareBack(() => {
    if (isSaving) {
      return true;
    }
    // 성별 드롭다운은 Modal이 아니라 뒤로가기가 JS로 내려온다. 화면을 닫기 전에 먼저 접는다.
    if (isGenderOpen) {
      setIsGenderOpen(false);
      return true;
    }
    onBack();
    return true;
  });

  const previewImageUrl =
    imageChange.type === 'replace'
      ? imageChange.asset.uri
      : imageChange.type === 'remove'
        ? null
        : profile.profileImageUrl;

  // 이름 외 항목만 바꿔도 저장할 수 있어야 하므로 변경 여부는 화면 전체를 기준으로 판단한다.
  const hasChanges = (trimmedName: string) =>
    trimmedName !== profile.name ||
    gender !== profile.gender ||
    birthDate !== profile.birthDate ||
    imageChange.type !== 'unchanged';

  const getNameError = (trimmedName: string): string | null => {
    if (trimmedName === '') {
      return NAME_EMPTY_MESSAGE;
    }
    if (!isValidName(trimmedName)) {
      return NAME_LENGTH_MESSAGE;
    }
    return null;
  };

  const handleSave = async () => {
    if (savingRef.current) {
      return;
    }

    const trimmedName = name.trim();
    const currentNameError = getNameError(trimmedName);
    if (currentNameError !== null) {
      setNameError(currentNameError);
      return;
    }
    if (!hasChanges(trimmedName)) {
      onBack();
      return;
    }

    savingRef.current = true;
    setNameError(null);
    setIsGenderOpen(false);
    setIsDateOpen(false);
    setIsSaving(true);
    const nextProfile = {
      ...profile,
      name: trimmedName,
      gender,
      birthDate,
      profileImageUrl: previewImageUrl,
    };

    try {
      await onSave(nextProfile, imageChange);
      onBack();
    } catch (error) {
      savingRef.current = false;
      setIsSaving(false);
      Alert.alert(
        '프로필 수정에 실패했어요.',
        getProfileSaveErrorMessage(error),
      );
    }
  };

  const handlePickProfileImage = async () => {
    if (savingRef.current) {
      return;
    }

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        restrictMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        selectionLimit: 1,
      });
      if (result.errorCode !== undefined) {
        Alert.alert(
          '프로필 사진을 선택할 수 없어요.',
          result.errorCode === 'permission'
            ? '사진 접근 권한을 확인한 뒤 다시 시도해 주세요.'
            : result.errorMessage ?? '잠시 후 다시 시도해 주세요.',
        );
        return;
      }
      if (result.didCancel) {
        return;
      }

      const pickedAsset = result.assets?.[0];
      if (pickedAsset === undefined) {
        Alert.alert(
          '프로필 사진을 사용할 수 없어요.',
          getProfileImageValidationMessage('metadata'),
        );
        return;
      }
      const parsed = parsePickedProfileImage(pickedAsset);
      if (parsed.error !== null) {
        Alert.alert(
          '프로필 사진을 사용할 수 없어요.',
          getProfileImageValidationMessage(parsed.error),
        );
        return;
      }
      setImageChange({asset: parsed.asset, type: 'replace'});
      setNameError(null);
    } catch {
      Alert.alert(
        '프로필 사진을 선택할 수 없어요.',
        '잠시 후 다시 시도해 주세요.',
      );
    }
  };

  const handleOpenDate = () => {
    setIsGenderOpen(false);
    setIsDateOpen(true);
  };

  const handleConfirmDate = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    if (year && month && day) {
      setBirthDate(formatDisplayDate(year, month, day));
    }
    setNameError(null);
    setIsDateOpen(false);
  };

  // maxLength로 조용히 잘라내면 사용자가 이유를 모른다. 상한을 넘기는 순간 안내까지 띄운다.
  const handleChangeName = (value: string) => {
    const characters = Array.from(value);
    if (characters.length > SIGNUP_LIMITS.nameMax) {
      setName(characters.slice(0, SIGNUP_LIMITS.nameMax).join(''));
      setNameError(NAME_LENGTH_MESSAGE);
      return;
    }
    setName(value);
    setNameError(null);
  };

  const toggleGender = () => {
    setIsDateOpen(false);
    setIsGenderOpen(current => !current);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          accessibilityState={{disabled: isSaving}}
          disabled={isSaving}
          hitSlop={8}
          onPress={onBack}
          style={styles.backButton}
        >
          <MaterialDesignIcons
            color={COLORS.purpleDeep}
            name="chevron-left"
            size={28}
          />
        </Pressable>
        <AppText style={styles.headerTitle}>프로필 편집</AppText>
        <Pressable
          accessibilityLabel="프로필 저장"
          accessibilityRole="button"
          accessibilityState={{disabled: isSaving}}
          disabled={isSaving}
          hitSlop={8}
          onPress={handleSave}
          style={styles.headerButton}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.purpleDeep} size="small" />
          ) : (
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="check"
              size={20}
            />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarWrap}>
          <Pressable
            accessibilityLabel="프로필 이미지 변경"
            accessibilityRole="button"
            accessibilityState={{disabled: isSaving}}
            disabled={isSaving}
            onPress={handlePickProfileImage}
            style={styles.avatarButton}
          >
            <CachedRemoteImage
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={
                previewImageUrl
                  ? {uri: previewImageUrl}
                  : PROFILE_PLACEHOLDER
              }
              style={styles.avatar}
            />
          </Pressable>
          {previewImageUrl ? (
            <Pressable
              accessibilityLabel="프로필 이미지 제거"
              accessibilityRole="button"
              accessibilityState={{disabled: isSaving}}
              disabled={isSaving}
              hitSlop={8}
              onPress={() => {
                setImageChange(
                  profile.profileImageUrl
                    ? {type: 'remove'}
                    : {type: 'unchanged'},
                );
                setNameError(null);
              }}
              style={styles.avatarRemoveButton}
            >
              <MaterialDesignIcons
                color={COLORS.background}
                name="close"
                size={18}
              />
            </Pressable>
          ) : null}
          {/* 사진을 터치해야 바뀌는 걸 모를 수 있어 아래쪽에 + 버튼을 함께 둔다. */}
          <Pressable
            accessibilityLabel="프로필 이미지 추가"
            accessibilityRole="button"
            accessibilityState={{disabled: isSaving}}
            disabled={isSaving}
            hitSlop={8}
            onPress={handlePickProfileImage}
            style={styles.avatarAddButton}
          >
            <MaterialDesignIcons
              color={COLORS.background}
              name="plus"
              size={20}
            />
          </Pressable>
        </View>

        <Field label="이름">
          <TextInput
            accessibilityLabel="이름 입력"
            editable={!isSaving}
            onBlur={() => setIsNameFocused(false)}
            onChangeText={handleChangeName}
            onFocus={() => setIsNameFocused(true)}
            placeholder="이름은 2 ~ 10자로 입력해주세요."
            placeholderTextColor={COLORS.textSubtle}
            style={[styles.textInput, isNameFocused && styles.fieldBoxActive]}
            value={name}
          />
          {nameError !== null ? (
            <View style={styles.nameError}>
              <ValidationMessage message={nameError} variant="error" />
            </View>
          ) : null}
        </Field>

        <Field label="아이디">
          {/* 아이디(로그인 ID) 변경은 이번 범위 밖이라 읽기 전용으로 표시한다. */}
          <View style={[styles.fieldBox, styles.readOnlyBox]}>
            <AppText style={styles.readOnlyText}>{profile.loginId}</AppText>
          </View>
        </Field>

        <Field label="생년월일">
          <Pressable
            accessibilityLabel="생년월일 선택"
            accessibilityRole="button"
            accessibilityState={{disabled: isSaving}}
            disabled={isSaving}
            onPress={handleOpenDate}
            style={[styles.fieldBox, isDateOpen && styles.fieldBoxActive]}
          >
            <AppText style={styles.fieldValue}>{birthDate}</AppText>
            <MaterialDesignIcons
              color={COLORS.textMuted}
              name="calendar-blank-outline"
              size={20}
            />
          </Pressable>
        </Field>

        <Field label="성별">
          <Pressable
            accessibilityLabel="성별 선택"
            accessibilityRole="button"
            accessibilityState={{disabled: isSaving}}
            disabled={isSaving}
            onPress={toggleGender}
            style={[styles.fieldBox, isGenderOpen && styles.fieldBoxActive]}
          >
            <AppText style={styles.fieldValue}>{formatGenderLabel(gender)}</AppText>
            <MaterialDesignIcons
              color={COLORS.textMuted}
              name={isGenderOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
            />
          </Pressable>
          {isGenderOpen ? (
            <View style={styles.dropdown}>
              {GENDER_OPTIONS.map((option, index) => {
                const isSelected = option.value === gender;
                return (
                  <Pressable
                    accessibilityLabel={`성별 ${option.label}`}
                    accessibilityRole="button"
                    accessibilityState={{selected: isSelected}}
                    key={option.value}
                    onPress={() => {
                      setGender(option.value);
                      setIsGenderOpen(false);
                    }}
                    style={[
                      styles.dropdownRow,
                      index < GENDER_OPTIONS.length - 1 &&
                        styles.dropdownDivider,
                      isSelected && styles.dropdownRowSelected,
                    ]}
                  >
                    <AppText
                      style={[
                        styles.dropdownText,
                        isSelected && styles.dropdownTextSelected,
                      ]}
                    >
                      {option.label}
                    </AppText>
                    {isSelected ? (
                      <MaterialDesignIcons
                        color={COLORS.purpleDeep}
                        name="check"
                        size={18}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Field>

        {/* [변경] 회원탈퇴: 큰 보라 버튼 대신 눈에 잘 띄지 않는 연한 그레이 링크형 텍스트. */}
        <Pressable
          accessibilityLabel="회원 탈퇴"
          accessibilityRole="button"
          accessibilityState={{disabled: isSaving}}
          disabled={isSaving}
          hitSlop={8}
          onPress={() => {
            if (onWithdraw === undefined) {
              Alert.alert('회원 탈퇴', '후속 작업에서 연결될 기능입니다.');
              return;
            }
            Alert.alert(
              '회원 탈퇴',
              '탈퇴 후 개인정보가 익명화되며 계정을 복구할 수 없습니다.',
              [
                {text: '취소', style: 'cancel'},
                {
                  text: '탈퇴',
                  style: 'destructive',
                  onPress: () => {
                    Promise.resolve(onWithdraw()).catch(error => {
                      Alert.alert(
                        '탈퇴에 실패했습니다.',
                        getProfileWithdrawErrorMessage(error),
                      );
                    });
                  },
                },
              ],
            );
          }}
          style={styles.withdrawButton}
        >
          <AppText style={styles.withdrawText}>회원 탈퇴</AppText>
        </Pressable>
      </ScrollView>

      <DatePickerSheet
        onCancel={() => setIsDateOpen(false)}
        onConfirm={handleConfirmDate}
        value={toIsoValue(birthDate)}
        visible={isDateOpen && !isSaving}
      />
    </KeyboardAvoidingView>
  );
}

function getProfileImageValidationMessage(
  error: ProfileImageValidationError,
): string {
  switch (error) {
    case 'size':
      return '사진은 10MB 이하만 선택할 수 있어요.';
    case 'type':
      return 'JPEG, PNG, WebP 사진만 선택할 수 있어요.';
    case 'metadata':
      return '사진 정보를 확인할 수 없어요. 다른 사진을 선택해 주세요.';
  }
}

function Field({label, children}: {label: string; children: ReactNode}) {
  return (
    <View style={styles.field}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderColor: COLORS.lavender,
    borderRadius: RADII.pill,
    borderWidth: 3,
    height: 110,
    width: 110,
  },
  avatarAddButton: {
    alignItems: 'center',
    backgroundColor: COLORS.textStrong,
    borderColor: COLORS.background,
    borderRadius: RADII.pill,
    borderWidth: 2,
    // 원의 우하단(약 4시 방향) 테두리에 걸치도록 둔다.
    bottom: 0,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 34,
  },
  avatarButton: {
    borderRadius: RADII.pill,
  },
  avatarRemoveButton: {
    alignItems: 'center',
    backgroundColor: COLORS.imageOverlay,
    borderRadius: RADII.pill,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    top: 2,
    width: 30,
  },
  avatarWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 8,
    marginTop: 8,
    position: 'relative',
  },
  content: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  dropdown: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownDivider: {
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  dropdownRowSelected: {
    backgroundColor: COLORS.lavenderSurface,
  },
  dropdownText: {
    color: COLORS.text,
    fontSize: 15,
  },
  dropdownTextSelected: {
    color: COLORS.purpleDeep,
    fontWeight: '700',
  },
  field: {
    marginTop: 20,
  },
  fieldBox: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  fieldBoxActive: {
    borderColor: COLORS.purple,
  },
  fieldLabel: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  fieldValue: {
    color: COLORS.text,
    fontSize: 15,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  nameError: {
    marginTop: 6,
  },
  readOnlyBox: {
    backgroundColor: COLORS.surfaceMuted,
  },
  readOnlyText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    color: COLORS.text,
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  withdrawButton: {
    alignItems: 'center',
    marginTop: 40,
    paddingVertical: 12,
  },
  withdrawText: {
    color: COLORS.textDisabled,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
