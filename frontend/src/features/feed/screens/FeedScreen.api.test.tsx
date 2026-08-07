import React from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import {Alert} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {ApiError} from '../../../shared/api';
import type {FeedStackParamList} from '../navigationTypes';
import type {FeedPost} from '../types';
import {FeedScreen} from './FeedScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => {
  const mockReact = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const insets = {bottom: 0, left: 0, right: 0, top: 0};

  return {
    // FeedStack(native-stack)의 SafeAreaProviderCompat이 이 컨텍스트를 구독한다.
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    initialWindowMetrics: null,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

const detailPost: FeedPost = {
  author: {avatarText: '홍', id: 'member-1', name: '홍유라'},
  body: '상세 API 내용',
  commentCount: 0,
  createdAt: '2026-07-31T01:02:03Z',
  groupId: 'group-1',
  id: 'post-detail',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [],
};

test('상세 API는 목록에 없는 postId도 조회한다', async () => {
  const detailLoader = jest.fn().mockResolvedValue(detailPost);
  const commentsLoader = jest
    .fn()
    .mockResolvedValue({comments: [], hasNext: false});
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          commentsLoader={commentsLoader}
          detailLoader={detailLoader}
          loader={jest.fn().mockResolvedValue([])}
          role="guardian"
        />
      </NavigationContainer>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  await TestRenderer.act(async () => {
    navRef.navigate('PostDetail', {groupId: 'group-1', postId: 'post-detail'});
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(detailLoader).toHaveBeenCalledWith('post-detail', undefined, 'group-1');
  expect(commentsLoader).toHaveBeenCalledWith('post-detail', 0, 20);

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});

// 삭제된 알림 게시글 안내의 2단 복귀 (S15P11B104-369). goBack()과
// onOpenNotifications는 서로 다른 스택 형태를 담당하므로 둘 다 필요하다.
// 어느 하나만 남기면 나머지 형태에서 알림으로 돌아가지 못한다.
async function renderDeletedNotificationPost(
  navRef: ReturnType<typeof createNavigationContainerRef<FeedStackParamList>>,
  onOpenNotifications: jest.Mock,
) {
  const detailLoader = jest.fn().mockRejectedValue(
    new ApiError({
      code: 'POST_NOT_FOUND',
      kind: 'server',
      message: '삭제된 게시글',
      status: 404,
    }),
  );
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          commentsLoader={jest
            .fn()
            .mockResolvedValue({comments: [], hasNext: false})}
          detailLoader={detailLoader}
          loader={jest.fn().mockResolvedValue([])}
          onOpenNotifications={onOpenNotifications}
          role="guardian"
        />
      </NavigationContainer>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  return renderer!;
}

async function pressDeletedPostConfirm(alertSpy: jest.SpyInstance) {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as
    | readonly {onPress?: () => void}[]
    | undefined;

  await TestRenderer.act(async () => {
    buttons?.[0]?.onPress?.();
    await Promise.resolve();
  });
}

test('알림에서 열어 삭제된 게시글이면 확인 후 알림 화면으로 돌아간다', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  const onOpenNotifications = jest.fn();

  try {
    const renderer = await renderDeletedNotificationPost(
      navRef,
      onOpenNotifications,
    );

    // 알림 목록 위에서 상세를 열면 [FeedHome, notifications, PostDetail]이다.
    await TestRenderer.act(async () => {
      navRef.navigate('notifications');
      await Promise.resolve();
    });
    await TestRenderer.act(async () => {
      navRef.navigate('PostDetail', {
        entrySource: 'notification',
        groupId: 'group-1',
        postId: 'post-detail',
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await pressDeletedPostConfirm(alertSpy);

    // 이 형태에서는 goBack()만으로 알림에 도달한다.
    expect(navRef.getCurrentRoute()?.name).toBe('notifications');
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);

    await TestRenderer.act(() => {
      renderer.unmount();
    });
  } finally {
    alertSpy.mockRestore();
  }
});

test('푸시로 상세에 바로 들어와 삭제된 게시글이면 확인 후 셸에 알림 열기를 요청한다', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  const onOpenNotifications = jest.fn();

  try {
    const renderer = await renderDeletedNotificationPost(
      navRef,
      onOpenNotifications,
    );

    // 푸시 탭은 알림 목록을 거치지 않아 [FeedHome, PostDetail]이다.
    await TestRenderer.act(async () => {
      navRef.navigate('PostDetail', {
        entrySource: 'notification',
        groupId: 'group-1',
        postId: 'post-detail',
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await pressDeletedPostConfirm(alertSpy);

    // goBack()은 피드 목록까지만 간다. 알림을 여는 것은 두 번째 호출뿐이다.
    expect(navRef.getCurrentRoute()?.name).toBe('FeedHome');
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);

    await TestRenderer.act(() => {
      renderer.unmount();
    });
  } finally {
    alertSpy.mockRestore();
  }
});
