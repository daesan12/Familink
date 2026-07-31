import React from 'react';
import {AccessibilityInfo} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {
  InterestSelectionScreen,
  PRESET_INTERESTS,
} from './InterestSelectionScreen';

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => new Promise<boolean>(() => {}));
});

afterEach(async () => {
  await TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => {
  const {View} = jest.requireActual('react-native');

  return {
    SafeAreaView: View,
  };
});

async function renderScreen(overrides: {
  onComplete?: jest.Mock;
  onSave?: jest.Mock;
  onSkip?: jest.Mock;
} = {}) {
  const onComplete = overrides.onComplete ?? jest.fn();
  const onSave = overrides.onSave ?? jest.fn().mockResolvedValue(undefined);
  const onSkip = overrides.onSkip ?? jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <InterestSelectionScreen
        onBack={jest.fn()}
        onComplete={onComplete}
        onSave={onSave}
        onSkip={onSkip}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  return {onComplete, onSave, onSkip, renderer: renderer!};
}

test('기본 관심사와 직접 입력 관심사를 함께 저장한다', async () => {
  const {onComplete, onSave, renderer} = await renderScreen();

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '가족과 일상 관심사'})
      .props.onPress();
    renderer.root
      .findByProps({accessibilityLabel: '관심사 직접 입력'})
      .props.onPress();
  });

  const input = renderer.root.findByProps({
    accessibilityLabel: '직접 입력할 관심사',
  });
  expect(input.props.maxLength).toBe(10);

  await TestRenderer.act(() => {
    input.props.onChangeText(' 임영웅 ');
  });
  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '직접 입력 관심사 추가'})
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '임영웅 관심사'}).props
      .accessibilityState.checked,
  ).toBe(true);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: '관심사 저장하고 다음'})
      .props.onPress();
  });

  expect(onSave).toHaveBeenCalledWith(['가족과 일상', '임영웅']);
  expect(
    renderer.root.findByProps({accessibilityLabel: '관심사 저장 완료'}),
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '피드로 이동'})
      .props.onPress();
  });
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('관심사는 최대 10개까지만 선택한다', async () => {
  const {renderer} = await renderScreen();

  await TestRenderer.act(() => {
    PRESET_INTERESTS.slice(0, 10).forEach(interest => {
      renderer.root
        .findByProps({accessibilityLabel: `${interest} 관심사`})
        .props.onPress();
    });
  });
  await TestRenderer.act(() => {
    renderer.root
      .findByProps({
        accessibilityLabel: `${PRESET_INTERESTS[10]} 관심사`,
      })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({
      children: '관심사는 최대 10개까지 선택할 수 있어요.',
    }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: `${PRESET_INTERESTS[10]} 관심사`,
    }).props.accessibilityState.checked,
  ).toBe(false);
});

test('중복된 직접 입력 관심사는 추가하지 않는다', async () => {
  const {renderer} = await renderScreen();

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '음악 관심사'})
      .props.onPress();
    renderer.root
      .findByProps({accessibilityLabel: '관심사 직접 입력'})
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '직접 입력할 관심사'})
      .props.onChangeText('음악');
  });
  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '직접 입력 관심사 추가'})
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({children: '이미 선택한 관심사예요.'}),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '관심사 직접 입력 창',
    }),
  ).toBeTruthy();
});

test('건너뛰기를 누르면 저장 없이 피드 이동을 요청한다', async () => {
  const {onSave, onSkip, renderer} = await renderScreen();

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '관심사 설정 건너뛰기'})
      .props.onPress();
  });

  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
});
