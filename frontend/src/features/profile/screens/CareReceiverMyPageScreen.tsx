import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useCallback, useEffect, useRef, useState} from 'react';
import {StackActions} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
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
import {BackButton} from '../../../shared/components/BackButton';
import {RouteFocusReporter} from '../../../shared/navigation/RouteFocusReporter';
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
import type {ProfileStackParamList} from '../navigationTypes';
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

// 프로필 탭 내부 스택. 하위 전체화면 4종이 얼리 리턴 대신 스택 화면으로
// 열린다. 보호자 화면과 param list를 공유하고 InterestSettings를 추가 등록한다.
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList>;

// InterestSettings 라우트가 pop되는 모든 경로(자체 뒤로 버튼, 하드웨어 백의
// 컨테이너 pop, 그룹 전환·프로필 실패 popTo)에서 진행 중 조회를 무효화한다.
// 모듈 레벨 필수 — 렌더 본문 안에서 정의하면 매 렌더 리마운트된다.
function RouteUnmountCleanup({onUnmount}: {onUnmount: () => void}) {
  useEffect(() => () => onUnmount(), [onUnmount]);
  return null;
}

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
  // 홈 포커스의 부정이 곧 풀스크린이다(하위 화면 전부 풀스크린).
  // 초기값 true — false로 시작하면 첫 커밋에서 탭바가 잠깐 숨는다.
  const [isHomeFocused, setIsHomeFocused] = useState(true);
  // 이동 함수가 effect·핸들러에서도 스택을 조작할 수 있게 렌더 중 ref로
  // 캡처한다(FeedScreen feedNavRef 관용구).
  const profileNavRef = useRef<ProfileNavigation | null>(null);

  const [interestLoadState, setInterestLoadState] =
    useState<InterestLoadState>(IDLE_INTEREST_LOAD_STATE);
  const interestRequestGenerationRef = useRef(0);
  const interestScopeKey = `${currentGroup.id}:${currentGroup.myMemberId ?? ''}`;
  const currentInterestScopeRef = useRef(interestScopeKey);
  const previousInterestScopeRef = useRef(interestScopeKey);
  currentInterestScopeRef.current = interestScopeKey;

  // 하위 전체화면에 들어가면 하단 탭을 숨긴다(보호자 마이페이지와 같은 방식).
  useEffect(() => {
    onFullscreenChange?.(!isHomeFocused);

    return () => onFullscreenChange?.(false);
  }, [isHomeFocused, onFullscreenChange]);

  useEffect(() => {
    if (previousInterestScopeRef.current === interestScopeKey) {
      return;
    }

    previousInterestScopeRef.current = interestScopeKey;
    interestRequestGenerationRef.current += 1;
    setInterestLoadState(IDLE_INTEREST_LOAD_STATE);
    // 그룹 전환은 관심사 화면만 닫는다(편집·가이드는 유지 — 기존 동작 보존).
    const stackState = profileNavRef.current?.getState();
    const topRoute = stackState?.routes[stackState.index];
    if (topRoute?.name === 'InterestSettings') {
      profileNavRef.current?.dispatch(StackActions.popTo('ProfileHome'));
    }
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
          // 하위 화면이 열린 채 실패하면(재시도 실패 등) 홈으로 걷어내
          // 오류 화면이 가려지지 않게 한다(기존 setSubScreen(null) 등가).
          profileNavRef.current?.dispatch(StackActions.popTo('ProfileHome'));
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
    if (imageChange.type === 'replace') {
      const refreshedProfile = await profileGateway.loadCurrentProfile();
      setProfile(mergeUserProfile(nextProfile, refreshedProfile));
      return;
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

  // 기존 closeInterestSettings의 무효화 부분. 라우트 unmount cleanup으로
  // 옮겨져 어떤 경로로 닫혀도(뒤로 버튼·하드웨어 백·그룹 전환) 진행 중
  // 조회 무효화가 항상 따라온다. 화면 닫기 자체는 스택 pop이 담당한다.
  const handleInterestRouteClosed = useCallback(() => {
    interestRequestGenerationRef.current += 1;
    setInterestLoadState(IDLE_INTEREST_LOAD_STATE);
  }, []);

  const loadInterestSettings = async () => {
    const requestGeneration = ++interestRequestGenerationRef.current;
    const scopeKey = interestScopeKey;
    const memberId = currentGroup.myMemberId;
    profileNavRef.current?.navigate('InterestSettings');

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

  const menuItems: readonly MyPageMenuItem[] = [
    {
      key: 'interest-settings',
      label: '관심사 설정',
      onPress: loadInterestSettings,
    },
    {
      key: 'notification-settings',
      label: '알림 설정',
      onPress: () => profileNavRef.current?.navigate('NotificationSettings'),
    },
    {
      key: 'guide',
      label: '이용가이드',
      onPress: () => profileNavRef.current?.navigate('ProfileGuide'),
    },
  ];

  // 홈 본문. 조회 상태 분기를 스택 밖에 두면 loading↔ready 전이마다
  // 내비게이터가 언마운트되므로 홈 라우트 안으로 내린다(보호자와 동일).
  // 로딩·오류 중에는 편집 진입 UI 자체가 렌더되지 않는다.
  const homeScreenContent =
    profileLoadState.status === 'loading' ? (
      <ProfileLoadStateScreen onBack={onCloseProfile} />
    ) : profileLoadState.status === 'error' ? (
      <ProfileLoadStateScreen
        errorMessage={profileLoadState.message}
        onBack={onCloseProfile}
        onRetry={() => setProfileRetryCount(count => count + 1)}
      />
    ) : (
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
          onEdit={() => profileNavRef.current?.navigate('ProfileEdit')}
        />

        <MyPageSettingsSection items={menuItems} />

        <MyPageFooter onLogout={handleLogout} />
      </ScrollView>
    </View>
    );

  return (
    <ProfileStack.Navigator
      screenOptions={{animation: 'none', headerShown: false}}>
      <ProfileStack.Screen name="ProfileHome">
        {({navigation}) => {
          profileNavRef.current = navigation;
          return (
            <>
              <RouteFocusReporter onFocusChange={setIsHomeFocused} />
              {homeScreenContent}
            </>
          );
        }}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="ProfileEdit">
        {({navigation}) => {
          profileNavRef.current = navigation;
          return (
            <ProfileEditScreen
              onBack={() => navigation.goBack()}
              onSave={handleProfileSave}
              onWithdraw={onRequestWithdrawal}
              profile={profile}
            />
          );
        }}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="InterestSettings">
        {({navigation}) => {
          profileNavRef.current = navigation;
          return (
            <>
              <RouteUnmountCleanup onUnmount={handleInterestRouteClosed} />
              {interestLoadState.status === 'idle' ||
              interestLoadState.scopeKey !== interestScopeKey ||
              interestLoadState.status === 'loading' ? (
                <InterestRequestStateScreen
                  onBack={() => navigation.goBack()}
                />
              ) : interestLoadState.status === 'error' ? (
                <InterestRequestStateScreen
                  errorMessage={interestLoadState.message}
                  onBack={() => navigation.goBack()}
                  onRetry={loadInterestSettings}
                />
              ) : (
                // J-3·J-3p·J-4 관심사 선택 화면을 재사용한다. 저장 완료 시
                // J-4p 문구를 띄우고 J-1로 돌아간다.
                <InterestSelectionScreen
                  embedded
                  getSaveErrorMessage={error =>
                    getInterestErrorMessage(
                      error,
                      '관심사를 저장하지 못했어요. 다시 시도해 주세요.',
                    )
                  }
                  initialInterests={interestLoadState.interests}
                  onBack={() => navigation.goBack()}
                  onComplete={() => navigation.goBack()}
                  onSave={saveInterestSettings}
                  savedContent={{
                    buttonLabel: '확인',
                    message: `${profile.name}님의 관심사가\n수정되었습니다.`,
                    title: '관심사 수정 완료',
                  }}
                />
              )}
            </>
          );
        }}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="ProfileGuide">
        {({navigation}) => {
          profileNavRef.current = navigation;
          return <ProfileGuideScreen onBack={() => navigation.goBack()} />;
        }}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="NotificationSettings">
        {({navigation}) => {
          profileNavRef.current = navigation;
          return (
            <NotificationSettingsScreen onBack={() => navigation.goBack()} />
          );
        }}
      </ProfileStack.Screen>
    </ProfileStack.Navigator>
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
        <BackButton
          accessibilityLabel="관심사 조회에서 뒤로 가기"
          onPress={onBack}
        />
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
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTitle: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: '700',
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
