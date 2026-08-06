import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {
  CarnationCalendar,
  CarnationGateway,
} from '../../group-info';
import {mockHardwareBack} from '../../../shared/testing/hardwareBack';
import {CarnationStamp} from '../components/CarnationStamp';
import {MyPageProfileCard} from '../components/MyPageProfileCard';
import {GUARDIAN_PROFILE} from '../fixtures/profileFixtures';
import {MyPageScreen as MyPageScreenBase} from './MyPageScreen';
import {ProfileEditScreen} from './ProfileEditScreen';
import type {ProfileGateway} from '../api/profileApi';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
// 알림 공개 진입점을 통해 NotificationsScreen이 함께 로드되므로 lucide 아이콘을 mock 처리한다.
jest.mock('lucide-react-native/icons/bell-off', () => 'BellOff');
jest.mock('lucide-react-native/icons/check', () => 'Check');
jest.mock('lucide-react-native/icons/chevron-left', () => 'ChevronLeft');
jest.mock('lucide-react-native/icons/x', () => 'X');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
// 프로필 편집 진입 시 로드되는 생년월일 스크롤 선택기는 스텁으로 대체한다.
// 이름 검증(저장 중 Back 테스트)은 실제 규칙을 그대로 쓴다.
jest.mock('../../auth', () => {
  const {SIGNUP_LIMITS, isValidName} = jest.requireActual(
    '../../auth/validation',
  );
  return {DatePickerSheet: () => null, SIGNUP_LIMITS, isValidName};
});
jest.mock('react-native-safe-area-context', () => {
  const mockReact = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const insets = {bottom: 0, left: 0, right: 0, top: 0};

  return {
    // ProfileStack(native-stack)의 SafeAreaProviderCompat이 이 컨텍스트를 구독한다.
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    initialWindowMetrics: null,
    useSafeAreaInsets: () => insets,
  };
});

// MyPageScreen이 내부에 ProfileStack 내비게이터를 렌더하므로 컨테이너가
// 필요하다. 모든 렌더 지점이 그대로 동작하도록 같은 이름의 래퍼로 감싼다.
function MyPageScreen(props: React.ComponentProps<typeof MyPageScreenBase>) {
  return (
    <NavigationContainer>
      <MyPageScreenBase {...props} />
    </NavigationContainer>
  );
}

const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'guardian'} as const,
  role: 'guardian' as const,
};

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
  jest.useRealTimers();
});

function flushPromises() {
  return Promise.resolve().then(() => Promise.resolve());
}

function calendar(
  startDate: string,
  endDate: string,
  earnedDates: readonly string[] = [],
): CarnationCalendar {
  return {earnedDates, endDate, memberId: 'member-1', startDate};
}

function gatewayWithEmptyWeek(): CarnationGateway {
  return {
    loadMemberCarnations: jest
      .fn()
      .mockResolvedValue(calendar('2026-07-27', '2026-08-02')),
    loadWeeklyRanking: jest.fn().mockResolvedValue({
      rankings: [],
      weekEnd: '2026-08-02',
      weekStart: '2026-07-27',
    }),
  };
}

function render(extra: Record<string, unknown> = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <MyPageScreen {...baseProps} {...extra} />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some(node => {
    const {children} = node.props;
    const text = Array.isArray(children) ? children.join('') : children;
    return text === value;
  });
}

test('프로필 이름·나이·성별을 표시한다', () => {
  const renderer = render();
  expect(hasText(renderer, '이종철 님')).toBe(true);
  expect(hasText(renderer, '만 27세')).toBe(true);
  expect(hasText(renderer, '남자')).toBe(true);
});

test('더보기를 누르면 프로필 편집으로 이동한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 편집'})
      .props.onPress();
  });
  expect(hasText(renderer, '프로필 편집')).toBe(true);
});

test('알림 설정 메뉴로 이동한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '알림 설정'})
      .props.onPress();
  });
  expect(hasText(renderer, '앱 푸시 알림')).toBe(true);
});

test('이용가이드 메뉴로 이동한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '이용가이드'})
      .props.onPress();
  });
  expect(hasText(renderer, '처음 시작하시나요?')).toBe(true);
});

test('로그아웃을 누르면 onRequestLogout을 호출한다', () => {
  const onRequestLogout = jest.fn();
  const renderer = render({onRequestLogout});
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '로그아웃'}).props.onPress();
  });
  expect(onRequestLogout).toHaveBeenCalledTimes(1);
});

