import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState} from 'react';
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
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {RetryButton} from '../../../shared/components/RetryButton';
import {RouteFocusReporter} from '../../../shared/navigation/RouteFocusReporter';
import {
  formatWeekRange,
  getCurrentMonthRange,
  getCurrentWeekRange,
  getMonthRange,
  rankEntries,
  type CarnationGateway,
} from '../../group-info';
import {NotificationSettingsScreen} from '../../notifications';
import {CarnationStamp} from '../components/CarnationStamp';
import {
  MonthlyStampModal,
  type MonthlyStampLoadState,
} from '../components/MonthlyStampModal';
import {MyPageFooter} from '../components/MyPageFooter';
import {MyPageProfileCard} from '../components/MyPageProfileCard';
import {
  MyPageSettingsSection,
  type MyPageMenuItem,
} from '../components/MyPageSettingsSection';
import {GUARDIAN_PROFILE} from '../fixtures/profileFixtures';
import {
  mergeUserProfile,
  toChangedApiProfileUpdate,
} from '../profileModel';
import type {ProfileGateway} from '../api/profileApi';
import type {ProfileStackParamList} from '../navigationTypes';
import type {GuardianProfile, ProfileImageChange} from '../types';
import {ProfileEditScreen} from './ProfileEditScreen';
import {ProfileGuideScreen} from './ProfileGuideScreen';
import {ProfileLoadStateScreen} from './ProfileLoadStateScreen';

export interface MyPageScreenProps extends AppScreenProps {
  // 초기 프로필 주입(테스트·연동용). 없으면 mock 프로필을 사용한다.
  initialProfile?: GuardianProfile;
  carnationGateway?: CarnationGateway;
  profileGateway?: ProfileGateway;
}

// 프로필 탭 내부 스택. 서브 화면 3종이 얼리 리턴 대신 스택 화면으로 열린다.
// 피보호자 화면과 param list를 공유하되 InterestSettings는 등록하지 않는다.
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList>;

type ProfileLoadState =
  | {status: 'loading'}
  | {status: 'ready'}
  | {message: string; status: 'error'};

type WeeklyStampLoadState =
  | {status: 'loading'}
  | {status: 'empty'}
  | {message: string; status: 'error'}
  | {
      days: readonly boolean[];
      hasCrown: boolean;
      rank?: number;
      status: 'success';
    };

const WEEK_DAY_KEYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

const CARNATION_ERROR_MESSAGE =
  '카네이션 기록을 불러오지 못했어요. 다시 시도해 주세요.';
const MEMBER_CONFIGURATION_MESSAGE =
  '현재 그룹의 구성원 정보를 확인할 수 없어 카네이션을 불러올 수 없습니다.';
const PROFILE_LOAD_ERROR_MESSAGE =
  '네트워크 연결을 확인하고 다시 시도해 주세요.';
const EMPTY_GUARDIAN_PROFILE: GuardianProfile = {
  age: 0,
  birthDate: '',
  gender: 'male',
  hasCrown: false,
  joinedAt: '',
  loginId: '',
  name: '',
  weeklyRank: 0,
};

