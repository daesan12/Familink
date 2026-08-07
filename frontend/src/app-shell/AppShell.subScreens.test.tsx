import React from 'react';
import {
  createNavigationContainerRef,
  NavigationContainer,
  type NavigationContainerRefWithCurrent,
  type ParamListBase,
} from '@react-navigation/native';
import {Pressable, Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import TestRenderer from 'react-test-renderer';

import {NotificationGatewayProvider} from '../features/notifications/NotificationGatewayContext';
import type {NotificationGateway} from '../features/notifications/types';
import {createFeedTabHostScreen} from '../shared/testing/feedTabHost';
import {mockHardwareBack} from '../shared/testing/hardwareBack';
import {AppShell} from './AppShell';
import type {
  AppScreenProps,
  AppScreenRegistry,
  FamilyGroup,
  SharedSubRoute,
} from './types';

// 셸이 소유하는 공유 하위 화면(알림·보관함)이 피드 탭 스택 안에서 호스트되는
// 접합부 계약 (S15P11B104-367).
//
// AppShell.test.tsx는 신호를 "소비"하는 셸 렌더 로직을 검증한다. 이 파일은 신호를
// "만드는" 배선 자체 — 열기·닫기·뒤로가기 소유권·스택 최상단 — 을 검증한다.
// 라우트 이름을 직접 읽으므로 화면이 동시에 마운트돼도 위양성이 생기지 않는다.

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('./BottomTabBar', () => ({BottomTabBar: () => null}));
jest.mock('./CurrentGroupSwitcher', () => ({CurrentGroupSwitcher: () => null}));

const {BottomTabBar: MockTabBar} = jest.requireMock('./BottomTabBar') as {
  BottomTabBar: () => null;
};

const SAFE_AREA_METRICS = {
  frame: {x: 0, y: 0, width: 390, height: 844},
  insets: {top: 0, left: 0, right: 0, bottom: 0},
};

const GROUP: FamilyGroup = {
  id: 'group-1',
  name: '우리가족',
  role: 'careReceiver',
};

const SUB_SCREEN_ROUTES: readonly SharedSubRoute[] = ['notifications', 'archive'];

// 피드 헤더의 종·폴더 아이콘. 프로덕션 진입 경로와 같다.
const OPENER_LABEL: Record<SharedSubRoute, string> = {
  archive: '게시글 보관함',
  notifications: '알림',
};

// 각 하위 화면이 자기 헤더에 가진 닫기 버튼.
const CLOSE_LABEL: Record<SharedSubRoute, string> = {
  archive: '보관함 닫기',
  notifications: '알림 화면 닫기',
};

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
  jest.clearAllMocks();
});

// 하위 화면 목은 자기 닫기 버튼을 가진다. 등록 지점이 onClose를 navigation.goBack
// 으로 바인딩하는지 확인하기 위해 프로덕션과 같은 라벨을 쓴다.
function createSubScreenMock(route: SharedSubRoute) {
  return function SubScreenMock({
    onCloseArchive,
    onCloseNotifications,
  }: AppScreenProps) {
    return (
      <>
        <Text>{`screen:${route}`}</Text>
        <Pressable
          accessibilityLabel={CLOSE_LABEL[route]}
          onPress={route === 'archive' ? onCloseArchive : onCloseNotifications}
        >
          <Text>{`close:${route}`}</Text>
        </Pressable>
      </>
    );
  };
}

function createScreens(
  overrides?: AppScreenRegistry,
  onSubRouteClosed?: (route: SharedSubRoute) => void,
): AppScreenRegistry {
  return {
    aiCall: () => <Text>screen:aiCall</Text>,
    archive: createSubScreenMock('archive'),
    calendar: () => <Text>screen:calendar</Text>,
    feed: createFeedTabHostScreen({onSubRouteClosed}),
    groupInfo: () => <Text>screen:groupInfo</Text>,
    notifications: createSubScreenMock('notifications'),
    profile: () => <Text>screen:profile</Text>,
    ...overrides,
  };
}

function renderShell(
  navRef: NavigationContainerRefWithCurrent<ParamListBase>,
  overrides?: AppScreenRegistry,
  onSubRouteClosed?: (route: SharedSubRoute) => void,
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <AppShell
            groups={[GROUP]}
            initialGroupId={GROUP.id}
            initialRoute="feed"
            screens={createScreens(overrides, onSubRouteClosed)}
          />
        </SafeAreaProvider>
      </NavigationContainer>,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

// 최심 포커스 라우트 이름. 스택 깊이를 세지 않고 최상단만 본다
// (GroupInfoScreen.test.tsx와 같은 관용구).
function currentRouteName(
  navRef: NavigationContainerRefWithCurrent<ParamListBase>,
) {
  return navRef.getCurrentRoute()?.name;
}

function press(renderer: TestRenderer.ReactTestRenderer, label: string) {
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: label}).props.onPress();
  });
}

