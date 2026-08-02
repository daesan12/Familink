import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {useHardwareBack} from '../../../shared/hooks/useHardwareBack';
import {
  getInterestErrorMessage,
  InterestSelectionScreen,
  type InterestGateway,
} from '../../auth';
import {NotificationSettingsScreen} from '../../notifications';
import type {ProfileGateway} from '../api/profileApi';
import {MyPageFooter} from '../components/MyPageFooter';
import {MyPageProfileCard} from '../components/MyPageProfileCard';
import {
  MyPageSettingsSection,
  type MyPageMenuItem,
} from '../components/MyPageSettingsSection';
import {CARE_RECEIVER_PROFILE} from '../fixtures/profileFixtures';
import {mergeUserProfile, toChangedApiProfileUpdate} from '../profileModel';
import type {CareReceiverProfile, ProfileImageChange} from '../types';
import {ProfileEditScreen} from './ProfileEditScreen';
import {ProfileGuideScreen} from './ProfileGuideScreen';
import {ProfileLoadStateScreen} from './ProfileLoadStateScreen';

export interface CareReceiverMyPageScreenProps extends AppScreenProps {
  // 초기 프로필 주입(테스트·연동용). 없으면 mock 프로필을 사용한다.
  initialProfile?: CareReceiverProfile;
  interestGateway?: InterestGateway;
  profileGateway?: ProfileGateway;
}

// 하위 전체화면. 진입 시 하단 탭을 숨긴다.
type SubScreen = 'edit' | 'interest' | 'guide' | 'notificationSettings' | null;

type ProfileLoadState =
  | {status: 'loading'}
  | {status: 'ready'}
  | {message: string; status: 'error'};

type InterestLoadState =
  | {status: 'idle'}
  | {scopeKey: string; status: 'loading'}
  | {message: string; scopeKey: string; status: 'error'}
  | {interests: readonly string[]; scopeKey: string; status: 'ready'};

const IDLE_INTEREST_LOAD_STATE: InterestLoadState = {status: 'idle'};
const PROFILE_LOAD_ERROR_MESSAGE =
  '네트워크 연결을 확인하고 다시 시도해 주세요.';
const EMPTY_CARE_RECEIVER_PROFILE: CareReceiverProfile = {
  age: 0,
  birthDate: '',
  gender: 'male',
  interests: [],
  loginId: '',
  name: '',
};

