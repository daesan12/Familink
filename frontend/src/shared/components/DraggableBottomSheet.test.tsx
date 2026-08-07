import React from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  type EmitterSubscription,
} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {DraggableBottomSheet} from './DraggableBottomSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 48, left: 0, right: 0, top: 0}),
}));

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});

// Keyboard.emit은 이 RN 버전에 없으므로 등록된 리스너를 직접 붙잡아 호출한다.
const keyboardListeners = new Map<string, () => void>();

beforeEach(() => {
  keyboardListeners.clear();
  jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((eventName, listener) => {
      keyboardListeners.set(eventName, listener as () => void);
      const subscription = {
        remove: () => {
          keyboardListeners.delete(eventName);
        },
      };
      return subscription as unknown as EmitterSubscription;
    });
});

async function emitKeyboard(eventName: string) {
  await TestRenderer.act(async () => {
    keyboardListeners.get(eventName)?.();
  });
}

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

async function renderSheet(
  props: Partial<React.ComponentProps<typeof DraggableBottomSheet>> = {},
): Promise<TestRenderer.ReactTestRenderer> {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <DraggableBottomSheet
        accessibilityLabel="테스트 시트"
        onClose={jest.fn()}
        visible
        {...props}
      >
        <Text>내용</Text>
      </DraggableBottomSheet>,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

// 시트 본체는 transform 스타일을 가진 유일한 노드다.
function findSheetNode(renderer: TestRenderer.ReactTestRenderer) {
  const [sheetNode] = renderer.root.findAll(
    node => StyleSheet.flatten(node.props.style)?.transform !== undefined,
  );
  if (sheetNode === undefined) {
    throw new Error('시트 노드를 찾지 못했습니다.');
  }
  return sheetNode;
}

function findSheetStyle(renderer: TestRenderer.ReactTestRenderer) {
  return StyleSheet.flatten(findSheetNode(renderer).props.style);
}

/** Animated.Value와 숫자를 함께 다루기 위한 값 추출. */
function valueOf(candidate: unknown) {
  return typeof candidate === 'number'
    ? candidate
    : (candidate as {__getValue: () => number}).__getValue();
}

test('시트 전체를 KeyboardAvoidingView(padding)로 감싸 키보드 위로 밀어 올린다', async () => {
  const renderer = await renderSheet();

  const avoidingViews = renderer.root.findAllByType(KeyboardAvoidingView);
  expect(avoidingViews).toHaveLength(1);
  expect(avoidingViews[0].props.behavior).toBe('padding');
  // 시트(핸들 포함)가 KAV 내부에 있어야 키보드가 시트를 가리지 않는다.
  expect(avoidingViews[0].findAllByType(Text).length).toBeGreaterThan(0);
});

function findContentPaddingBottom(renderer: TestRenderer.ReactTestRenderer) {
  const [contentNode] = renderer.root.findAll(node => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      style?.flexGrow === 1 &&
      style?.flexShrink === 1 &&
      style?.paddingBottom !== undefined
    );
  });
  if (contentNode === undefined) {
    throw new Error('콘텐츠 컨테이너를 찾지 못했습니다.');
  }
  return StyleSheet.flatten(contentNode.props.style)?.paddingBottom;
}

test('콘텐츠 하단에 내비게이션 바 인셋과 여백을 함께 반영한다', async () => {
  const renderer = await renderSheet();

  // 인셋(48)만 두면 콘텐츠가 내비게이션 바에 딱 붙는다. 여백 12를 더한다.
  expect(findContentPaddingBottom(renderer)).toBe(48 + 12);
});

test('키보드가 올라오면 내비게이션 바 인셋 여백을 두지 않는다', async () => {
  const renderer = await renderSheet();

  await emitKeyboard('keyboardDidShow');
  // 키보드가 내비게이션 바를 덮으므로 인셋만큼의 흰 띠를 남기면 안 된다.
  expect(findContentPaddingBottom(renderer)).toBe(12);

  await emitKeyboard('keyboardDidHide');
  expect(findContentPaddingBottom(renderer)).toBe(48 + 12);
});

test('높이 상한은 화면 비율로 두어 콘텐츠만큼만 커지게 한다', async () => {
  const renderer = await renderSheet();

  expect(findSheetStyle(renderer)?.maxHeight).toBe('85%');
});

test('maxHeightRatio는 sheetStyle의 높이 지정을 덮어쓴다', async () => {
  const renderer = await renderSheet({
    maxHeightRatio: 0.58,
    sheetStyle: {maxHeight: '30%'},
  });

  expect(findSheetStyle(renderer)?.maxHeight).toBe('58%');
});

test('접힌 시트는 화면 밖으로 밀려나지 않고 상한 높이만 줄어든다', async () => {
  const renderer = await renderSheet({
    collapsedHeight: 260,
    initialSnap: 'collapsed',
  });

  // 접힘 상한 = 보여줄 높이 260 + 내비게이션 바 인셋 48.
  // 시트를 아래로 밀어내면 하단 여백이 화면 밖으로 나가 콘텐츠가 내비게이션
  // 바를 침범하므로, 접힘은 이동이 아니라 높이로만 표현한다.
  expect(valueOf(findSheetStyle(renderer)?.maxHeight)).toBe(260 + 48);
});