function hasHeader(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByProps({testID: 'app-shell-header'}).length > 0;
}

function hasFab(renderer: TestRenderer.ReactTestRenderer) {
  return (
    renderer.root.findAllByProps({accessibilityLabel: '새 게시글 작성'}).length >
    0
  );
}

// 목 위상이 맞는지 먼저 확인한다. 이 파일의 다른 실패가 전부 여기서 비롯되는지
// 한 번에 판별하기 위한 카나리아다.
test.each(SUB_SCREEN_ROUTES)(
  '피드 헤더 아이콘은 %s를 피드 탭 스택 화면으로 연다',
  route => {
    const navRef = createNavigationContainerRef();
    const renderer = renderShell(navRef);

    expect(currentRouteName(navRef)).toBe('FeedHome');

    press(renderer, OPENER_LABEL[route]);

    expect(currentRouteName(navRef)).toBe(route);
  },
);

// AppShell.test.tsx에서 옮겨온 계약. 목적지는 그대로 피드 목록이지만, 이제 셸이
// 아니라 컨테이너의 useBackButton이 스택을 pop해 도달한다.
test.each(SUB_SCREEN_ROUTES)(
  '%s 화면에서 시스템 Back은 앱을 종료하지 않고 피드 목록으로 돌아간다',
  route => {
    const back = mockHardwareBack();

    try {
      const navRef = createNavigationContainerRef();
      const renderer = renderShell(navRef);
      const listenersOnFeed = back.size();

      press(renderer, OPENER_LABEL[route]);

      // 셸은 하위 화면 위에서 뒤로가기 리스너를 걸지 않는다. 걸면 pop이 막혀
      // 진입 지점 복귀(S15P11B104-368)가 구조적으로 불가능해진다.
      expect(back.size()).toBe(listenersOnFeed);

      let handled = false;
      TestRenderer.act(() => {
        handled = back.press();
      });

      expect(handled).toBe(true);
      expect(currentRouteName(navRef)).toBe('FeedHome');
    } finally {
      back.restore();
    }
  },
);

test('피드 목록에서는 아무도 처리하지 않아 앱이 종료된다', () => {
  // ShellStack이 아니라 FeedStack 깊이가 이 계약의 근거가 됐다.
  const back = mockHardwareBack();

  try {
    const navRef = createNavigationContainerRef();
    renderShell(navRef);

    let handled = true;
    TestRenderer.act(() => {
      handled = back.press();
    });

    expect(handled).toBe(false);
    expect(currentRouteName(navRef)).toBe('FeedHome');
  } finally {
    back.restore();
  }
});

test.each(SUB_SCREEN_ROUTES)(
  '%s 화면의 닫기 버튼은 진입 지점인 피드 목록으로 돌아간다',
  route => {
    // 등록 지점의 onClose → navigation.goBack() 바인딩 검증. 두 화면 파일에는
    // 내비게이션 훅이 없으므로 이 배선은 여기서만 깨진다.
    const navRef = createNavigationContainerRef();
    const renderer = renderShell(navRef);

    press(renderer, OPENER_LABEL[route]);
    press(renderer, CLOSE_LABEL[route]);

    expect(currentRouteName(navRef)).toBe('FeedHome');
  },
);

test.each(SUB_SCREEN_ROUTES)(
  '%s 화면이 닫히면 등록한 스택에 닫힘 후처리를 알린다',
  route => {
    // 셸 호스트가 options.onClosed를 호출하는 한 줄을 고정한다. 프로덕션에서
    // 여기에 feed.refresh가 걸려 있어, 끊기면 알림을 닫아도 목록이 낡는다.
    const onSubRouteClosed = jest.fn();
    const navRef = createNavigationContainerRef();
    const renderer = renderShell(navRef, undefined, onSubRouteClosed);

    press(renderer, OPENER_LABEL[route]);
    expect(onSubRouteClosed).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      navRef.goBack();
    });

    expect(onSubRouteClosed).toHaveBeenCalledWith(route);
  },
);