// J-1 마이페이지(피보호자). 효자 도장 대신 관심사 설정을 다루고, 프로필 편집·알림 설정·이용가이드는 보호자와 공유한다.
export function CareReceiverMyPageScreen({
  currentGroup,
  initialProfile,
  interestGateway,
  onCloseProfile,
  onFullscreenChange,
  onRequestLogout,
  onRequestWithdrawal,
  profileGateway,
}: CareReceiverMyPageScreenProps) {
  const hasLocalProfile = initialProfile !== undefined || __DEV__;
  const [profile, setProfile] = useState(
    initialProfile ??
      (__DEV__ ? CARE_RECEIVER_PROFILE : EMPTY_CARE_RECEIVER_PROFILE),
  );
  const [profileLoadState, setProfileLoadState] =
    useState<ProfileLoadState>(
      profileGateway === undefined && hasLocalProfile
        ? {status: 'ready'}
        : {status: 'loading'},
    );
  const [profileRetryCount, setProfileRetryCount] = useState(0);
  const [subScreen, setSubScreen] = useState<SubScreen>(null);

  useHardwareBack(() => {
    setSubScreen(null);
    return true;
  }, subScreen !== null);
  const [interestLoadState, setInterestLoadState] =
    useState<InterestLoadState>(IDLE_INTEREST_LOAD_STATE);
  const interestRequestGenerationRef = useRef(0);
  const interestScopeKey = `${currentGroup.id}:${currentGroup.myMemberId ?? ''}`;
  const currentInterestScopeRef = useRef(interestScopeKey);
  const previousInterestScopeRef = useRef(interestScopeKey);
  currentInterestScopeRef.current = interestScopeKey;

  // 하위 전체화면에 들어가면 하단 탭을 숨긴다(보호자 마이페이지와 같은 방식).
  useEffect(() => {
    onFullscreenChange?.(subScreen !== null);

    return () => onFullscreenChange?.(false);
  }, [subScreen, onFullscreenChange]);

  useEffect(() => {
    if (previousInterestScopeRef.current === interestScopeKey) {
      return;
    }

    previousInterestScopeRef.current = interestScopeKey;
    interestRequestGenerationRef.current += 1;
    setInterestLoadState(IDLE_INTEREST_LOAD_STATE);
    setSubScreen(current => (current === 'interest' ? null : current));
  }, [interestScopeKey]);

  useEffect(
    () => () => {
      interestRequestGenerationRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (profileGateway === undefined) {
      setProfileLoadState(
        hasLocalProfile
          ? {status: 'ready'}
          : {message: PROFILE_LOAD_ERROR_MESSAGE, status: 'error'},
      );
      return;
    }

    let disposed = false;
    setProfileLoadState({status: 'loading'});
    profileGateway
      .loadCurrentProfile()
      .then(remote => {
        if (!disposed) {
          setProfile(current => mergeUserProfile(current, remote));
          setProfileLoadState({status: 'ready'});
        }
      })
      .catch(() => {
        if (!disposed) {
          setSubScreen(null);
          setProfileLoadState({
            message: PROFILE_LOAD_ERROR_MESSAGE,
            status: 'error',
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, [hasLocalProfile, profileGateway, profileRetryCount]);

  const handleProfileSave = async (
    nextProfile: CareReceiverProfile,
    imageChange: ProfileImageChange,
  ) => {
    if (profileGateway === undefined) {
      setProfile(nextProfile);
      return;
    }

    const profileImageUrl =
      imageChange.type === 'replace'
        ? await profileGateway.uploadProfileImage(imageChange.asset)
        : imageChange.type === 'remove'
          ? null
          : undefined;
    const update = toChangedApiProfileUpdate(
      profile,
      nextProfile,
      profileImageUrl,
    );
    if (Object.keys(update).length > 0) {
      await profileGateway.updateCurrentProfile(update);
    }
    setProfile({
      ...nextProfile,
      profileImageUrl:
        profileImageUrl === undefined
          ? nextProfile.profileImageUrl
          : profileImageUrl,
    });
  };

  const handleLogout = () => {
    if (onRequestLogout) {
      onRequestLogout();
      return;
    }
    Alert.alert('로그아웃', '후속 작업에서 연결될 기능입니다.');
  };

  const closeInterestSettings = () => {
    interestRequestGenerationRef.current += 1;
    setInterestLoadState(IDLE_INTEREST_LOAD_STATE);
    setSubScreen(null);
  };

  const loadInterestSettings = async () => {
    const requestGeneration = ++interestRequestGenerationRef.current;
    const scopeKey = interestScopeKey;
    const memberId = currentGroup.myMemberId;
    setSubScreen('interest');

    if (interestGateway === undefined) {
      setInterestLoadState({
        message: '로그인 정보를 확인한 뒤 다시 시도해 주세요.',
        scopeKey,
        status: 'error',
      });
      return;
    }

    if (memberId === undefined) {
      setInterestLoadState({
        message: '현재 그룹의 구성원 정보를 확인한 뒤 다시 시도해 주세요.',
        scopeKey,
        status: 'error',
      });
      return;
    }

    setInterestLoadState({scopeKey, status: 'loading'});
    try {
      const remote = await interestGateway.loadInterests(
        currentGroup.id,
        memberId,
      );
      if (
        interestRequestGenerationRef.current !== requestGeneration ||
        currentInterestScopeRef.current !== scopeKey
      ) {
        return;
      }

      setProfile(current => ({...current, interests: remote.interests}));
      setInterestLoadState({
        interests: remote.interests,
        scopeKey,
        status: 'ready',
      });
    } catch (error) {
      if (
        interestRequestGenerationRef.current !== requestGeneration ||
        currentInterestScopeRef.current !== scopeKey
      ) {
        return;
      }

      setInterestLoadState({
        message: getInterestErrorMessage(
          error,
          '관심사를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
        ),
        scopeKey,
        status: 'error',
      });
    }
  };

  const saveInterestSettings = async (interests: readonly string[]) => {
    const scopeKey = interestScopeKey;
    const requestGeneration = interestRequestGenerationRef.current;
    const memberId = currentGroup.myMemberId;

    if (interestGateway === undefined || memberId === undefined) {
      throw new Error('현재 그룹의 구성원 정보를 확인할 수 없습니다.');
    }

    const remote = await interestGateway.replaceInterests(
      currentGroup.id,
      memberId,
      interests,
    );
    if (
      interestRequestGenerationRef.current !== requestGeneration ||
      currentInterestScopeRef.current !== scopeKey
    ) {
      return;
    }

    setProfile(current => ({...current, interests: remote.interests}));
    setInterestLoadState({
      interests: remote.interests,
      scopeKey,
      status: 'ready',
    });
  };

  if (profileLoadState.status === 'loading') {
    return <ProfileLoadStateScreen onBack={onCloseProfile} />;
  }

  if (profileLoadState.status === 'error') {
    return (
      <ProfileLoadStateScreen
        errorMessage={profileLoadState.message}
        onBack={onCloseProfile}
        onRetry={() => setProfileRetryCount(count => count + 1)}
      />
    );
  }

  if (subScreen === 'edit') {
    return (
      <ProfileEditScreen
        onBack={() => setSubScreen(null)}
        onSave={handleProfileSave}
        onWithdraw={onRequestWithdrawal}
        profile={profile}
      />
    );
  }

  if (subScreen === 'interest') {
    if (
      interestLoadState.status === 'idle' ||
      interestLoadState.scopeKey !== interestScopeKey ||
      interestLoadState.status === 'loading'
    ) {
      return <InterestRequestStateScreen onBack={closeInterestSettings} />;
    }

    if (interestLoadState.status === 'error') {
      return (
        <InterestRequestStateScreen
          errorMessage={interestLoadState.message}
          onBack={closeInterestSettings}
          onRetry={loadInterestSettings}
        />
      );
    }

    // J-3·J-3p·J-4 관심사 선택 화면을 재사용한다. 저장 완료 시 J-4p 문구를 띄우고 J-1로 돌아간다.
    return (
      <InterestSelectionScreen
        embedded
        getSaveErrorMessage={error =>
          getInterestErrorMessage(
            error,
            '관심사를 저장하지 못했어요. 다시 시도해 주세요.',
          )
        }
        initialInterests={interestLoadState.interests}
        onBack={closeInterestSettings}
        onComplete={closeInterestSettings}
        onSave={saveInterestSettings}
        onSkip={closeInterestSettings}
        savedContent={{
          buttonLabel: '확인',
          message: `${profile.name}님의 관심사가\n수정되었습니다.`,
          title: '관심사 수정 완료',
        }}
      />
    );
  }

  if (subScreen === 'guide') {
    return <ProfileGuideScreen onBack={() => setSubScreen(null)} />;
  }

  if (subScreen === 'notificationSettings') {
    return <NotificationSettingsScreen onBack={() => setSubScreen(null)} />;
  }

  const menuItems: readonly MyPageMenuItem[] = [
    {
      key: 'interest-settings',
      label: '관심사 설정',
      onPress: loadInterestSettings,
    },
    {
      key: 'notification-settings',
      label: '알림 설정',
      onPress: () => setSubScreen('notificationSettings'),
    },
    {key: 'guide', label: '이용가이드', onPress: () => setSubScreen('guide')},
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>마이페이지</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MyPageProfileCard
          age={profile.age}
          gender={profile.gender}
          name={profile.name}
          profileImageUrl={profile.profileImageUrl}
          onEdit={() => setSubScreen('edit')}
        />

        <MyPageSettingsSection items={menuItems} />

        <MyPageFooter onLogout={handleLogout} />
      </ScrollView>
    </View>
  );
}

interface InterestRequestStateScreenProps {
  errorMessage?: string;
  onBack: () => void;
  onRetry?: () => void;
}

function InterestRequestStateScreen({
  errorMessage,
  onBack,
  onRetry,
}: InterestRequestStateScreenProps) {
  const isLoading = errorMessage === undefined;

  return (
    <View style={styles.requestStateScreen}>
      <View style={styles.requestStateHeader}>
        <Pressable
          accessibilityLabel="관심사 조회에서 뒤로 가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={styles.requestStateBackButton}>
          <MaterialDesignIcons
            color={COLORS.purpleDeep}
            name="chevron-left"
            size={30}
          />
        </Pressable>
        <Text style={styles.requestStateHeaderTitle}>관심사 설정</Text>
      </View>

      <View
        accessibilityLiveRegion="polite"
        style={styles.requestStateContent}>
        {isLoading ? (
          <>
            <ActivityIndicator color={COLORS.purpleDeep} size="large" />
            <Text style={styles.requestStateTitle}>
              관심사를 불러오는 중이에요.
            </Text>
          </>
        ) : (
          <>
            <MaterialDesignIcons
              color={COLORS.error}
              name="alert-circle-outline"
              size={46}
            />
            <Text style={styles.requestStateTitle}>
              관심사를 불러오지 못했어요
            </Text>
            <Text style={styles.requestStateMessage}>{errorMessage}</Text>
            <Pressable
              accessibilityLabel="관심사 다시 시도"
              accessibilityRole="button"
              onPress={onRetry}
              style={({pressed}) => [
                styles.requestStateRetryButton,
                pressed && styles.requestStateRetryButtonPressed,
              ]}>
              <Text style={styles.requestStateRetryLabel}>다시 시도</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTitle: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: '700',
  },
  requestStateBackButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  requestStateContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 96,
    paddingHorizontal: 32,
  },
  requestStateHeader: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  requestStateHeaderTitle: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: '700',
  },
  requestStateMessage: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  requestStateRetryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.purpleDeep,
    borderRadius: RADII.pill,
    height: 48,
    justifyContent: 'center',
    marginTop: 24,
    minWidth: 144,
    paddingHorizontal: 28,
  },
  requestStateRetryButtonPressed: {
    opacity: 0.82,
  },
  requestStateRetryLabel: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '700',
  },
  requestStateScreen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  requestStateTitle: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 18,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
});
