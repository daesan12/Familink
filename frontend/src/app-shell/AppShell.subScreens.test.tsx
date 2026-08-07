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

// 피드 헤더의 종·폴더 아이콘으로 여는 하위 화면. 가입 승인(joinApproval)은
// 헤더 opener가 없고 진입 지점이 알림 화면이므로 이 표에 넣지 않는다 — 아래
// test.each가 전제하는 "진입 지점 = 피드 목록"이 성립하지 않는다. 전용 테스트로 덮는다.
const OPENER_LABEL = {
  archive: '게시글 보관함',
  notifications: '알림',
} satisfies Partial<Record<SharedSubRoute, string>>;

const SUB_SCREEN_ROUTES: readonly (keyof typeof OPENER_LABEL)[] = [
  'notifications',
  'archive',
];

// 각 하위 화면이 자기 헤더에 가진 닫기 버튼.
const CLOSE_LABEL: Record<SharedSubRoute, string> = {
  archive: '보관함 닫기',
  // 가입 승인 대기는 SubScreenHeader → BackButton 기본 라벨을 그대로 쓴다. 같은
  // 스택의 다른 화면(상세·작성·알림·보관함)은 전부 고유 라벨이라 겹치지 않는다.
  joinApproval: '뒤로 가기',
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
// 셸이 라우트별로 다른 닫기 prop을 넘기므로 switch로 고른다 — 라우트가 늘면
// 컴파일 에러가 나서 배선 누락을 잡는다.
function closeHandler(route: SharedSubRoute, props: AppScreenProps) {
  switch (route) {
    case 'archive':
      return props.onCloseArchive;
    case 'joinApproval':
      return props.onCloseJoinApproval;
    case 'notifications':
      return props.onCloseNotifications;
  }
}

function createSubScreenMock(route: SharedSubRoute) {
  return function SubScreenMock(props: AppScreenProps) {
    return (
      <>
        <Text>{`screen:${route}`}</Text>
        <Pressable
          accessibilityLabel={CLOSE_LABEL[route]}
          onPress={closeHandler(route, props)}
        >
          <Text>{`close:${route}`}</Text>
        </Pressable>
      </>
    );
  };
}

// 하위 화면에서 게시글 상세를 여는 목. 호출자 차이를 그대로 재현한다 —
// NotificationsScreen은 entrySource로 'notification'을 넘기고 ArchiveScreen은
// 넘기지 않는다(기본값 'feed').
function createOpenPostMock(route: SharedSubRoute) {
  return function OpenPostMock({onOpenPost}: AppScreenProps) {
    return (
      <>
        <Text>{`screen:${route}`}</Text>
        <Pressable
          accessibilityLabel={`open-post:${route}`}
          onPress={() =>
            route === 'notifications'
              ? onOpenPost?.('42', GROUP.id, 'notification')
              : onOpenPost?.('42', GROUP.id)
          }
        >
          <Text>{`open-post:${route}`}</Text>
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
    joinApproval: createSubScreenMock('joinApproval'),
    notifications: createSubScreenMock('notifications'),
    profile: () => <Text>screen:profile</Text>,
    ...overrides,
  };
}

function renderShell(
  navRef: NavigationContainerRefWithCurrent<ParamListBase>,
  overrides?: AppScreenRegistry,
  onSubRouteClosed?: (route: SharedSubRoute) => void,
  // 딥링크 목적지 판정이 그룹 속성(isManager)에 걸리는 테스트만 바꿔 넘긴다.
  group: FamilyGroup = GROUP,
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <AppShell
            groups={[group]}
            initialGroupId={group.id}
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

test('알림 화면에서 다른 탭으로 이동하면 셸이 다시 뒤로가기를 처리하고 피드는 목록에서 시작한다', () => {
  // 피드 복귀가 FeedHome인 근거는 셸의 정리가 아니라 라이브러리 계약이다:
  // ShellRouteScreen이 비포커스에서 null을 반환해 FeedStack이 언마운트되고,
  // useNavigationBuilder의 언마운트 cleanup이 부모 route의 중첩 state를 지운다.
  // goToTab의 navigate가 탭 params까지 비우므로 재진입은 항상 스택 루트다.
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
    expect(currentRouteName(navRef)).toBe('FeedHome');
  } finally {
    back.restore();
  }
});

test.each(SUB_SCREEN_ROUTES)(
  '%s에서 연 게시글 상세의 뒤로가기는 진입 지점으로 돌아온다',
  route => {
    // 이 티켓의 본체(완료 기준 1·2). 하위 화면이 상세 밑에 남는 것이 유일한
    // 근거다 — mirrorTabRoute가 다시 pop하기 시작하면 여기서 FeedHome이 나온다.
    const navRef = createNavigationContainerRef();
    const renderer = renderShell(navRef, {[route]: createOpenPostMock(route)});

    press(renderer, OPENER_LABEL[route]);
    press(renderer, `open-post:${route}`);

    expect(currentRouteName(navRef)).toBe('PostDetail');

    TestRenderer.act(() => {
      navRef.goBack();
    });

    expect(currentRouteName(navRef)).toBe(route);

    // 하위 화면 자신의 뒤로가기는 그대로 피드 목록으로 간다.
    TestRenderer.act(() => {
      navRef.goBack();
    });

    expect(currentRouteName(navRef)).toBe('FeedHome');
  },
);

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

test('알림 위에 게시글 상세가 쌓이면 푸시 구독이 되살아난다', async () => {
  // 신호를 blur가 아니라 언마운트로만 내리면, 상세를 보는 동안 구독이 해제된
  // 채로 굳어 미읽음 배지가 갱신되지 않는다(S15P11B104-368).
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
              screens={createScreens({
                notifications: createOpenPostMock('notifications'),
              })}
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
    renderer!.root
      .findByProps({accessibilityLabel: 'open-post:notifications'})
      .props.onPress();
  });
  expect(listeners.size).toBe(1);

  await TestRenderer.act(async () => {
    navRef.goBack();
  });
  expect(listeners.size).toBe(0);
});

