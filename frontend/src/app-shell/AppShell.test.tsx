import React from 'react';
import {NavigationContainer, useRoute} from '@react-navigation/native';
import {Pressable, Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import TestRenderer from 'react-test-renderer';

import {NotificationGatewayProvider} from '../features/notifications/NotificationGatewayContext';
import type {NotificationGateway} from '../features/notifications/types';
import {mockHardwareBack} from '../shared/testing/hardwareBack';
import {AppShell} from './AppShell';
import type {
  AppRoute,
  AppScreenProps,
  AppScreenRegistry,
  FamilyGroup,
} from './types';

function MockCurrentGroupSwitcher({
  groups,
  onSelect,
}: {
  groups: readonly FamilyGroup[];
  onSelect: (groupId: string) => void;
}) {
  return (
    <>
      {groups.map(group => (
        <Pressable key={group.id} onPress={() => onSelect(group.id)}>
          <Text>{group.name}</Text>
        </Pressable>
      ))}
    </>
  );
}

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('./BottomTabBar', () => ({BottomTabBar: () => null}));
jest.mock('./CurrentGroupSwitcher', () => ({
  CurrentGroupSwitcher: MockCurrentGroupSwitcher,
}));

// AppShell이 내부에 셸 스택·탭 내비게이터를 렌더하므로(S15P11B104-320)
// 컨테이너 없이는 마운트가 실패한다. 프로덕션에서는 App 루트의
// NavigationContainer를 재사용하므로 테스트도 같은 위상을 재현한다.
function withNav(element: React.ReactElement) {
  return <NavigationContainer>{element}</NavigationContainer>;
}

const GROUP_A: FamilyGroup = {
  id: 'group-a',
  name: '삭제할 그룹',
  role: 'guardian',
};
const GROUP_B: FamilyGroup = {
  id: 'group-b',
  name: '남은 그룹',
  role: 'guardian',
};

function FeedScreen({currentGroup}: AppScreenProps) {
  return <Text>{`피드:${currentGroup.name}`}</Text>;
}

function GroupInfoScreen({currentGroup}: AppScreenProps) {
  return <Text>{`그룹정보:${currentGroup.name}`}</Text>;
}

function CalendarScreen({currentGroup}: AppScreenProps) {
  return <Text>{`캘린더:${currentGroup.name}`}</Text>;
}

const screens = {
  calendar: CalendarScreen,
  feed: FeedScreen,
  groupInfo: GroupInfoScreen,
};

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some(node => {
    const children = node.props.children;
    return Array.isArray(children)
      ? children.join('') === value
      : children === value;
  });
}

function pressText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  const target = renderer.root.findAll(node => {
    if (typeof node.props.onPress !== 'function') {
      return false;
    }
    return node.findAllByType(Text).some(text => {
      const children = text.props.children;
      return Array.isArray(children)
        ? children.join('') === value
        : children === value;
    });
  })[0];
  if (target === undefined) {
    throw new Error(`누를 수 있는 "${value}" 텍스트가 없습니다.`);
  }
  TestRenderer.act(() => {
    target.props.onPress();
  });
}

test('현재 그룹이 삭제되고 대체 그룹이 지정되면 대체 그룹의 피드로 이동한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      withNav(
        <AppShell
          groups={[GROUP_A, GROUP_B]}
          initialGroupId={GROUP_A.id}
          initialRoute="groupInfo"
          screens={screens}
        />,
      ),
    );
  });

  expect(hasText(renderer!, '그룹정보:삭제할 그룹')).toBe(true);

  await TestRenderer.act(async () => {
    renderer!.update(
      withNav(
        <AppShell
          groups={[GROUP_B]}
          initialGroupId={GROUP_B.id}
          initialRoute="groupInfo"
          screens={screens}
        />,
      ),
    );
  });

  expect(hasText(renderer!, '피드:남은 그룹')).toBe(true);
  expect(hasText(renderer!, '그룹정보:남은 그룹')).toBe(false);
  TestRenderer.act(() => renderer!.unmount());
});