test.each(SUB_SCREEN_ROUTES)(
  '%s 화면에서 나오면 셸 헤더·FAB·탭 강조가 되돌아온다',
  route => {
    // 호스트의 포커스·언마운트 보고가 끊기면 셸 크롬이 영구히 사라진다.
    const navRef = createNavigationContainerRef();
    const renderer = renderShell(navRef);

    expect(hasHeader(renderer)).toBe(true);
    expect(hasFab(renderer)).toBe(true);

    press(renderer, OPENER_LABEL[route]);

    expect(hasHeader(renderer)).toBe(false);
    expect(hasFab(renderer)).toBe(false);
    expect(renderer.root.findByType(MockTabBar).props.activeRoute).toBeNull();

    TestRenderer.act(() => {
      navRef.goBack();
    });

    expect(currentRouteName(navRef)).toBe('FeedHome');
    expect(hasHeader(renderer)).toBe(true);
    expect(hasFab(renderer)).toBe(true);
    expect(renderer.root.findByType(MockTabBar).props.activeRoute).toBe('feed');
  },
);

test('알림 화면에서 다른 탭으로 이동하면 하위 화면이 정리되고 셸이 다시 뒤로가기를 처리한다', () => {
  // 하위 화면이 스택에 남으면 피드로 돌아올 때 다시 열린다. goToTab의
  // closeSubRoute 선행이 그것을 막는다.
  const back = mockHardwareBack();

  try {
    const navRef = createNavigationContainerRef();
    const renderer = renderShell(navRef);
    const listenersOnFeed = back.size();

    press(renderer, OPENER_LABEL.notifications);
    TestRenderer.act(() => {
      renderer.root.findByType(MockTabBar).props.onSelect('calendar');
    });

    expect(currentRouteName(navRef)).toBe('calendar');
    // 비피드 탭에서는 셸이 다시 뒤로가기를 소비한다.
    expect(back.size()).toBe(listenersOnFeed + 1);

    let handled = false;
    TestRenderer.act(() => {
      handled = back.press();
    });

    expect(handled).toBe(true);
    // 알림이 스택에 남아 있었다면 여기서 'notifications'가 나온다.
    expect(currentRouteName(navRef)).toBe('FeedHome');
  } finally {
    back.restore();
  }
});

test('알림에서 게시글을 열면 알림이 스택에서 빠지고 상세의 뒤로가기는 피드 목록으로 간다', () => {
  // 이 티켓은 뒤로가기 목적지를 바꾸지 않는다. 알림이 상세 밑에 남으면 목적지가
  // 알림으로 바뀌어 버리므로, navigateInTab의 closeSubRoute 선행이 유일한
  // 방어선이다(S15P11B104-368에서 의도적으로 제거할 이음새).
  const navRef = createNavigationContainerRef();
  const renderer = renderShell(navRef, {
    notifications: ({onOpenPost}: AppScreenProps) => (
      <Pressable onPress={() => onOpenPost?.('42', GROUP.id, 'notification')}>
        <Text>open-post</Text>
      </Pressable>
    ),
  });

  press(renderer, OPENER_LABEL.notifications);
  TestRenderer.act(() => {
    renderer.root
      .findAll(
        node =>
          typeof node.props.onPress === 'function' &&
          node.findAllByType(Text).some(t => t.props.children === 'open-post'),
      )[0]
      .props.onPress();
  });

  expect(currentRouteName(navRef)).toBe('PostDetail');

  TestRenderer.act(() => {
    navRef.goBack();
  });

  expect(currentRouteName(navRef)).toBe('FeedHome');
});

function createNotificationGateway(): jest.Mocked<NotificationGateway> {
  return {
    deactivateDeviceToken: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue(0),
    loadPage: jest.fn(),
    loadSettings: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    registerDeviceToken: jest.fn(),
    updateSettings: jest.fn(),
  } as unknown as jest.Mocked<NotificationGateway>;
}

test('알림 화면을 열면 푸시 구독을 해제하고 닫으면 다시 구독한다', async () => {
  // 신호가 호스트 보고로만 세팅되므로, 보고가 끊기면 구독이 영구히 살아 있거나
  // 영구히 죽는다. 열고 닫는 왕복으로 양방향을 함께 고정한다.
  const gateway = createNotificationGateway();
  const listeners = new Set<() => void>();
  const subscribe = jest.fn((listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  const navRef = createNavigationContainerRef();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <NotificationGatewayProvider gateway={gateway}>
            <AppShell
              groups={[GROUP]}
              initialGroupId={GROUP.id}
              initialRoute="feed"
              screens={createScreens()}
              subscribePushReceived={subscribe}
            />
          </NotificationGatewayProvider>
        </SafeAreaProvider>
      </NavigationContainer>,
    );
  });
  mountedRenderers.push(renderer!);

  expect(listeners.size).toBe(1);

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({accessibilityLabel: OPENER_LABEL.notifications})
      .props.onPress();
  });

  expect(listeners.size).toBe(0);

  await TestRenderer.act(async () => {
    navRef.goBack();
  });

  expect(listeners.size).toBe(1);
});
