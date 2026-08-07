import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
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

test('시트 전체를 KeyboardAvoidingView(padding)로 감싸 키보드 위로 밀어 올린다', async () => {
  const renderer = await renderSheet();

  const avoidingViews = renderer.root.findAllByType(KeyboardAvoidingView);
  expect(avoidingViews).toHaveLength(1);
  expect(avoidingViews[0].props.behavior).toBe('padding');
  // 시트(핸들 포함)가 KAV 내부에 있어야 키보드가 시트를 가리지 않는다.
  expect(avoidingViews[0].findAllByType(Text).length).toBeGreaterThan(0);
});

test('콘텐츠 하단에 시스템 내비게이션 바 인셋을 패딩으로 반영한다', async () => {
  const renderer = await renderSheet();

  // 인셋 패딩은 콘텐츠 컨테이너(flexGrow/flexShrink 1)에 있어야 한다.
  const paddedNodes = renderer.root.findAll(node => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      style?.paddingBottom === 48 &&
      style?.flexGrow === 1 &&
      style?.flexShrink === 1
    );
  });
  expect(paddedNodes.length).toBeGreaterThan(0);
});

test('접힌 상태 오프셋은 내비게이션 바 인셋만큼 덜 내려간다', async () => {
  const renderer = await renderSheet({
    collapsedHeight: 260,
    initialSnap: 'collapsed',
  });

  // KAV도 onLayout을 가지므로 transform 스타일이 있는 시트 노드만 찾는다.
  const findSheetNode = () =>
    renderer.root.findAll(
      node =>
        typeof node.props.onLayout === 'function' &&
        StyleSheet.flatten(node.props.style)?.transform !== undefined,
    )[0];
  await TestRenderer.act(async () => {
    findSheetNode().props.onLayout({nativeEvent: {layout: {height: 600}}});
  });

  const transform = StyleSheet.flatten(findSheetNode().props.style)
    ?.transform as Array<{translateY: Animated.Value | number}> | undefined;
  const translateY = transform?.[0]?.translateY;
  const offset =
    typeof translateY === 'number'
      ? translateY
      : (translateY as unknown as {__getValue: () => number}).__getValue();
  // 시트 높이 600에서 보이는 260과 인셋 48을 뺀 292만 아래로 내린다.
  expect(offset).toBe(600 - 260 - 48);
});
