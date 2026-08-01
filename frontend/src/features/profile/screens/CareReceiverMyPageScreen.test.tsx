import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {ProfileGateway} from '../api/profileApi';
import {MyPageProfileCard} from '../components/MyPageProfileCard';
import {CARE_RECEIVER_PROFILE} from '../fixtures/profileFixtures';
import {CareReceiverMyPageScreen} from './CareReceiverMyPageScreen';
import {ProfileEditScreen} from './ProfileEditScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
// 알림 공개 진입점을 통해 NotificationsScreen이 함께 로드되므로 lucide 아이콘을 mock 처리한다.
jest.mock('lucide-react-native/icons/bell-off', () => 'BellOff');
jest.mock('lucide-react-native/icons/check', () => 'Check');
jest.mock('lucide-react-native/icons/chevron-left', () => 'ChevronLeft');
jest.mock('lucide-react-native/icons/x', () => 'X');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
// auth 공개 진입점(생년월일 선택기·관심사 화면)은 스텁으로 대체한다.
jest.mock('../../auth', () => {
  const ReactModule = require('react');
  const {Pressable, Text: RNText, View: RNView} = require('react-native');
  return {
    DatePickerSheet: () => null,
    getInterestErrorMessage: (_error: unknown, fallback: string) => fallback,
    InterestSelectionScreen: ({
      initialInterests,
      onComplete,
      onSave,
    }: {
      initialInterests?: readonly string[];
      onComplete: () => void;
      onSave: (interests: readonly string[]) => Promise<void> | void;
    }) =>
      ReactModule.createElement(
        RNView,
        null,
        ReactModule.createElement(
          RNText,
          null,
          `관심사:${(initialInterests ?? []).join(',')}`,
        ),
        ReactModule.createElement(
          Pressable,
          {accessibilityLabel: '관심사 화면 완료', onPress: onComplete},
          ReactModule.createElement(RNText, null, '완료'),
        ),
        ReactModule.createElement(
          Pressable,
          {
            accessibilityLabel: '관심사 화면 저장',
            onPress: () => onSave(['음악']),
          },
          ReactModule.createElement(RNText, null, '저장'),
        ),
      ),
  };
});

const baseProps = {
  currentGroup: {
    id: 'group-1',
    myMemberId: 'member-1',
    name: '우리 가족',
    role: 'careReceiver',
  } as const,
  role: 'careReceiver' as const,
};

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function render(extra: Record<string, unknown> = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <CareReceiverMyPageScreen {...baseProps} {...extra} />,
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

test('피보호자 프로필 이름·나이·성별을 표시한다', () => {
  const renderer = render();
  expect(hasText(renderer, '손수호 님')).toBe(true);
  expect(hasText(renderer, '만 67세')).toBe(true);
  expect(hasText(renderer, '남자')).toBe(true);
});

test('설정 메뉴에 관심사 설정이 포함된다', () => {
  const renderer = render();
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '관심사 설정'}).length,
  ).toBeGreaterThan(0);
});

test('Gateway가 없으면 로컬 fixture를 서버 관심사처럼 표시하지 않는다', async () => {
  const renderer = render();

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: '관심사 설정'})
      .props.onPress();
  });

  expect(hasText(renderer, '관심사를 불러오지 못했어요')).toBe(true);
  expect(
    hasText(renderer, '관심사:가족과 일상,산책과 운동,역사와 추억,임영웅,츄'),
  ).toBe(false);
});

test('관심사 설정으로 이동하며 서버 관심사를 전달한다', async () => {
  const interestGateway = {
    loadInterests: jest.fn().mockResolvedValue({
      interests: ['서버 관심사'],
      memberId: 'member-1',
    }),
    replaceInterests: jest.fn(),
  };
  const renderer = render({interestGateway});
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: '관심사 설정'})
      .props.onPress();
  });
  expect(hasText(renderer, '관심사:서버 관심사')).toBe(true);

  // 완료하면 J-1로 돌아온다.
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '관심사 화면 완료'})
      .props.onPress();
  });
  expect(hasText(renderer, '손수호 님')).toBe(true);
});

test('알림 설정·이용가이드로 이동한다', () => {
  const renderer = render();
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '알림 설정'}).props.onPress();
  });
  expect(hasText(renderer, '앱 푸시 알림')).toBe(true);
});

test('로그아웃을 누르면 onRequestLogout을 호출한다', () => {
  const onRequestLogout = jest.fn();
  const renderer = render({onRequestLogout});
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '로그아웃'}).props.onPress();
  });
  expect(onRequestLogout).toHaveBeenCalledTimes(1);
});

