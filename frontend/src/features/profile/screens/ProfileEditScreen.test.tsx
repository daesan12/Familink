import React from 'react';
import {Alert, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {ApiError} from '../../../shared/api';
import {GUARDIAN_PROFILE} from '../fixtures/profileFixtures';
import type {GuardianProfile} from '../types';
import {ProfileEditScreen} from './ProfileEditScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
// 생년월일 스크롤 휠 선택기는 auth 도메인에서 검증하므로, 여기서는 확정 콜백만 노출하는 스텁으로 대체한다.
jest.mock('../../auth', () => {
  const ReactModule = require('react');
  const {Pressable} = require('react-native');
  return {
    DatePickerSheet: ({
      visible,
      onConfirm,
    }: {
      visible: boolean;
      onConfirm: (value: string) => void;
    }) =>
      visible
        ? ReactModule.createElement(Pressable, {
            accessibilityLabel: '생년월일 확정',
            onPress: () => onConfirm('1999-08-15'),
          })
        : null,
  };
});

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function render(
  onSave: (profile: GuardianProfile) => void,
  onBack = jest.fn(),
  onWithdraw?: () => Promise<void> | void,
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ProfileEditScreen
        onBack={onBack}
        onSave={onSave}
        onWithdraw={onWithdraw}
        profile={GUARDIAN_PROFILE}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

test('shows the manager transfer guidance when withdrawal is rejected', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const error = new ApiError({
    code: 'MANAGER_TRANSFER_REQUIRED',
    kind: 'server',
    message: 'manager transfer required',
    status: 409,
  });
  const renderer = render(jest.fn(), jest.fn(), () => Promise.reject(error));

  try {
    const withdrawButton = renderer.root
      .findAll(
        node =>
          typeof node.props?.onPress === 'function' &&
          String(node.props?.accessibilityLabel).includes('탈퇴'),
      )
      .pop();
    expect(withdrawButton).toBeDefined();
    TestRenderer.act(() => {
      withdrawButton?.props.onPress();
    });
    const buttons = alertSpy.mock.calls[0]?.[2] as
      | readonly {style?: string; onPress?: () => void}[]
      | undefined;
    const confirmButton = buttons?.find(button => button.style === 'destructive');
    await TestRenderer.act(async () => {
      confirmButton?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.stringContaining('그룹 관리자'),
    );
  } finally {
    alertSpy.mockRestore();
  }
});

test('성별 드롭다운에서 여자를 선택하면 반영된다', () => {
  const onSave = jest.fn();
  const renderer = render(onSave);

  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '성별 선택'}).props.onPress();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '성별 여자'})
      .props.onPress();
  });

  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
  });

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({gender: 'female'}),
  );
});

test('생년월일 스크롤 선택기에서 확정하면 표시가 바뀐다', () => {
  const onSave = jest.fn();
  const renderer = render(onSave);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '생년월일 선택'})
      .props.onPress();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '생년월일 확정'})
      .props.onPress();
  });

  const shows = renderer.root
    .findAllByType(Text)
    .some(node => node.props.children === '1999.08.15');
  expect(shows).toBe(true);
});

test('저장하면 편집한 이름을 전달하고 뒤로 돌아간다', () => {
  const onSave = jest.fn();
  const onBack = jest.fn();
  const renderer = render(onSave, onBack);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '이름 입력'})
      .props.onChangeText('이종철2');
  });
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
  });

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({name: '이종철2'}),
  );
  expect(onBack).toHaveBeenCalledTimes(1);
});