test('삭제가 아닌 일반 그룹 전환은 현재 화면을 유지한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      withNav(
        <AppShell
          groups={[GROUP_A, GROUP_B]}
          initialGroupId={GROUP_A.id}
          initialRoute="calendar"
          screens={screens}
        />,
      ),
    );
  });

  pressText(renderer!, '남은 그룹');

  expect(hasText(renderer!, '캘린더:남은 그룹')).toBe(true);
  expect(hasText(renderer!, '피드:남은 그룹')).toBe(false);
  TestRenderer.act(() => renderer!.unmount());
});

// 아래는 시스템 뒤로가기(S15P11B104-270) 회귀 테스트다. 위 그룹 전환 테스트와
// 목적이 달라 라우트 이름만 렌더하는 별도의 화면 레지스트리를 쓴다.

const SAFE_AREA_METRICS = {
  frame: {x: 0, y: 0, width: 390, height: 844},
  insets: {top: 0, left: 0, right: 0, bottom: 0},
};

const ALL_ROUTES: readonly AppRoute[] = [
  'feed',
  'calendar',
  'report',
  'aiCall',
  'groupInfo',
  'profile',
  'notifications',
  'archive',
];

const CARE_RECEIVER_GROUP: FamilyGroup = {
  id: 'group-1',
  name: '우리가족',
  role: 'careReceiver',
};

const GUARDIAN_GROUP: FamilyGroup = {
  id: 'group-2',
  name: '보호자가족',
  role: 'guardian',
};

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
  jest.clearAllMocks();
});

// 실제 화면 대신 라우트 이름만 렌더한다. 뒤로가기 뒤에 어떤 라우트가 남았는지만 확인하면 된다.
function createBackTestScreens(): AppScreenRegistry {
  return ALL_ROUTES.reduce<AppScreenRegistry>((registry, route) => {
    registry[route] = () => <Text>{`screen:${route}`}</Text>;
    return registry;
  }, {});
}

// AI 전화 통화 중처럼 화면이 전체화면을 차지하는 상태를 재현한다.
function FullscreenScreen({onFullscreenChange}: AppScreenProps) {
  React.useEffect(() => {
    onFullscreenChange?.(true);
  }, [onFullscreenChange]);

  return <Text>screen:aiCall</Text>;
}