test('프로필 이미지 제거는 null로 저장하고 성공한 뒤에만 부모 상태를 갱신한다', async () => {
  const updateCurrentProfile = jest.fn().mockResolvedValue({
    id: '2',
    name: CARE_RECEIVER_PROFILE.name,
    updatedAt: '2026-08-01T00:00:00Z',
  });
  const profileGateway: ProfileGateway = {
    loadCurrentProfile: jest.fn().mockResolvedValue({
      birthDate: '1959-05-20',
      gender: 'male',
      loginId: CARE_RECEIVER_PROFILE.loginId,
      name: CARE_RECEIVER_PROFILE.name,
      profileImageUrl: 'https://cdn.example.com/old.webp',
    }),
    updateCurrentProfile,
    uploadProfileImage: jest.fn(),
    withdrawCurrentUser: jest.fn(),
  };
  const renderer = render({profileGateway});
  await TestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 편집'})
      .props.onPress();
  });
  const editScreen = renderer.root.findByType(ProfileEditScreen);

  await TestRenderer.act(async () => {
    await editScreen.props.onSave(
      {...CARE_RECEIVER_PROFILE, profileImageUrl: null},
      {type: 'remove'},
    );
    editScreen.props.onBack();
  });

  expect(profileGateway.uploadProfileImage).not.toHaveBeenCalled();
  expect(updateCurrentProfile).toHaveBeenCalledWith(
    expect.objectContaining({profileImageUrl: null}),
  );
  expect(renderer.root.findByType(MyPageProfileCard).props).toMatchObject({
    profileImageUrl: null,
  });
});

test('서버 조회가 끝날 때까지 편집 화면을 표시하지 않는다', async () => {
  const pending = deferred<{
    interests: readonly string[];
    memberId: string;
  }>();
  const interestGateway = {
    loadInterests: jest.fn(() => pending.promise),
    replaceInterests: jest.fn(),
  };
  const renderer = render({interestGateway});

  let openPromise: Promise<void>;
  await TestRenderer.act(() => {
    openPromise = renderer.root
      .findByProps({accessibilityLabel: '관심사 설정'})
      .props.onPress();
  });
  expect(hasText(renderer, '관심사를 불러오는 중이에요.')).toBe(true);
  expect(hasText(renderer, '관심사:')).toBe(false);

  await TestRenderer.act(async () => {
    pending.resolve({interests: ['서버 관심사'], memberId: 'member-1'});
    await openPromise!;
  });
  expect(hasText(renderer, '관심사:서버 관심사')).toBe(true);
  expect(interestGateway.loadInterests).toHaveBeenCalledWith(
    'group-1',
    'member-1',
  );
});

test('조회 실패 후 다시 시도하면 서버 관심사를 표시한다', async () => {
  const interestGateway = {
    loadInterests: jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        interests: ['재시도 관심사'],
        memberId: 'member-1',
      }),
    replaceInterests: jest.fn(),
  };
  const renderer = render({interestGateway});

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: '관심사 설정'})
      .props.onPress();
  });
  expect(hasText(renderer, '관심사를 불러오지 못했어요')).toBe(true);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: '관심사 다시 시도'})
      .props.onPress();
  });
  expect(hasText(renderer, '관심사:재시도 관심사')).toBe(true);
  expect(interestGateway.loadInterests).toHaveBeenCalledTimes(2);
});

test('뒤로 간 뒤 도착한 조회 응답을 무시한다', async () => {
  const pending = deferred<{
    interests: readonly string[];
    memberId: string;
  }>();
  const interestGateway = {
    loadInterests: jest.fn(() => pending.promise),
    replaceInterests: jest.fn(),
  };
  const renderer = render({interestGateway});

  let openPromise: Promise<void>;
  await TestRenderer.act(() => {
    openPromise = renderer.root
      .findByProps({accessibilityLabel: '관심사 설정'})
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '관심사 조회에서 뒤로 가기'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    pending.resolve({interests: ['늦은 관심사'], memberId: 'member-1'});
    await openPromise!;
  });

  expect(hasText(renderer, '손수호 님')).toBe(true);
  expect(hasText(renderer, '관심사:늦은 관심사')).toBe(false);
});

test('그룹 변경 시 관심사 화면을 닫고 이전 응답을 무시한다', async () => {
  const pending = deferred<{
    interests: readonly string[];
    memberId: string;
  }>();
  const interestGateway = {
    loadInterests: jest.fn(() => pending.promise),
    replaceInterests: jest.fn(),
  };
  const renderer = render({interestGateway});

  let openPromise: Promise<void>;
  await TestRenderer.act(() => {
    openPromise = renderer.root
      .findByProps({accessibilityLabel: '관심사 설정'})
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer.update(
      <CareReceiverMyPageScreen
        {...baseProps}
        currentGroup={{
          id: 'group-2',
          myMemberId: 'member-2',
          name: '다른 가족',
          role: 'careReceiver',
        }}
        interestGateway={interestGateway}
      />,
    );
  });
  await TestRenderer.act(async () => {
    pending.resolve({interests: ['이전 그룹 관심사'], memberId: 'member-1'});
    await openPromise!;
  });

  expect(hasText(renderer, '손수호 님')).toBe(true);
  expect(hasText(renderer, '관심사:이전 그룹 관심사')).toBe(false);
});

test('현재 그룹과 멤버로 저장하고 서버 정규화 결과만 반영한다', async () => {
  const interestGateway = {
    loadInterests: jest.fn().mockResolvedValue({
      interests: ['조회 관심사'],
      memberId: 'member-1',
    }),
    replaceInterests: jest.fn().mockResolvedValue({
      interests: ['서버 정규화 관심사'],
      memberId: 'member-1',
    }),
  };
  const renderer = render({interestGateway});

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: '관심사 설정'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: '관심사 화면 저장'})
      .props.onPress();
  });

  expect(interestGateway.replaceInterests).toHaveBeenCalledWith(
    'group-1',
    'member-1',
    ['음악'],
  );
  expect(hasText(renderer, '관심사:서버 정규화 관심사')).toBe(true);
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
