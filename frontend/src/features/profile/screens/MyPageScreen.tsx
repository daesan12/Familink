import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {NotificationSettingsScreen} from '../../notifications';
import {CarnationStamp} from '../components/CarnationStamp';
import {MonthlyStampModal} from '../components/MonthlyStampModal';
import {MyPageFooter} from '../components/MyPageFooter';
import {MyPageProfileCard} from '../components/MyPageProfileCard';
import {
  MyPageSettingsSection,
  type MyPageMenuItem,
} from '../components/MyPageSettingsSection';
import {
  GUARDIAN_PROFILE,
  GUARDIAN_WEEKLY_STAMPS,
  MONTHLY_STAMP_DATES,
  MONTHLY_STAMP_MONTH,
  MONTHLY_STAMP_YEAR,
} from '../fixtures/profileFixtures';
import {
  mergeUserProfile,
  parseDisplayDate,
  toApiProfileUpdate,
} from '../profileModel';
import type {ProfileGateway} from '../api/profileApi';
import type {GuardianProfile} from '../types';
import {ProfileEditScreen} from './ProfileEditScreen';
import {ProfileGuideScreen} from './ProfileGuideScreen';

export interface MyPageScreenProps extends AppScreenProps {
  // 초기 프로필 주입(테스트·연동용). 없으면 mock 프로필을 사용한다.
  initialProfile?: GuardianProfile;
  onRequestWithdrawal?: () => Promise<void> | void;
  profileGateway?: ProfileGateway;
}

// 하위 전체화면. 진입 시 하단 탭을 숨긴다.
type SubScreen = 'edit' | 'guide' | 'notificationSettings' | null;

// 주간 도장(월~일) 렌더 key. 배열 index 대신 안정적인 요일 식별자를 쓴다.
const WEEK_DAY_KEYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

// I-1 마이페이지(보호자). 프로필·효자 도장·설정 메뉴를 담고 하위 화면으로 이동한다.
export function MyPageScreen({
  initialProfile,
  onFullscreenChange,
  onRequestLogout,
  onRequestWithdrawal,
  profileGateway,
}: MyPageScreenProps) {
  const [profile, setProfile] = useState(initialProfile ?? GUARDIAN_PROFILE);
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [isMonthlyOpen, setIsMonthlyOpen] = useState(false);

  // 월간 도장 이동 하한이 되는 가입월. 형식이 어긋나면 기준월로 대체한다.
  const parsedJoined = parseDisplayDate(profile.joinedAt);
  const joinedMonth = parsedJoined
    ? {year: parsedJoined.year, month: parsedJoined.month}
    : {year: MONTHLY_STAMP_YEAR, month: MONTHLY_STAMP_MONTH};

  // 하위 전체화면에 들어가면 하단 탭을 숨긴다(그룹정보 하위 화면과 같은 방식).
  useEffect(() => {
    onFullscreenChange?.(subScreen !== null);

    return () => onFullscreenChange?.(false);
  }, [subScreen, onFullscreenChange]);

  useEffect(() => {
    if (profileGateway === undefined) {
      return;
    }

    let disposed = false;
    profileGateway
      .loadCurrentProfile()
      .then(remote => {
        if (!disposed) {
          setProfile(current => mergeUserProfile(current, remote));
        }
      })
      .catch(() => {
        if (!disposed) {
          Alert.alert(
            '?꾨줈???뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??',
            '?ㅽ듃?뚰겕 ?곌껐???뺤씤?????ㅼ떆 ?쒕룄??二쇱꽭??',
          );
        }
      });

    return () => {
      disposed = true;
    };
  }, [profileGateway]);

  const handleProfileSave = (nextProfile: GuardianProfile) => {
    setProfile(nextProfile);
    if (profileGateway === undefined) {
      return;
    }

    profileGateway
      .updateCurrentProfile(toApiProfileUpdate(nextProfile))
      .catch(() => {
        Alert.alert(
          '?꾨줈???섏젙???ㅽ뙣?덉뒿?덈떎.',
          '?낅젰 媛믪쓣 ?뺤씤??二쇱꽭??吏?뺤쓣 ?쒕룄??二쇱꽭??',
        );
      });
  };

  const handleLogout = () => {
    if (onRequestLogout) {
      onRequestLogout();
      return;
    }
    Alert.alert('로그아웃', '후속 작업에서 연결될 기능입니다.');
  };

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

  if (subScreen === 'guide') {
    return <ProfileGuideScreen onBack={() => setSubScreen(null)} />;
  }

  if (subScreen === 'notificationSettings') {
    return <NotificationSettingsScreen onBack={() => setSubScreen(null)} />;
  }

  const menuItems: readonly MyPageMenuItem[] = [
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
          hasCrown={profile.hasCrown}
          name={profile.name}
          profileImageUrl={profile.profileImageUrl}
          onEdit={() => setSubScreen('edit')}
          rank={profile.weeklyRank}
        />

        <View style={styles.stampCard}>
          <View style={styles.stampHeader}>
            <Text style={styles.stampTitle}>
              {GUARDIAN_WEEKLY_STAMPS.title}
            </Text>
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
          <View style={styles.stampRow}>
            {GUARDIAN_WEEKLY_STAMPS.days.map((filled, index) => (
              <CarnationStamp
                filled={filled}
                key={WEEK_DAY_KEYS[index]}
                size={38}
              />
            ))}
          </View>
        </View>

        <MyPageSettingsSection items={menuItems} />

        <MyPageFooter onLogout={handleLogout} />
      </ScrollView>

      <MonthlyStampModal
        initialMonth={MONTHLY_STAMP_MONTH}
        initialYear={MONTHLY_STAMP_YEAR}
        maxMonth={MONTHLY_STAMP_MONTH}
        maxYear={MONTHLY_STAMP_YEAR}
        minMonth={joinedMonth.month}
        minYear={joinedMonth.year}
        onClose={() => setIsMonthlyOpen(false)}
        postDates={MONTHLY_STAMP_DATES}
        visible={isMonthlyOpen}
      />
    </View>
  );
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
});