function renderForBack(
  initialRoute: AppRoute,
  group: FamilyGroup,
  backTestScreens: AppScreenRegistry = createBackTestScreens(),
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      withNav(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <AppShell
            groups={[group]}
            initialGroupId={group.id}
            initialRoute={initialRoute}
            screens={backTestScreens}
          />
        </SafeAreaProvider>,
      ),
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function renderedRoute(
  renderer: TestRenderer.ReactTestRenderer,
): string | undefined {
  const label = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .find(child => typeof child === 'string' && child.startsWith('screen:'));

  return typeof label === 'string' ? label.slice('screen:'.length) : undefined;
}

test.each<AppRoute>([
  'calendar',
  'aiCall',
  'groupInfo',
  'profile',
  'notifications',
  'archive',
])('%s 라우트에서 시스템 Back은 앱을 종료하지 않고 피드로 돌아간다', route => {
  const back = mockHardwareBack();

  try {
    const renderer = renderForBack(route, CARE_RECEIVER_GROUP);
    expect(renderedRoute(renderer)).toBe(route);

    let handled = false;
    TestRenderer.act(() => {
      handled = back.press();
    });

    expect(handled).toBe(true);
    expect(renderedRoute(renderer)).toBe('feed');
  } finally {
    back.restore();
  }
});

test('보호자 리포트 탭에서 시스템 Back은 앱을 종료하지 않고 피드로 돌아간다', () => {
  const back = mockHardwareBack();

  try {
    const renderer = renderForBack('report', GUARDIAN_GROUP);
    expect(renderedRoute(renderer)).toBe('report');

    let handled = false;
    TestRenderer.act(() => {
      handled = back.press();
    });

    expect(handled).toBe(true);
    expect(renderedRoute(renderer)).toBe('feed');
  } finally {
    back.restore();
  }
});

test('피드 루트에서는 아무도 처리하지 않아 앱이 종료된다', () => {
  const back = mockHardwareBack();

  try {
    const renderer = renderForBack('feed', CARE_RECEIVER_GROUP);

    // press()가 false면 실제 앱에서 BackHandler.exitApp()이 호출된다. 홈에서의 정상 동작이다.
    let handled = true;
    TestRenderer.act(() => {
      handled = back.press();
    });

    expect(handled).toBe(false);
    expect(renderedRoute(renderer)).toBe('feed');
  } finally {
    back.restore();
  }
});

// 알림 탭 딥링크 라우팅 테스트. 알림 화면 목이 목적지 콜백을 호출하고,
// 목적지 화면 목은 전달받은 딥링크 prop을 텍스트로 렌더한다.
const DEEP_LINK_GROUP_A: FamilyGroup = {
  id: 'group-a',
  name: '가족A',
  role: 'guardian',
};
const DEEP_LINK_GROUP_B: FamilyGroup = {
  id: 'group-b',
  name: '가족B',
  role: 'guardian',
};

function FeedParamsProbe(props: AppScreenProps) {
  const route = useRoute();
  const nested = route.params as
    | {
        initial?: boolean;
        params?: {postId?: string};
        screen?: string;
      }
    | undefined;
  return (
    <Text>
      {`feed:${props.currentGroup.id}:${nested?.screen ?? 'none'}:${nested?.params?.postId ?? 'none'}:${String(nested?.initial ?? 'none')}`}
    </Text>
  );
}

// 가입 승인 딥링크도 그룹정보 탭 route의 중첩 params(GroupInfoStack
// JoinApproval)로 전달된다. FeedParamsProbe와 같은 방식의 계약 단언용 목.
function GroupInfoParamsProbe(props: AppScreenProps) {
  const route = useRoute();
  const nested = route.params as
    | {
        initial?: boolean;
        params?: {groupId?: string};
        screen?: string;
      }
    | undefined;
  return (
    <Text>
      {`groupInfo:${props.currentGroup.id}:${nested?.screen ?? 'none'}:${nested?.params?.groupId ?? 'none'}:${String(nested?.initial ?? 'none')}`}
    </Text>
  );
}

// 일정 딥링크도 캘린더 탭 route의 중첩 params(CalendarStack CalendarHome)로
// 전달된다. FeedParamsProbe와 같은 방식의 계약 단언용 목.
function CalendarParamsProbe(props: AppScreenProps) {
  const route = useRoute();
  const nested = route.params as
    | {
        initial?: boolean;
        params?: {openEventId?: string};
        screen?: string;
      }
    | undefined;
  return (
    <Text>
      {`calendar:${props.currentGroup.id}:${nested?.screen ?? 'none'}:${nested?.params?.openEventId ?? 'none'}:${String(nested?.initial ?? 'none')}`}
    </Text>
  );
}

function createDeepLinkScreens(): AppScreenRegistry {
  return {
    calendar: (props: AppScreenProps) => <CalendarParamsProbe {...props} />,
    // 게시글 딥링크는 피드 탭 route의 중첩 params(FeedStack PostDetail)로
    // 전달된다. 목 화면이 params를 렌더해 전달 계약을 단언할 수 있게 한다.
    feed: (props: AppScreenProps) => <FeedParamsProbe {...props} />,
    groupInfo: (props: AppScreenProps) => <GroupInfoParamsProbe {...props} />,
    notifications: (props: AppScreenProps) => (
      <>
        <Text>screen:notifications</Text>
        <Pressable
          onPress={() =>
            props.onOpenNotificationTarget?.({
              eventId: '7',
              groupId: 'group-b',
              kind: 'calendarEvent',
            })
          }
        >
          <Text>open-event</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            props.onOpenNotificationTarget?.({
              callSessionId: '21',
              kind: 'callReport',
              memberId: '11',
              reportDate: '2026-08-03',
            })
          }
        >
          <Text>open-call-report</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            props.onOpenNotificationTarget?.({kind: 'joinApproval'})
          }
        >
          <Text>open-join-approval</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            props.onOpenNotificationTarget?.({
              groupId: 'group-b',
              kind: 'post',
              postId: '42',
            })
          }
        >
          <Text>open-post</Text>
        </Pressable>
      </>
    ),
    report: (props: AppScreenProps) => (
      <Text>
        {`report:${props.openReportTarget?.memberId ?? 'none'}:${props.openReportTarget?.callSessionId ?? 'none'}:${props.openReportTarget?.reportDate ?? 'none'}`}
      </Text>
    ),
  };
}

