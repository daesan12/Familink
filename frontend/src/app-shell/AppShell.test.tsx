import React from 'react';
import {Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import TestRenderer from 'react-test-renderer';

import {mockHardwareBack} from '../shared/testing/hardwareBack';
import {AppShell} from './AppShell';
import type {
  AppRoute,
  AppScreenProps,
  AppScreenRegistry,
  FamilyGroup,
} from './types';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('lucide-react-native/icons/calendar', () => 'Icon');
jest.mock('lucide-react-native/icons/circle-user-round', () => 'Icon');
jest.mock('lucide-react-native/icons/file-chart-column', () => 'Icon');
jest.mock('lucide-react-native/icons/house', () => 'Icon');
jest.mock('lucide-react-native/icons/phone-call', () => 'Icon');
jest.mock('lucide-react-native/icons/users-round', () => 'Icon');

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
function createScreens(): AppScreenRegistry {
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

function render(
  initialRoute: AppRoute,
  group: FamilyGroup,
  screens: AppScreenRegistry = createScreens(),
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <AppShell
          groups={[group]}
          initialGroupId={group.id}
          initialRoute={initialRoute}
          screens={screens}
        />
      </SafeAreaProvider>,
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
    const renderer = render(route, CARE_RECEIVER_GROUP);
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
    const renderer = render('report', GUARDIAN_GROUP);
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
    const renderer = render('feed', CARE_RECEIVER_GROUP);

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

test('화면이 전체화면을 보고하면 셸은 뒤로가기를 처리하지 않는다', () => {
  // AI 전화 통화 중에는 네이티브 화면이 뒤로가기를 처리하므로 셸이 가로채면 안 된다.
  const back = mockHardwareBack();

  try {
    const renderer = render('aiCall', CARE_RECEIVER_GROUP, {
      ...createScreens(),
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