test('renders the profile returned by the API gateway', async () => {
  const profileGateway: ProfileGateway = {
    loadCurrentProfile: jest.fn().mockResolvedValue({
      birthDate: '1995-03-17',
      gender: 'male',
      loginId: 'api-user',
      name: 'API User',
      profileImageUrl: null,
    }),
    uploadProfileImage: jest.fn(),
    updateCurrentProfile: jest.fn(),
    withdrawCurrentUser: jest.fn(),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <MyPageScreen {...baseProps} profileGateway={profileGateway} />,
    );
  });
  await TestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  expect(profileGateway.loadCurrentProfile).toHaveBeenCalledTimes(1);
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => String(node.props.children).includes('API User')),
  ).toBe(true);
});

test('프로필 조회가 끝나기 전에는 fixture와 편집 진입을 노출하지 않는다', () => {
  const pending = deferred<{
    birthDate: string;
    gender: 'male';
    loginId: string;
    name: string;
    profileImageUrl: null;
  }>();
  const updateCurrentProfile = jest.fn();
  const profileGateway: ProfileGateway = {
    loadCurrentProfile: jest.fn(() => pending.promise),
    updateCurrentProfile,
    uploadProfileImage: jest.fn(),
    withdrawCurrentUser: jest.fn(),
  };
  const renderer = render({profileGateway});

  expect(hasText(renderer, '프로필을 불러오는 중이에요.')).toBe(true);
  expect(hasText(renderer, '이종철 님')).toBe(false);
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '프로필 편집'}),
  ).toHaveLength(0);
  expect(updateCurrentProfile).not.toHaveBeenCalled();
});

test('프로필 조회 실패 화면에서 뒤로 가거나 다시 시도할 수 있다', async () => {
  const onCloseProfile = jest.fn();
  const profileGateway: ProfileGateway = {
    loadCurrentProfile: jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        birthDate: '1995-03-17',
        gender: 'male',
        loginId: 'api-user',
        name: '재시도 사용자',
        profileImageUrl: null,
      }),
    updateCurrentProfile: jest.fn(),
    uploadProfileImage: jest.fn(),
    withdrawCurrentUser: jest.fn(),
  };
  const renderer = render({onCloseProfile, profileGateway});
  await TestRenderer.act(async () => {
    await flushPromises();
  });

  expect(hasText(renderer, '프로필을 불러오지 못했어요')).toBe(true);
  expect(hasText(renderer, '이종철 님')).toBe(false);
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 조회에서 뒤로 가기'})
      .props.onPress();
  });
  expect(onCloseProfile).toHaveBeenCalledTimes(1);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 다시 시도'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  expect(hasText(renderer, '재시도 사용자 님')).toBe(true);
  expect(profileGateway.loadCurrentProfile).toHaveBeenCalledTimes(2);
});

test('새 프로필 이미지는 업로드 후 안정적인 URL로 저장하고 부모 상태를 갱신한다', async () => {
  const localAsset = {
    contentType: 'image/webp',
    fileName: 'profile.webp',
    sizeBytes: 1024,
    uri: 'content://profile.webp',
  } as const;
  const updateCurrentProfile = jest.fn().mockResolvedValue({
    id: '1',
    name: '변경된 이름',
    updatedAt: '2026-08-01T00:00:00Z',
  });
  const loadCurrentProfile = jest
    .fn()
    .mockResolvedValueOnce({
      birthDate: '1999-08-02',
      gender: 'male',
      loginId: GUARDIAN_PROFILE.loginId,
      name: GUARDIAN_PROFILE.name,
      profileImageUrl: 'https://signed.example.com/old.webp',
    })
    .mockResolvedValueOnce({
      birthDate: '1999-08-02',
      gender: 'male',
      loginId: GUARDIAN_PROFILE.loginId,
      name: '변경된 이름',
      profileImageUrl: 'https://signed.example.com/new.webp',
    });
  const profileGateway: ProfileGateway = {
    loadCurrentProfile,
    updateCurrentProfile,
    uploadProfileImage: jest
      .fn()
      .mockResolvedValue('https://cdn.example.com/new.webp'),
    withdrawCurrentUser: jest.fn(),
  };
  const renderer = render({profileGateway});
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 편집'})
      .props.onPress();
  });
  const editScreen = renderer.root.findByType(ProfileEditScreen);
  const nextProfile = {
    ...GUARDIAN_PROFILE,
    name: '변경된 이름',
    profileImageUrl: localAsset.uri,
  };

  await TestRenderer.act(async () => {
    await editScreen.props.onSave(nextProfile, {
      asset: localAsset,
      type: 'replace',
    });
    editScreen.props.onBack();
  });

  expect(profileGateway.uploadProfileImage).toHaveBeenCalledWith(localAsset);
  expect(updateCurrentProfile).toHaveBeenCalledWith({
    name: '변경된 이름',
    profileImageUrl: 'https://cdn.example.com/new.webp',
  });
  expect(loadCurrentProfile).toHaveBeenCalledTimes(2);
  expect(renderer.root.findByType(MyPageProfileCard).props).toMatchObject({
    name: '변경된 이름',
    profileImageUrl: 'https://signed.example.com/new.webp',
  });
});