function renderForDeepLink() {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      withNav(
        <AppShell
          groups={[DEEP_LINK_GROUP_A, DEEP_LINK_GROUP_B]}
          initialGroupId={DEEP_LINK_GROUP_A.id}
          initialRoute="notifications"
          screens={createDeepLinkScreens()}
        />,
      ),
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

test('게시글 목적지는 그룹을 전환하고 피드 탭에 중첩 PostDetail params를 전달한다', () => {
  const renderer = renderForDeepLink();

  pressText(renderer, 'open-post');

  // initial:false가 함께 전달되어야 콜드 마운트에서 FeedHome이 스택 밑에 깔린다.
  expect(hasText(renderer, 'feed:group-b:PostDetail:42:false')).toBe(true);
});

test('일정 목적지는 그룹을 전환하고 캘린더 탭에 중첩 CalendarHome params를 전달한다', () => {
  const renderer = renderForDeepLink();

  pressText(renderer, 'open-event');

  // initial:false가 함께 전달되어야 콜드 마운트에서 CalendarHome이 스택 밑에 깔린다.
  expect(hasText(renderer, 'calendar:group-b:CalendarHome:7:false')).toBe(true);
});

test('리포트 목적지는 리포트 화면으로 이동하며 통화·날짜를 전달한다', () => {
  const renderer = renderForDeepLink();

  pressText(renderer, 'open-call-report');

  expect(hasText(renderer, 'report:11:21:2026-08-03')).toBe(true);
});

test('가입 승인 목적지는 그룹정보 탭에 중첩 JoinApproval params를 전달한다', () => {
  const renderer = renderForDeepLink();

  pressText(renderer, 'open-join-approval');

  // groupId가 없는 목적지는 현재 그룹으로 폴백하고, initial:false가 함께
  // 전달되어야 콜드 마운트에서 GroupInfoHome이 스택 밑에 깔린다.
  expect(hasText(renderer, 'groupInfo:group-a:JoinApproval:group-a:false')).toBe(
    true,
  );
});

test('deepLinkTarget prop은 requestId가 바뀔 때 목적지로 이동한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      withNav(
        <AppShell
          deepLinkRequestId={1}
          deepLinkTarget={{eventId: '9', kind: 'calendarEvent'}}
          groups={[DEEP_LINK_GROUP_A, DEEP_LINK_GROUP_B]}
          initialGroupId={DEEP_LINK_GROUP_A.id}
          initialRoute="feed"
          screens={createDeepLinkScreens()}
        />,
      ),
    );
  });
  mountedRenderers.push(renderer!);

  expect(hasText(renderer!, 'calendar:group-a:CalendarHome:9:false')).toBe(
    true,
  );

  // 같은 requestId로는 재소비하지 않고, 증가하면 새 목적지로 이동한다.
  TestRenderer.act(() => {
    renderer!.update(
      withNav(
        <AppShell
          deepLinkRequestId={2}
          deepLinkTarget={{kind: 'notifications'}}
          groups={[DEEP_LINK_GROUP_A, DEEP_LINK_GROUP_B]}
          initialGroupId={DEEP_LINK_GROUP_A.id}
          initialRoute="feed"
          screens={createDeepLinkScreens()}
        />,
      ),
    );
  });

  expect(hasText(renderer!, 'screen:notifications')).toBe(true);
});