test('알림 위에 게시글 상세가 쌓이면 피드 탭이 다시 강조된다', () => {
  // 하위 화면이 최상단일 때만 어떤 탭도 강조하지 않는다. 상세는 피드 탭의
  // 화면이므로 피드에서 들어간 상세와 같게 보여야 한다.
  const navRef = createNavigationContainerRef();
  const renderer = renderShell(navRef, {
    notifications: createOpenPostMock('notifications'),
  });
  const activeRoute = () =>
    renderer.root.findByType(MockTabBar).props.activeRoute;

  press(renderer, OPENER_LABEL.notifications);
  expect(activeRoute()).toBeNull();

  press(renderer, 'open-post:notifications');
  expect(activeRoute()).toBe('feed');

  TestRenderer.act(() => {
    navRef.goBack();
  });
  expect(activeRoute()).toBeNull();
});

test('피드 목록에서 연 게시글 상세의 뒤로가기는 피드 목록으로 간다', () => {
  // 완료 기준 3 전반. 하위 화면이 끼어들지 않는 경로의 회귀 방어.
  const navRef = createNavigationContainerRef();
  const renderer = renderShell(navRef, {
    feed: createFeedTabHostScreen({
      renderHome: ({props}) => (
        <Pressable
          accessibilityLabel="open-post:feed"
          onPress={() => props.onOpenPost?.('42', GROUP.id)}
        >
          <Text>screen:feed</Text>
        </Pressable>
      ),
    }),
  });

  press(renderer, 'open-post:feed');

  expect(currentRouteName(navRef)).toBe('PostDetail');
  // 알림이 스택에 있었다면 그 목이 마운트된다.
  expect(
    renderer.root.findAllByProps({children: 'screen:notifications'}),
  ).toHaveLength(0);

  TestRenderer.act(() => {
    navRef.goBack();
  });

  expect(currentRouteName(navRef)).toBe('FeedHome');
});