test('프로필 이미지 업로드가 실패하면 프로필 PATCH를 실행하지 않는다', async () => {
  const localAsset = {
    contentType: 'image/webp',
    fileName: 'profile.webp',
    sizeBytes: 1024,
    uri: 'content://profile.webp',
  } as const;
  const updateCurrentProfile = jest.fn();
  const profileGateway: ProfileGateway = {
    loadCurrentProfile: jest.fn().mockResolvedValue({
      birthDate: '1999-08-02',
      gender: 'male',
      loginId: GUARDIAN_PROFILE.loginId,
      name: GUARDIAN_PROFILE.name,
      profileImageUrl: null,
    }),
    updateCurrentProfile,
    uploadProfileImage: jest.fn().mockRejectedValue(new Error('S3 PUT failed')),
    withdrawCurrentUser: jest.fn(),
  };
  const renderer = render({profileGateway});
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 편집'})
      .props.onPress();
  });
  const editScreen = renderer.root.findByType(ProfileEditScreen);

  await expect(
    editScreen.props.onSave(
      {...GUARDIAN_PROFILE, profileImageUrl: localAsset.uri},
      {asset: localAsset, type: 'replace'},
    ),
  ).rejects.toThrow('S3 PUT failed');

  expect(updateCurrentProfile).not.toHaveBeenCalled();
});

test('KST 현재 주 월요일부터 일요일까지 병렬 조회하고 도장·순위·왕관을 반영한다', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-26T15:30:00.000Z'));
  const loadWeeklyRanking = jest.fn().mockResolvedValue({
    rankings: [
      {
        carnationCount: 5,
        displayName: '다른 보호자',
        memberId: 'member-2',
        previousWeekWinner: false,
      },
      {
        carnationCount: 3,
        displayName: '이종철',
        memberId: 'member-1',
        previousWeekWinner: true,
      },
    ],
    weekEnd: '2026-08-02',
    weekStart: '2026-07-27',
  });
  const loadMemberCarnations = jest
    .fn()
    .mockResolvedValue(
      calendar('2026-07-27', '2026-08-02', ['2026-07-27', '2026-07-30']),
    );
  const carnationGateway: CarnationGateway = {
    loadMemberCarnations,
    loadWeeklyRanking,
  };

  const renderer = render({
    carnationGateway,
    currentGroup: {
      id: 'group-1',
      myMemberId: 'member-1',
      name: '우리 가족',
      role: 'guardian',
    },
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });

  expect(loadWeeklyRanking).toHaveBeenCalledWith(
    'group-1',
    '2026-07-27',
    '2026-08-02',
  );
  expect(loadMemberCarnations).toHaveBeenCalledWith(
    'group-1',
    'member-1',
    '2026-07-27',
    '2026-08-02',
  );
  expect(renderer.root.findByType(MyPageProfileCard).props).toMatchObject({
    hasCrown: true,
    rank: 2,
  });
  expect(
    renderer.root.findAllByType(CarnationStamp).map(stamp => stamp.props.filled),
  ).toEqual([true, false, false, true, false, false, false]);
});

