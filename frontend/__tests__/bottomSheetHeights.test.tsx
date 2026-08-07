import React from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  type EmitterSubscription,
} from 'react-native';
import TestRenderer from 'react-test-renderer';

// app-shell 공개 진입점은 AppShell 전체를 끌어와 아이콘 패키지까지 로드하므로
// 시트 하나만 검증하는 이 테스트는 컴포넌트 파일을 직접 가져온다.
import {CurrentGroupSwitcher} from '../src/app-shell/CurrentGroupSwitcher';
import {GroupBottomSheet} from '../src/features/auth/components/GroupBottomSheet';
import {LoginBottomSheet} from '../src/features/auth/components/LoginBottomSheet';
import {CalendarEventsSheet} from '../src/features/calendar/components/CalendarEventsSheet';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
}));

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});

// Keyboard.emit은 이 RN 버전에 없으므로 등록된 리스너를 직접 붙잡아 호출한다.
const keyboardListeners = new Set<() => void>();

beforeEach(() => {
  keyboardListeners.clear();
  jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((eventName, listener) => {
      if (eventName === 'keyboardDidShow') {
        keyboardListeners.add(listener as () => void);
      }
      const subscription = {remove: () => undefined};
      return subscription as unknown as EmitterSubscription;
    });
});

async function emitKeyboard(_eventName: 'keyboardDidShow') {
  await TestRenderer.act(async () => {
    keyboardListeners.forEach(listener => listener());
  });
}

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

async function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(element);
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

/** 시트 본체는 transform 스타일을 가진 유일한 노드다. */
function sheetStyleOf(renderer: TestRenderer.ReactTestRenderer) {
  const [sheetNode] = renderer.root.findAll(
    node => StyleSheet.flatten(node.props.style)?.transform !== undefined,
  );
  if (sheetNode === undefined) {
    throw new Error('시트 노드를 찾지 못했습니다.');
  }
  return StyleSheet.flatten(sheetNode.props.style);
}

function scrollViewsOf(renderer: TestRenderer.ReactTestRenderer) {
  const scrollViews = renderer.root.findAllByType(ScrollView);
  expect(scrollViews.length).toBeGreaterThan(0);
  return scrollViews;
}

/**
 * ScrollView와 시트 본체 사이에서 줄어들지 못하는 래퍼를 모은다.
 * RN의 flexShrink 기본값은 0이라, 이런 래퍼가 하나라도 있으면 시트가 높이
 * 상한에 걸릴 때 안쪽이 줄지 않고 잘려 나가며 스크롤도 되지 않는다.
 */
function rigidWrappersBetweenScrollAndSheet(
  scrollView: TestRenderer.ReactTestInstance,
) {
  const rigid: string[] = [];
  let node: TestRenderer.ReactTestInstance | null = scrollView.parent;

  while (node !== null) {
    const style = StyleSheet.flatten(node.props.style);
    if (style?.transform !== undefined) {
      break;
    }
    if (typeof node.type === 'string' && style?.flexShrink !== 1) {
      rigid.push(node.type);
    }
    node = node.parent;
  }

  return rigid;
}

const GROUP = {id: 'g1', name: '우리 가족', role: 'guardian'} as const;

const LOGIN_SHEET = (
  <LoginBottomSheet onDismiss={jest.fn()} onLogin={jest.fn()} visible />
);
const GROUP_FLOW_SHEET = (
  <GroupBottomSheet
    accessibilityLabel="그룹 만들기"
    onDismiss={jest.fn()}
    visible
  >
    <Text>단계 내용</Text>
  </GroupBottomSheet>
);
const CALENDAR_SHEET = (
  <CalendarEventsSheet
    dateKey="2026-08-07"
    events={[
      {
        id: 'e1',
        title: '병원 방문',
        eventDate: '2026-08-07',
        endDate: '2026-08-07',
        startAt: '10:00',
        endAt: '11:00',
      },
    ]}
    onClose={jest.fn()}
    onOpenEvent={jest.fn()}
    visible
  />
);
const GROUP_SWITCHER_SHEET = (
  <CurrentGroupSwitcher
    currentGroup={GROUP}
    groups={[GROUP]}
    isOpen
    onClose={jest.fn()}
    onSelect={jest.fn()}
    onToggle={jest.fn()}
  />
);