// I-1 보호자 마이페이지. 주간 조회와 월간 조회는 각각 요청 세대를 보관해
// 그룹·구성원·선택 월이 바뀐 뒤 늦게 도착한 응답을 화면에 반영하지 않는다.
export function MyPageScreen({
  currentGroup,
  initialProfile,
  onCloseProfile,
  onFullscreenChange,
  onRequestLogout,
  onRequestWithdrawal,
  profileGateway,
  carnationGateway,
}: MyPageScreenProps) {
  const hasLocalProfile = initialProfile !== undefined || __DEV__;
  const [profile, setProfile] = useState(
    initialProfile ?? (__DEV__ ? GUARDIAN_PROFILE : EMPTY_GUARDIAN_PROFILE),
  );
  const [profileLoadState, setProfileLoadState] =
    useState<ProfileLoadState>(
      profileGateway === undefined && hasLocalProfile
        ? {status: 'ready'}
        : {status: 'loading'},
    );
  const [profileRetryCount, setProfileRetryCount] = useState(0);
  // 홈 포커스의 부정이 곧 풀스크린이다(서브 화면 3종 전부 풀스크린).
  // 초기값 true — false로 시작하면 첫 커밋에서 탭바가 잠깐 숨는다.
  const [isHomeFocused, setIsHomeFocused] = useState(true);
  const [isMonthlyOpen, setIsMonthlyOpen] = useState(false);
  // 이동 함수가 effect·핸들러에서도 스택을 조작할 수 있게 렌더 중 ref로
  // 캡처한다(FeedScreen feedNavRef 관용구).
  const profileNavRef = useRef<ProfileNavigation | null>(null);
  const [weeklyRetryCount, setWeeklyRetryCount] = useState(0);
  const [monthlyRetryCount, setMonthlyRetryCount] = useState(0);
  const [weeklyState, setWeeklyState] = useState<WeeklyStampLoadState>({
    status: 'loading',
  });
  const [monthlyState, setMonthlyState] = useState<MonthlyStampLoadState>({
    status: 'idle',
  });

  const [now, setNow] = useState(() => new Date());
  const weekRange = useMemo(() => getCurrentWeekRange(now), [now]);
  const currentMonth = useMemo(() => getCurrentMonthRange(now), [now]);
  const [selectedMonth, setSelectedMonth] = useState({
    month: currentMonth.month,
    year: currentMonth.year,
  });
  const weeklyRequestGenerationRef = useRef(0);
  const monthlyRequestGenerationRef = useRef(0);

  useEffect(() => {
    onFullscreenChange?.(!isHomeFocused);

    return () => onFullscreenChange?.(false);
  }, [isHomeFocused, onFullscreenChange]);

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

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
          // 서브 화면이 열린 채 실패하면(재시도 실패 등) 홈으로 걷어내
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

  useEffect(() => {
    const requestGeneration = ++weeklyRequestGenerationRef.current;
    const gateway = carnationGateway;
    const memberId = currentGroup.myMemberId;
    let disposed = false;

    if (gateway === undefined || memberId === undefined) {
      setWeeklyState({
        message:
          gateway === undefined
            ? '카네이션 연결 정보를 확인한 뒤 다시 시도해 주세요.'
            : MEMBER_CONFIGURATION_MESSAGE,
        status: 'error',
      });
      return () => {
        disposed = true;
        weeklyRequestGenerationRef.current += 1;
      };
    }

    setWeeklyState({status: 'loading'});
    Promise.all([
      gateway.loadWeeklyRanking(
        currentGroup.id,
        weekRange.weekStart,
        weekRange.weekEnd,
      ),
      gateway.loadMemberCarnations(
        currentGroup.id,
        memberId,
        weekRange.weekStart,
        weekRange.weekEnd,
      ),
    ])
      .then(([snapshot, calendar]) => {
        if (
          disposed ||
          weeklyRequestGenerationRef.current !== requestGeneration
        ) {
          return;
        }

        const ranked = rankEntries(snapshot.rankings);
        const currentMember = ranked.find(entry => entry.memberId === memberId);
        const earnedDateSet = new Set(calendar.earnedDates);
        const days = getWeekDates(weekRange.weekStart).map(date =>
          earnedDateSet.has(date),
        );

        if (snapshot.rankings.length === 0 && calendar.earnedDates.length === 0) {
          setWeeklyState({status: 'empty'});
          return;
        }

        setWeeklyState({
          days,
          hasCrown: currentMember?.previousWeekWinner ?? false,
          rank: currentMember?.rank,
          status: 'success',
        });
      })
      .catch(() => {
        if (
          !disposed &&
          weeklyRequestGenerationRef.current === requestGeneration
        ) {
          setWeeklyState({
            message: CARNATION_ERROR_MESSAGE,
            status: 'error',
          });
        }
      });

    return () => {
      disposed = true;
      weeklyRequestGenerationRef.current += 1;
    };
  }, [
    carnationGateway,
    currentGroup.id,
    currentGroup.myMemberId,
    weekRange.weekEnd,
    weekRange.weekStart,
    weeklyRetryCount,
  ]);

  useEffect(() => {
    const requestGeneration = ++monthlyRequestGenerationRef.current;
    let disposed = false;

    if (!isMonthlyOpen) {
      setMonthlyState({status: 'idle'});
      return () => {
        disposed = true;
        monthlyRequestGenerationRef.current += 1;
      };
    }

    const gateway = carnationGateway;
    const memberId = currentGroup.myMemberId;
    if (gateway === undefined || memberId === undefined) {
      setMonthlyState({
        message:
          gateway === undefined
            ? '카네이션 연결 정보를 확인한 뒤 다시 시도해 주세요.'
            : MEMBER_CONFIGURATION_MESSAGE,
        status: 'error',
      });
      return () => {
        disposed = true;
        monthlyRequestGenerationRef.current += 1;
      };
    }

    const monthRange = getMonthRange(selectedMonth.year, selectedMonth.month);
    setMonthlyState({status: 'loading'});
    gateway
      .loadMemberCarnations(
        currentGroup.id,
        memberId,
        monthRange.startDate,
        monthRange.endDate,
      )
      .then(calendar => {
        if (
          disposed ||
          monthlyRequestGenerationRef.current !== requestGeneration
        ) {
          return;
        }

        const monthPrefix = `${selectedMonth.year}-${String(
          selectedMonth.month,
        ).padStart(2, '0')}-`;
        const earnedDates = calendar.earnedDates.filter(
          date =>
            date >= monthRange.startDate &&
            date <= monthRange.endDate &&
            date.startsWith(monthPrefix),
        );
        setMonthlyState(
          earnedDates.length === 0
            ? {status: 'empty'}
            : {earnedDates, status: 'success'},
        );
      })
      .catch(() => {
        if (
          !disposed &&
          monthlyRequestGenerationRef.current === requestGeneration
        ) {
          setMonthlyState({
            message: CARNATION_ERROR_MESSAGE,
            status: 'error',
          });
        }
      });

    return () => {
      disposed = true;
      monthlyRequestGenerationRef.current += 1;
    };
  }, [
    carnationGateway,
    currentGroup.id,
    currentGroup.myMemberId,
    isMonthlyOpen,
    monthlyRetryCount,
    selectedMonth.month,
    selectedMonth.year,
  ]);

  const handleProfileSave = async (
    nextProfile: GuardianProfile,
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

  const menuItems: readonly MyPageMenuItem[] = [
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
  // 내비게이터가 언마운트되므로 홈 라우트 안으로 내린다(FeedScreen 선례).
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
        <AppText style={styles.headerTitle}>마이페이지</AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MyPageProfileCard
          age={profile.age}
          gender={profile.gender}
          hasCrown={
            weeklyState.status === 'success' && weeklyState.hasCrown
          }
          name={profile.name}
          profileImageUrl={profile.profileImageUrl}
          onEdit={() => profileNavRef.current?.navigate('ProfileEdit')}
          rank={
            weeklyState.status === 'success' ? weeklyState.rank : undefined
          }
        />

        <View style={styles.stampCard}>
          <View style={styles.stampHeader}>
            <View style={styles.stampHeading}>
              <AppText style={styles.stampTitle}>효자 도장 현황</AppText>
              <AppText style={styles.weekRange}>
                {formatWeekRange(weekRange.weekStart, weekRange.weekEnd)}
              </AppText>
            </View>
            <Pressable
              accessibilityLabel="월간 효자 도장 보기"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setIsMonthlyOpen(true)}
              style={styles.calendarButton}
            >
              <MaterialDesignIcons
                color={COLORS.textStrong}
                name="calendar-blank-outline"
                size={22}
              />
            </Pressable>
          </View>
          <WeeklyStampBoard
            onRetry={() => setWeeklyRetryCount(count => count + 1)}
            state={weeklyState}
          />
        </View>

        <MyPageSettingsSection items={menuItems} />

        <MyPageFooter onLogout={handleLogout} />
      </ScrollView>

      <MonthlyStampModal
        maxMonth={currentMonth.month}
        maxYear={currentMonth.year}
        onClose={() => setIsMonthlyOpen(false)}
        onMonthChange={(year, month) => setSelectedMonth({month, year})}
        onRetry={() => setMonthlyRetryCount(count => count + 1)}
        month={selectedMonth.month}
        state={monthlyState}
        visible={isMonthlyOpen}
        year={selectedMonth.year}
      />
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

function WeeklyStampBoard({
  state,
  onRetry,
}: {
  onRetry: () => void;
  state: WeeklyStampLoadState;
}) {
  if (state.status === 'loading') {
    return (
      <View
        accessibilityLabel="주간 카네이션 불러오는 중"
        style={styles.statusBlock}
      >
        <ActivityIndicator color={COLORS.purple} size="small" />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
        <AppText style={styles.errorText}>{state.message}</AppText>
        <RetryButton
          accessibilityLabel="주간 카네이션 다시 시도"
          onPress={onRetry}
        />
      </View>
    );
  }

  if (state.status === 'empty') {
    return <AppText style={styles.emptyText}>이번 주에는 기록이 없어요.</AppText>;
  }

  return (
    <View style={styles.stampRow}>
      {state.days.map((filled, index) => (
        <CarnationStamp
          filled={filled}
          key={WEEK_DAY_KEYS[index]}
          size={38}
        />
      ))}
    </View>
  );
}

function getWeekDates(weekStart: string): readonly string[] {
  const start = new Date(`${weekStart}T00:00:00Z`);
  return Array.from({length: 7}, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

const styles = StyleSheet.create({
  calendarButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  content: {
    gap: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyText: {
    color: COLORS.textSubtle,
    fontSize: 14,
    paddingVertical: 12,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
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
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  stampCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  stampHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stampHeading: {
    flex: 1,
    gap: 4,
  },
  stampRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stampTitle: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  statusBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  weekRange: {
    color: COLORS.textSubtle,
    fontSize: 12,
  },
});