test('화면을 열어 둔 채 KST 주 경계를 넘으면 새 주를 다시 조회한다', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-26T14:59:30.000Z'));
  const carnationGateway = gatewayWithEmptyWeek();
  render({
    carnationGateway,
    currentGroup: {...baseProps.currentGroup, myMemberId: 'member-1'},
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  expect(carnationGateway.loadWeeklyRanking).toHaveBeenLastCalledWith(
    'group-1',
    '2026-07-20',
    '2026-07-26',
  );

  await TestRenderer.act(async () => {
    jest.advanceTimersByTime(60_000);
    await flushPromises();
  });
  expect(carnationGateway.loadWeeklyRanking).toHaveBeenLastCalledWith(
    'group-1',
    '2026-07-27',
    '2026-08-02',
  );
});

test('myMemberId가 없으면 카네이션 API를 호출하지 않고 재시도 상태를 표시한다', async () => {
  const carnationGateway = gatewayWithEmptyWeek();
  const renderer = render({carnationGateway});
  await TestRenderer.act(async () => {
    await flushPromises();
  });

  expect(hasText(renderer, '현재 그룹의 구성원 정보를 확인할 수 없어 카네이션을 불러올 수 없습니다.')).toBe(
    true,
  );
  expect(carnationGateway.loadWeeklyRanking).not.toHaveBeenCalled();
  expect(carnationGateway.loadMemberCarnations).not.toHaveBeenCalled();

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '주간 카네이션 다시 시도'})
      .props.onPress();
  });
  expect(carnationGateway.loadWeeklyRanking).not.toHaveBeenCalled();
});

test('주간 기록이 없으면 빈 상태를 표시한다', async () => {
  const renderer = render({
    carnationGateway: gatewayWithEmptyWeek(),
    currentGroup: {
      ...baseProps.currentGroup,
      myMemberId: 'member-1',
    },
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });

  expect(hasText(renderer, '이번 주에는 기록이 없어요.')).toBe(true);
});

test('월 이동은 선택 월을 재조회하고 이전 월의 늦은 응답은 무시한다', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-01T00:00:00.000Z'));
  let resolveAugust!: (value: CarnationCalendar) => void;
  let resolveJuly!: (value: CarnationCalendar) => void;
  const augustPromise = new Promise<CarnationCalendar>(resolve => {
    resolveAugust = resolve;
  });
  const julyPromise = new Promise<CarnationCalendar>(resolve => {
    resolveJuly = resolve;
  });
  const loadMemberCarnations = jest.fn(
    (_groupId: string, _memberId: string, startDate: string) => {
      if (startDate === '2026-07-27') {
        return Promise.resolve(calendar('2026-07-27', '2026-08-02'));
      }
      if (startDate === '2026-08-01') {
        return augustPromise;
      }
      return julyPromise;
    },
  );
  const carnationGateway: CarnationGateway = {
    loadMemberCarnations,
    loadWeeklyRanking: jest.fn().mockResolvedValue({
      rankings: [],
      weekEnd: '2026-08-02',
      weekStart: '2026-07-27',
    }),
  };
  const renderer = render({
    carnationGateway,
    currentGroup: {
      id: 'group-1',
      myMemberId: 'member-1',
      name: '우리 가족',
      role: 'guardian',
    },
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '월간 효자 도장 보기'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  expect(loadMemberCarnations).toHaveBeenCalledWith(
    'group-1',
    'member-1',
    '2026-08-01',
    '2026-08-31',
  );

  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '이전 달'}).props.onPress();
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  expect(loadMemberCarnations).toHaveBeenCalledWith(
    'group-1',
    'member-1',
    '2026-07-01',
    '2026-07-31',
  );

  await TestRenderer.act(async () => {
    resolveJuly(calendar('2026-07-01', '2026-07-31', ['2026-07-03']));
    await flushPromises();
  });
  expect(hasText(renderer, '2026년 7월')).toBe(true);
  expect(
    renderer.root
      .findAllByType(CarnationStamp)
      .filter(stamp => stamp.props.filled),
  ).toHaveLength(1);

  await TestRenderer.act(async () => {
    resolveAugust(calendar('2026-08-01', '2026-08-31', ['2026-08-08']));
    await flushPromises();
  });
  expect(
    renderer.root
      .findAllByType(CarnationStamp)
      .filter(stamp => stamp.props.filled),
  ).toHaveLength(1);
});

