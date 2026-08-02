import React from 'react';
import TestRenderer from 'react-test-renderer';

import {CreateGroupSheet, type CreateGroupInput} from './CreateGroupSheet';
import {JoinGroupSheet} from './JoinGroupSheet';

jest.mock('./GroupBottomSheet', () => {
  const ReactRuntime = require('react');
  return {
    GroupBottomSheet: (props: Record<string, unknown>) =>
      ReactRuntime.createElement('GroupBottomSheet', props),
  };
});
jest.mock('./PrimaryButton', () => {
  const ReactRuntime = require('react');
  const {Pressable} = require('react-native');
  return {
    PrimaryButton: ({
      disabled,
      label,
      loading,
      onPress,
    }: {
      disabled?: boolean;
      label: string;
      loading?: boolean;
      onPress: () => void;
    }) =>
      ReactRuntime.createElement(Pressable, {
        accessibilityLabel: label,
        accessibilityState: {disabled: Boolean(disabled || loading)},
        disabled: disabled || loading,
        onPress,
      }),
  };
});

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>(resolve => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

test('그룹 생성 중 닫기를 잠그고 외부에서 닫히면 늦은 성공을 무시한다', async () => {
  const submission = deferred();
  const onDismiss = jest.fn();
  const onSubmit = jest.fn(
    (_input: CreateGroupInput, _signal: AbortSignal) => submission.promise,
  );
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <CreateGroupSheet onDismiss={onDismiss} onSubmit={onSubmit} visible />,
    );
  });
  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '그룹 이름'})
      .props.onChangeText('우리 가족');
  });
  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '생성하기'})
      .props.onPress();
  });

  const signal = onSubmit.mock.calls[0]?.[1] as AbortSignal | undefined;
  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '새 그룹 만들기'})
      .props.onDismiss();
  });
  expect(onDismiss).not.toHaveBeenCalled();

  TestRenderer.act(() => {
    renderer!.update(
      <CreateGroupSheet
        onDismiss={onDismiss}
        onSubmit={onSubmit}
        visible={false}
      />,
    );
  });
  expect(signal?.aborted).toBe(true);

  await TestRenderer.act(async () => {
    submission.resolve();
    await submission.promise;
  });
  expect(onDismiss).not.toHaveBeenCalled();

  TestRenderer.act(() => renderer!.unmount());
});

test('그룹 가입 중 연속 제출과 닫기를 막고 화면 종료 시 요청을 취소한다', async () => {
  const submission = deferred();
  const onDismiss = jest.fn();
  const onSubmit = jest.fn(
    (_inviteCode: string, _signal: AbortSignal) => submission.promise,
  );
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <JoinGroupSheet onDismiss={onDismiss} onSubmit={onSubmit} visible />,
    );
  });
  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '6자리 초대 코드'})
      .props.onChangeText('ABC123');
  });
  const button = renderer!.root.findByProps({
    accessibilityLabel: '참여 요청 보내기',
  });
  TestRenderer.act(() => {
    button.props.onPress();
    button.props.onPress();
  });

  expect(onSubmit).toHaveBeenCalledTimes(1);
  const signal = onSubmit.mock.calls[0]?.[1] as AbortSignal | undefined;
  TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '초대 코드로 참여'})
      .props.onDismiss();
  });
  expect(onDismiss).not.toHaveBeenCalled();

  TestRenderer.act(() => {
    renderer!.update(
      <JoinGroupSheet
        onDismiss={onDismiss}
        onSubmit={onSubmit}
        visible={false}
      />,
    );
  });
  expect(signal?.aborted).toBe(true);

  await TestRenderer.act(async () => {
    submission.resolve();
    await submission.promise;
  });
  expect(onDismiss).not.toHaveBeenCalled();

  TestRenderer.act(() => renderer!.unmount());
});
