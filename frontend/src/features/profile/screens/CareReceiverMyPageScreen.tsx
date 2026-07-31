import {useEffect, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, View} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS} from '../../../design/tokens';
import {InterestSelectionScreen} from '../../auth';
import {NotificationSettingsScreen} from '../../notifications';
import {MyPageFooter} from '../components/MyPageFooter';
import {MyPageProfileCard} from '../components/MyPageProfileCard';
import {
  MyPageSettingsSection,
  type MyPageMenuItem,
} from '../components/MyPageSettingsSection';
import {CARE_RECEIVER_PROFILE} from '../fixtures/profileFixtures';
import type {CareReceiverProfile} from '../types';
import {ProfileEditScreen} from './ProfileEditScreen';
import {ProfileGuideScreen} from './ProfileGuideScreen';

export interface CareReceiverMyPageScreenProps extends AppScreenProps {
  // 초기 프로필 주입(테스트·연동용). 없으면 mock 프로필을 사용한다.
  initialProfile?: CareReceiverProfile;
}

// 하위 전체화면. 진입 시 하단 탭을 숨긴다.
type SubScreen = 'edit' | 'interest' | 'guide' | 'notificationSettings' | null;

// J-1 마이페이지(피보호자). 효자 도장 대신 관심사 설정을 다루고, 프로필 편집·알림 설정·이용가이드는 보호자와 공유한다.
export function CareReceiverMyPageScreen({
  initialProfile,
  onFullscreenChange,
  onRequestLogout,
}: CareReceiverMyPageScreenProps) {
  const [profile, setProfile] = useState(
    initialProfile ?? CARE_RECEIVER_PROFILE,
  );
  const [subScreen, setSubScreen] = useState<SubScreen>(null);

  // 하위 전체화면에 들어가면 하단 탭을 숨긴다(보호자 마이페이지와 같은 방식).
  useEffect(() => {
    onFullscreenChange?.(subScreen !== null);

    return () => onFullscreenChange?.(false);
  }, [subScreen, onFullscreenChange]);

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
        onSave={setProfile}
        profile={profile}
      />
    );
  }

  if (subScreen === 'interest') {
    // J-3·J-3p·J-4 관심사 선택 화면을 재사용한다. 저장 완료 시 J-4p 문구를 띄우고 J-1로 돌아간다.
    return (
      <InterestSelectionScreen
        embedded
        initialInterests={profile.interests}
        onBack={() => setSubScreen(null)}
        onComplete={() => setSubScreen(null)}
        onSave={interests =>
          setProfile(current => ({...current, interests}))
        }
        onSkip={() => setSubScreen(null)}
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
      onPress: () => setSubScreen('interest'),
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
          onEdit={() => setSubScreen('edit')}
        />

        <MyPageSettingsSection items={menuItems} />

        <MyPageFooter onLogout={handleLogout} />
      </ScrollView>
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
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
});