test('월간 달력을 닫았다가 다시 열면 현재 월로 초기화한다', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-01T00:00:00.000Z'));
  const loadMemberCarnations = jest.fn(
    (_groupId: string, _memberId: string, startDate: string, endDate: string) =>
      Promise.resolve(calendar(startDate, endDate)),
  );
  const carnationGateway: CarnationGateway = {
    loadMemberCarnations,
    loadWeeklyRanking: jest.fn().mockResolvedValue({
      rankings: [],
      weekEnd: '2026-08-02',
      weekStart: '2026-07-27',
    }),
  };
  const renderer = render({
    carnationGateway,
    currentGroup: {
      ...baseProps.currentGroup,
      myMemberId: 'member-1',
    },
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '월간 효자 도장 보기'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '이전 달'}).props.onPress();
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  expect(hasText(renderer, '2026년 7월')).toBe(true);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '월간 효자 도장 닫기'})
      .props.onPress();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '월간 효자 도장 보기'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });

  expect(hasText(renderer, '2026년 8월')).toBe(true);
  expect(loadMemberCarnations).toHaveBeenLastCalledWith(
    'group-1',
    'member-1',
    '2026-08-01',
    '2026-08-31',
  );
});

test('월간 네트워크 오류는 재시도로 다시 조회한다', async () => {
  const loadMemberCarnations = jest
    .fn()
    .mockResolvedValueOnce(calendar('2026-07-27', '2026-08-02'))
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(
      calendar('2026-08-01', '2026-08-31', ['2026-08-02']),
    );
  const carnationGateway: CarnationGateway = {
    loadMemberCarnations,
    loadWeeklyRanking: jest.fn().mockResolvedValue({
      rankings: [],
      weekEnd: '2026-08-02',
      weekStart: '2026-07-27',
    }),
  };
  const renderer = render({
    carnationGateway,
    currentGroup: {...baseProps.currentGroup, myMemberId: 'member-1'},
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '월간 효자 도장 보기'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });

  expect(hasText(renderer, '카네이션 기록을 불러오지 못했어요. 다시 시도해 주세요.')).toBe(
    true,
  );
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '월간 카네이션 다시 시도'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await flushPromises();
  });
  expect(loadMemberCarnations).toHaveBeenCalledTimes(3);
  expect(
    renderer.root
      .findAllByType(CarnationStamp)
      .some(stamp => stamp.props.filled),
  ).toBe(true);
});

test('이용가이드에서 시스템 Back은 마이페이지로 돌아온다', () => {
  const back = mockHardwareBack();

  try {
    const renderer = render();
    TestRenderer.act(() => {
      renderer.root
        .findByProps({accessibilityLabel: '이용가이드'})
        .props.onPress();
    });
    expect(hasText(renderer, '처음 시작하시나요?')).toBe(true);

    let handled = false;
    TestRenderer.act(() => {
      handled = back.press();
    });

    // 컨테이너의 useBackButton이 ProfileStack을 pop해 서브 화면을 닫는다.
    expect(handled).toBe(true);
    expect(hasText(renderer, '처음 시작하시나요?')).toBe(false);
    expect(hasText(renderer, '마이페이지')).toBe(true);
  } finally {
    back.restore();
  }
});

test('서브 화면 진입·복귀에 맞춰 풀스크린 신호를 보고한다', () => {
  const onFullscreenChange = jest.fn();
  const renderer = render({onFullscreenChange});
  onFullscreenChange.mockClear();

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '이용가이드'})
      .props.onPress();
  });
  expect(onFullscreenChange).toHaveBeenLastCalledWith(true);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '뒤로 가기'})
      .props.onPress();
  });
  expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
});

test('프로필 저장 중 시스템 Back은 편집 화면을 유지한다', async () => {
  const back = mockHardwareBack();

  try {
    const renderer = render();
    TestRenderer.act(() => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 편집'})
        .props.onPress();
    });

    // 변경이 있어야 저장이 시작된다(변경 없음은 저장 자체가 거부된다).
    TestRenderer.act(() => {
      renderer.root
        .findByProps({accessibilityLabel: '이름 입력'})
        .props.onChangeText('이종수');
    });

    // 저장을 시작한다. 완료 콜백은 마이크로태스크라 아직 실행되지 않는다.
    TestRenderer.act(() => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 저장'})
        .props.onPress();
    });

    let handled = false;
    TestRenderer.act(() => {
      handled = back.press();
    });

    // 편집 화면 자체 리스너가 소비만 하고 화면을 유지한다(CHG-270 규칙 3).
    expect(handled).toBe(true);
    expect(renderer.root.findAllByType(ProfileEditScreen)).toHaveLength(1);

    // 저장이 끝나면 스스로 뒤로 가 마이페이지로 돌아온다.
    await TestRenderer.act(async () => {
      await flushPromises();
    });
    expect(renderer.root.findAllByType(ProfileEditScreen)).toHaveLength(0);
  } finally {
    back.restore();
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
}