const sheets: ReadonlyArray<[string, React.ReactElement]> = [
  ['로그인', LOGIN_SHEET],
  ['그룹 가입·생성', GROUP_FLOW_SHEET],
  ['선택 날짜 일정', CALENDAR_SHEET],
  ['그룹 선택', GROUP_SWITCHER_SHEET],
];

test.each(sheets)(
  '%s 시트는 고정 하한 없이 콘텐츠 높이를 따르고 상한은 공통 컴포넌트가 정한다',
  async (_label, element) => {
    const renderer = await render(element);
    const sheetStyle = sheetStyleOf(renderer);

    // 시트에 minHeight가 남아 있으면 콘텐츠가 짧을 때 빈 공간이 생긴다.
    expect(sheetStyle?.minHeight).toBeUndefined();
    // 접히는 시트는 상한이 애니메이션 값(px), 그 외에는 화면 비율 문자열이다.
    expect(sheetStyle?.maxHeight).toBeDefined();
  },
);

// 접히는 시트는 아래로 밀어내는 대신 상한 높이를 줄여야 내비게이션 바를
// 침범하지 않는다. 그래서 두 방식의 상한 표현이 다르다.
test('그룹 선택 시트는 접힘을 이동이 아니라 상한 높이로 표현한다', async () => {
  const renderer = await render(GROUP_SWITCHER_SHEET);

  // 이동으로 접으면 시트 하단이 화면 밖으로 나가 내비게이션 바를 침범한다.
  expect(sheetStyleOf(renderer)?.maxHeight).toEqual(
    expect.objectContaining({__getValue: expect.any(Function)}),
  );
});

test('선택 날짜 일정 시트는 접지 않고 상한까지 펼쳐서 연다', async () => {
  const renderer = await render(CALENDAR_SHEET);

  // 접어서 열면 일정 두 건만 보인다. 상한(비율)까지 펼치고 넘치면 스크롤한다.
  expect(sheetStyleOf(renderer)?.maxHeight).toBe('58%');
});

test.each(sheets)(
  '%s 시트는 상한에 걸려도 스크롤 영역이 줄어들 수 있다',
  async (_label, element) => {
    const renderer = await render(element);

    scrollViewsOf(renderer).forEach(scrollView => {
      expect(rigidWrappersBetweenScrollAndSheet(scrollView)).toEqual([]);
      // 스크롤 콘텐츠에 상한을 걸면 초과분이 잘리고 스크롤도 되지 않는다.
      expect(
        StyleSheet.flatten(scrollView.props.contentContainerStyle)?.maxHeight,
      ).toBeUndefined();
    });
  },
);

test.each([
  ['로그인', LOGIN_SHEET, 270],
  ['그룹 가입·생성', GROUP_FLOW_SHEET, 349],
] as ReadonlyArray<[string, React.ReactElement, number]>)(
  '%s 시트의 하한은 시트가 아닌 스크롤 콘텐츠가 갖는다',
  async (_label, element, expected) => {
    const renderer = await render(element);

    const contentStyle = StyleSheet.flatten(
      scrollViewsOf(renderer)[0].props.contentContainerStyle,
    );
    expect(contentStyle?.minHeight).toBe(expected);
  },
);

test.each([
  ['로그인', LOGIN_SHEET],
  ['그룹 가입·생성', GROUP_FLOW_SHEET],
] as ReadonlyArray<[string, React.ReactElement]>)(
  '%s 시트는 키보드가 올라오면 콘텐츠 하한을 놓아 제출 버튼을 지킨다',
  async (_label, element) => {
    const renderer = await render(element);

    await emitKeyboard('keyboardDidShow');
    // 하한이 남아 있으면 콘텐츠가 시트보다 길어져 맨 아래 버튼이 잘린다.
    expect(
      StyleSheet.flatten(
        scrollViewsOf(renderer)[0].props.contentContainerStyle,
      )?.minHeight,
    ).toBe(0);
  },
);