// 재탭 정규화 계약. 재탭의 key 리마운트는 같은 커밋이라 새 내비게이터가
// 구 스택 상태를 재수화하므로, 셸이 pop:true 중첩 params를 함께 dispatch해
// 하위 화면이 살아남지 않게 한다(내부 스택을 가진 세 탭 공통).
function TabNestedParamsProbe({prefix}: {prefix: string}) {
  const route = useRoute();
  const nested = route.params as {pop?: boolean; screen?: string} | undefined;
  return (
    <Text>
      {`${prefix}:${nested?.screen ?? 'none'}:${String(nested?.pop ?? 'none')}`}
    </Text>
  );
}

test('내부 스택을 가진 탭을 다시 누르면 스택 루트로 정규화한다', () => {
  const {BottomTabBar: MockTabBar} = jest.requireMock('./BottomTabBar') as {
    BottomTabBar: () => null;
  };
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      withNav(
        <AppShell
          groups={[GROUP_A]}
          initialGroupId={GROUP_A.id}
          initialRoute="groupInfo"
          screens={{
            calendar: () => <TabNestedParamsProbe prefix="calendar" />,
            feed: () => <Text>screen:feed</Text>,
            groupInfo: () => <TabNestedParamsProbe prefix="groupInfo" />,
            profile: () => <TabNestedParamsProbe prefix="profile" />,
          }}
        />,
      ),
    );
  });
  mountedRenderers.push(renderer!);

  TestRenderer.act(() => {
    renderer!.root.findByType(MockTabBar).props.onSelect('groupInfo');
  });
  expect(hasText(renderer!, 'groupInfo:GroupInfoHome:true')).toBe(true);

  TestRenderer.act(() => {
    renderer!.root.findByType(MockTabBar).props.onSelect('profile');
  });
  TestRenderer.act(() => {
    renderer!.root.findByType(MockTabBar).props.onSelect('profile');
  });
  expect(hasText(renderer!, 'profile:ProfileHome:true')).toBe(true);

  TestRenderer.act(() => {
    renderer!.root.findByType(MockTabBar).props.onSelect('calendar');
  });
  TestRenderer.act(() => {
    renderer!.root.findByType(MockTabBar).props.onSelect('calendar');
  });
  expect(hasText(renderer!, 'calendar:CalendarHome:true')).toBe(true);
});

// 스펙 D-3(docs/specs/UI_AND_NAVIGATION.md: 상세 진입 중에도 역할별 하단 탭
// 유지)의 첫 회귀 테스트. 게시글 상세는 헤더 숨김만 보고하고 풀스크린은
// 보고하지 않으므로 탭바가 유지되어야 하며, 풀스크린(작성·AI 통화)에서만
// 탭바가 사라진다.
test('헤더 숨김 화면에서는 하단 탭을 유지하고 풀스크린에서만 숨긴다', () => {
  const {BottomTabBar: MockTabBar} = jest.requireMock('./BottomTabBar') as {
    BottomTabBar: () => null;
  };

  function HeaderHiddenScreen({onHeaderVisibilityChange}: AppScreenProps) {
    React.useEffect(() => {
      onHeaderVisibilityChange?.(false);
    }, [onHeaderVisibilityChange]);
    return <Text>screen:feed</Text>;
  }

  const headerHiddenRenderer = renderForBack('feed', CARE_RECEIVER_GROUP, {
    ...createBackTestScreens(),
    feed: HeaderHiddenScreen,
  });
  expect(
    headerHiddenRenderer.root.findAllByType(MockTabBar).length,
  ).toBeGreaterThan(0);

  const fullscreenRenderer = renderForBack('aiCall', CARE_RECEIVER_GROUP, {
    ...createBackTestScreens(),
    aiCall: FullscreenScreen,
  });
  expect(fullscreenRenderer.root.findAllByType(MockTabBar)).toHaveLength(0);
});

test('화면이 전체화면을 보고하면 셸은 뒤로가기를 처리하지 않는다', () => {
  // AI 전화 통화 중에는 네이티브 화면이 뒤로가기를 처리하므로 셸이 가로채면 안 된다.
  const back = mockHardwareBack();

  try {
    const renderer = renderForBack('aiCall', CARE_RECEIVER_GROUP, {
      ...createBackTestScreens(),
      aiCall: FullscreenScreen,
    });

    let handled = true;
    TestRenderer.act(() => {
      handled = back.press();
    });

    expect(handled).toBe(false);
    expect(renderedRoute(renderer)).toBe('aiCall');
  } finally {
    back.restore();
  }
});