test('보관함이 열린 채 현재 그룹이 삭제되면 대체 그룹의 피드 목록에서 시작한다', async () => {
  // 삭제된 그룹의 하위 화면을 다음 그룹에 그대로 보여주면 안 된다. goToTab이
  // 더 이상 pop하지 않으므로(S15P11B104-368) 셸이 스택 루트를 명시해야 하는데,
  // 그 호출을 지워도 잡히는 테스트가 없었다.
  const otherGroup: FamilyGroup = {
    id: 'group-2',
    name: '남은 가족',
    role: 'careReceiver',
  };
  const navRef = createNavigationContainerRef();
  let renderer: TestRenderer.ReactTestRenderer;

  const tree = (groups: readonly FamilyGroup[], initialGroupId: string) => (
    <NavigationContainer ref={navRef}>
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <AppShell
          groups={groups}
          initialGroupId={initialGroupId}
          initialRoute="feed"
          screens={createScreens()}
        />
      </SafeAreaProvider>
    </NavigationContainer>
  );

  TestRenderer.act(() => {
    renderer = TestRenderer.create(tree([GROUP, otherGroup], GROUP.id));
  });
  mountedRenderers.push(renderer!);

  press(renderer!, OPENER_LABEL.archive);
  expect(currentRouteName(navRef)).toBe('archive');

  await TestRenderer.act(async () => {
    renderer!.update(tree([otherGroup], otherGroup.id));
  });

  expect(currentRouteName(navRef)).toBe('FeedHome');
});

// 가입 승인 대기의 진입 지점 복귀 (S15P11B104-336). 알림 화면만 딥링크 목적지를
// 넘기게 하고 라우팅은 셸이 하게 둔다 — 목이 직접 열면 배선이 죽어도 초록이 된다.
// 관리자 그룹이 필요하다: 셸은 isManager가 true인 그룹에서만 승인 화면을 연다.
const MANAGER_GROUP: FamilyGroup = {
  id: 'group-2',
  isManager: true,
  name: '관리자가족',
  role: 'guardian',
};

function NotificationsDeepLinkMock({
  onOpenNotificationTarget,
}: AppScreenProps) {
  return (
    <>
      <Text>screen:notifications</Text>
      <Pressable
        accessibilityLabel="open-join-approval"
        onPress={() => onOpenNotificationTarget?.({kind: 'joinApproval'})}
      >
        <Text>open-join-approval</Text>
      </Pressable>
    </>
  );
}

// 승인 대기에서 게시글 상세를 여는 목. 탭바 숨김이 최상단만 따르는지 보려면
// 이 화면 위에 다른 화면을 쌓아야 한다.
function JoinApprovalWithPostMock(props: AppScreenProps) {
  return (
    <>
      {createSubScreenMock('joinApproval')(props)}
      <Pressable
        accessibilityLabel="open-post:joinApproval"
        onPress={() => props.onOpenPost?.('42', MANAGER_GROUP.id)}
      >
        <Text>open-post:joinApproval</Text>
      </Pressable>
    </>
  );
}

function renderShellAsManager(
  navRef: NavigationContainerRefWithCurrent<ParamListBase>,
  overrides?: AppScreenRegistry,
) {
  return renderShell(
    navRef,
    {notifications: NotificationsDeepLinkMock, ...overrides},
    undefined,
    MANAGER_GROUP,
  );
}

test('알림에서 연 가입 승인 대기는 알림 위에 쌓이고 그룹정보 탭으로 가지 않는다', () => {
  // 완료 기준 2. 승인 대기가 그룹정보 탭 화면이면 탭 전환이 FeedStack을
  // 언마운트해 중첩 state가 지워지고 알림이 소멸한다 — 그것이 이 결함이었다.
  const navRef = createNavigationContainerRef();
  const renderer = renderShellAsManager(navRef);

  press(renderer, OPENER_LABEL.notifications);
  press(renderer, 'open-join-approval');

  expect(currentRouteName(navRef)).toBe('joinApproval');
  expect(
    renderer.root.findAllByProps({children: 'screen:notifications'}),
  ).not.toHaveLength(0);
  expect(
    renderer.root.findAllByProps({children: 'screen:groupInfo'}),
  ).toHaveLength(0);
  // 셸 헤더·FAB는 자매 하위 화면과 같이 물러난다. 탭바는 이 화면만 다르므로
  // 아래 전용 테스트에서 다룬다.
  expect(hasHeader(renderer)).toBe(false);
  expect(hasFab(renderer)).toBe(false);
});