// 앱 실행 중 푸시 도착 시 미읽음 배지 실시간 갱신

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

function createPushReceivedSubscriber() {
  const listeners = new Set<() => void>();
  return {
    emit: () => {
      for (const listener of [...listeners]) {
        listener();
      }
    },
    listenerCount: () => listeners.size,
    subscribe: jest.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
  };
}

test('앱 실행 중 푸시가 도착하면 미읽음 배지를 다시 조회해 갱신한다', async () => {
  const gateway = createNotificationGateway();
  gateway.getUnreadCount.mockResolvedValueOnce(0).mockResolvedValue(3);
  const subscriber = createPushReceivedSubscriber();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(
        <NotificationGatewayProvider gateway={gateway}>
          <AppShell
            groups={[GROUP_A]}
            initialGroupId={GROUP_A.id}
            screens={screens}
            subscribePushReceived={subscriber.subscribe}
          />
        </NotificationGatewayProvider>,
      ),
    );
  });
  mountedRenderers.push(renderer!);

  expect(gateway.getUnreadCount).toHaveBeenCalledTimes(1);
  expect(renderer!.root.findAllByProps({children: 3})).toHaveLength(0);

  await TestRenderer.act(async () => {
    subscriber.emit();
  });

  expect(gateway.getUnreadCount).toHaveBeenCalledTimes(2);
  expect(
    renderer!.root.findAllByProps({children: 3}).length,
  ).toBeGreaterThan(0);
});

test('연속 푸시는 진행 중 조회와 합쳐 마지막 값으로 배지를 확정한다', async () => {
  const gateway = createNotificationGateway();
  gateway.getUnreadCount
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(1)
    .mockResolvedValue(3);
  const subscriber = createPushReceivedSubscriber();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(
        <NotificationGatewayProvider gateway={gateway}>
          <AppShell
            groups={[GROUP_A]}
            initialGroupId={GROUP_A.id}
            screens={screens}
            subscribePushReceived={subscriber.subscribe}
          />
        </NotificationGatewayProvider>,
      ),
    );
  });
  mountedRenderers.push(renderer!);

  expect(gateway.getUnreadCount).toHaveBeenCalledTimes(1);

  // 조회 응답 전에 푸시 3건이 연달아 도착하면 조회 1건 + 후속 조회 1건으로 합친다.
  await TestRenderer.act(async () => {
    subscriber.emit();
    subscriber.emit();
    subscriber.emit();
  });

  expect(gateway.getUnreadCount).toHaveBeenCalledTimes(3);
  expect(
    renderer!.root.findAllByProps({children: 3}).length,
  ).toBeGreaterThan(0);
});

test('알림 화면에서는 푸시 도착 구독을 해제해 배지를 조회하지 않는다', async () => {
  const gateway = createNotificationGateway();
  const subscriber = createPushReceivedSubscriber();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(
        <NotificationGatewayProvider gateway={gateway}>
          <AppShell
            groups={[GROUP_A]}
            initialGroupId={GROUP_A.id}
            screens={screens}
            subscribePushReceived={subscriber.subscribe}
          />
        </NotificationGatewayProvider>,
      ),
    );
  });
  mountedRenderers.push(renderer!);

  expect(subscriber.listenerCount()).toBe(1);

  // 종 아이콘을 눌러 알림 화면으로 이동하면 구독이 해제된다.
  await TestRenderer.act(async () => {
    renderer!.root.findByProps({accessibilityLabel: '알림'}).props.onPress();
  });

  expect(subscriber.listenerCount()).toBe(0);

  const callsBefore = gateway.getUnreadCount.mock.calls.length;
  await TestRenderer.act(async () => {
    subscriber.emit();
  });

  expect(gateway.getUnreadCount).toHaveBeenCalledTimes(callsBefore);
});