test('알림에서 연 가입 승인 대기의 시스템 Back은 알림 화면으로 돌아온다', () => {
  // 완료 기준 1. 셸이 뒤로가기를 소비하면 pop이 막혀 복귀가 구조적으로
  // 불가능해지므로 리스너 수까지 함께 고정한다.
  const back = mockHardwareBack();

  try {
    const navRef = createNavigationContainerRef();
    const renderer = renderShellAsManager(navRef);
    const listenersOnFeed = back.size();

    press(renderer, OPENER_LABEL.notifications);
    press(renderer, 'open-join-approval');

    expect(back.size()).toBe(listenersOnFeed);

    let handled = false;
    TestRenderer.act(() => {
      handled = back.press();
    });

    expect(handled).toBe(true);
    expect(currentRouteName(navRef)).toBe('notifications');

    // 알림 화면 자신의 뒤로가기는 그대로 피드 목록으로 간다.
    TestRenderer.act(() => {
      navRef.goBack();
    });

    expect(currentRouteName(navRef)).toBe('FeedHome');
  } finally {
    back.restore();
  }
});

test('알림에서 연 가입 승인 대기의 헤더 뒤로가기도 알림 화면으로 돌아온다', () => {
  // onCloseJoinApproval → closeSubRoute → 등록 지점의 navigation.goBack() 배선.
  // JoinApprovalScreen에는 내비게이션 훅이 없어 이 배선은 여기서만 깨진다.
  const navRef = createNavigationContainerRef();
  const renderer = renderShellAsManager(navRef);

  press(renderer, OPENER_LABEL.notifications);
  press(renderer, 'open-join-approval');
  press(renderer, CLOSE_LABEL.joinApproval);

  expect(currentRouteName(navRef)).toBe('notifications');
});

test('가입 승인 대기만 탭바를 숨기고 위에 쌓인 게시글 상세는 탭바를 되돌린다', () => {
  // 팀 결정: 이 화면은 탭 루트가 아니라 결정 화면이므로 그룹정보 탭에서 열 때와
  // 같은 모습을 유지한다. 알림·보관함은 반대로 탭바를 유지한다.
  //
  // 숨김 판정을 화면의 onFullscreenChange 보고로 하면 안 되는 이유를 함께
  // 고정한다: 그 boolean은 모든 화면이 공유하는 last-writer-wins 신호이고, 이
  // 화면은 위에 상세가 쌓여도 언마운트되지 않으므로 상세까지 탭바를 잃는다.
  const navRef = createNavigationContainerRef();
  const renderer = renderShellAsManager(navRef, {
    joinApproval: JoinApprovalWithPostMock,
  });

  press(renderer, OPENER_LABEL.notifications);
  expect(renderer.root.findAllByType(MockTabBar)).not.toHaveLength(0);

  press(renderer, 'open-join-approval');

  expect(renderer.root.findAllByType(MockTabBar)).toHaveLength(0);

  press(renderer, 'open-post:joinApproval');

  expect(currentRouteName(navRef)).toBe('PostDetail');
  expect(renderer.root.findAllByType(MockTabBar)).not.toHaveLength(0);

  TestRenderer.act(() => {
    navRef.goBack();
  });

  expect(currentRouteName(navRef)).toBe('joinApproval');
  expect(renderer.root.findAllByType(MockTabBar)).toHaveLength(0);

  press(renderer, CLOSE_LABEL.joinApproval);

  expect(currentRouteName(navRef)).toBe('notifications');
  expect(renderer.root.findAllByType(MockTabBar)).not.toHaveLength(0);
});
