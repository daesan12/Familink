import React from 'react';
import {Alert, BackHandler, Text} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import TestRenderer from 'react-test-renderer';

import {ApiError} from '../../../shared/api';
import {mockHardwareBack} from '../../../shared/testing/hardwareBack';
import {GUARDIAN_PROFILE} from '../fixtures/profileFixtures';
import type {GuardianProfile, ProfileImageChange} from '../types';
import {ProfileEditScreen} from './ProfileEditScreen';
import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
// 생년월일 스크롤 휠 선택기는 auth 도메인에서 검증하므로, 여기서는 확정 콜백만 노출하는 스텁으로 대체한다.
jest.mock('../../auth', () => {
  const ReactModule = require('react');
  const {Pressable} = require('react-native');
  // 인라인 검증 문구와 이름 길이 규칙은 회원가입과 같은 구현을 공유해야 하므로 실제 모듈을 쓴다.
  const {ValidationMessage} = require('../../auth/components/ValidationMessage');
  const {isValidName, SIGNUP_LIMITS} = require('../../auth/validation');
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
    isValidName,
    SIGNUP_LIMITS,
    ValidationMessage,
  };
});

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];
const mockLaunchImageLibrary = launchImageLibrary as jest.MockedFunction<
  typeof launchImageLibrary
>;

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
  jest.clearAllMocks();
});

function render(
  onSave: (
    profile: GuardianProfile,
    imageChange: ProfileImageChange,
  ) => Promise<void>,
  onBack = jest.fn(),
  onWithdraw?: () => Promise<void> | void,
  profile: GuardianProfile = GUARDIAN_PROFILE,
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ProfileEditScreen
        onBack={onBack}
        onSave={onSave}
        onWithdraw={onWithdraw}
        profile={profile}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

// 변경사항이 없으면 저장이 막히므로, 저장 흐름을 검증하는 테스트는 먼저 이름을 바꾼다.
function editName(renderer: TestRenderer.ReactTestRenderer, value: string) {
  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '이름 입력'})
      .props.onChangeText(value);
  });
}

function nameErrorMessages(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter((child): child is string => typeof child === 'string');
}

test('저장 중 시스템 Back은 화면을 닫지 않고 소비한다', async () => {
  let hardwareBackHandler: (() => boolean) | undefined;
  const addEventListener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      hardwareBackHandler = () => handler({} as never) === true;
      return {remove: jest.fn()};
    });
  let resolveSave!: () => void;
  const savePromise = new Promise<void>(resolve => {
    resolveSave = resolve;
  });
  const onBack = jest.fn();
  const renderer = render(jest.fn(() => savePromise), onBack);
  editName(renderer, '이종철2');

  try {
    TestRenderer.act(() => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 저장'})
        .props.onPress();
    });

    TestRenderer.act(() => {
      expect(hardwareBackHandler?.()).toBe(true);
    });
    expect(onBack).not.toHaveBeenCalled();

    await TestRenderer.act(async () => {
      resolveSave();
      await savePromise;
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  } finally {
    addEventListener.mockRestore();
  }
});

test('성별 드롭다운이 열려 있으면 시스템 Back은 드롭다운만 닫는다', () => {
  // 성별 드롭다운은 Modal이 아니라 인라인 View라서 Back이 JS 리스너까지 내려온다.
  const back = mockHardwareBack();
  const onBack = jest.fn();

  try {
    const renderer = render(jest.fn(async () => undefined), onBack);

    TestRenderer.act(() => {
      renderer.root
        .findByProps({accessibilityLabel: '성별 선택'})
        .props.onPress();
    });
    expect(
      renderer.root.findAllByProps({accessibilityLabel: '성별 남자'}).length,
    ).toBeGreaterThan(0);

    let handled = false;
    TestRenderer.act(() => {
      handled = back.press();
    });

    expect(handled).toBe(true);
    expect(
      renderer.root.findAllByProps({accessibilityLabel: '성별 남자'}),
    ).toHaveLength(0);
    expect(onBack).not.toHaveBeenCalled();

    // 드롭다운을 닫은 다음의 Back은 편집 화면을 닫는다.
    TestRenderer.act(() => {
      back.press();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  } finally {
    back.restore();
  }
});

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
  const onSave = jest.fn().mockResolvedValue(undefined);
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
    {type: 'unchanged'},
  );
});

test('생년월일 스크롤 선택기에서 확정하면 표시가 바뀐다', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
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

test('이름을 모두 지우면 회원가입과 같은 안내 문구를 placeholder로 보여준다', () => {
  const renderer = render(jest.fn().mockResolvedValue(undefined));
  const input = renderer.root.findByProps({accessibilityLabel: '이름 입력'});

  TestRenderer.act(() => {
    input.props.onChangeText('');
  });

  const nameInput = renderer.root.findByProps({accessibilityLabel: '이름 입력'});
  expect(nameInput.props.value).toBe('');
  expect(nameInput.props.placeholder).toBe('이름은 2 ~ 10자로 입력해주세요.');
});

test('이름을 비운 채 저장하면 OS 팝업 없이 입력칸 아래에 안내한다', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onBack = jest.fn();
  const renderer = render(onSave, onBack);

  try {
    editName(renderer, '');
    TestRenderer.act(() => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 저장'})
        .props.onPress();
    });

    expect(nameErrorMessages(renderer)).toContain('빈 칸을 채워주세요.');
    expect(onSave).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  } finally {
    alertSpy.mockRestore();
  }
});

test('이름이 2자 미만이면 회원가입과 같은 문구로 저장을 막는다', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const renderer = render(onSave);

  editName(renderer, '이');
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
  });

  expect(nameErrorMessages(renderer)).toContain('이름은 2 ~ 10자로 입력해주세요.');
  expect(onSave).not.toHaveBeenCalled();
});

test('10자를 넘겨 입력하면 10자에서 멈추고 즉시 안내한다', () => {
  const renderer = render(jest.fn().mockResolvedValue(undefined));

  editName(renderer, '가나다라마바사아자차카');

  const input = renderer.root.findByProps({accessibilityLabel: '이름 입력'});
  expect(input.props.value).toBe('가나다라마바사아자차');
  expect(nameErrorMessages(renderer)).toContain('이름은 2 ~ 10자로 입력해주세요.');
});

test('10자 이내 입력은 안내 없이 그대로 반영한다', () => {
  const renderer = render(jest.fn().mockResolvedValue(undefined));

  editName(renderer, '가나다라마바사아자차');

  const input = renderer.root.findByProps({accessibilityLabel: '이름 입력'});
  expect(input.props.value).toBe('가나다라마바사아자차');
  expect(nameErrorMessages(renderer)).not.toContain(
    '이름은 2 ~ 10자로 입력해주세요.',
  );
});

test('프로필 이미지 아래 + 버튼도 사진 선택을 연다', async () => {
  const renderer = render(jest.fn().mockResolvedValue(undefined));
  mockLaunchImageLibrary.mockResolvedValueOnce({didCancel: true});

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 이미지 추가'})
      .props.onPress();
    await Promise.resolve();
  });

  expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(1);
});

test('변경사항이 없으면 저장을 막고 동일한 이름임을 안내한다', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onBack = jest.fn();
  const renderer = render(onSave, onBack);

  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
  });

  expect(nameErrorMessages(renderer)).toContain('기존과 동일한 이름입니다.');
  expect(onSave).not.toHaveBeenCalled();
  expect(onBack).not.toHaveBeenCalled();
});

test('이름은 그대로여도 다른 항목을 바꾸면 저장할 수 있다', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const renderer = render(onSave);

  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '성별 선택'}).props.onPress();
  });
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '성별 여자'}).props.onPress();
  });
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
  });

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({gender: 'female', name: GUARDIAN_PROFILE.name}),
    {type: 'unchanged'},
  );
});

test('안내가 뜬 뒤 이름을 고치면 문구가 사라진다', () => {
  const renderer = render(jest.fn().mockResolvedValue(undefined));

  editName(renderer, '이');
  TestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
  });
  expect(nameErrorMessages(renderer)).toContain('이름은 2 ~ 10자로 입력해주세요.');

  editName(renderer, '이종철2');

  expect(nameErrorMessages(renderer)).not.toContain(
    '이름은 2 ~ 10자로 입력해주세요.',
  );
});

test('저장 성공 후 편집한 이름을 전달하고 뒤로 돌아간다', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onBack = jest.fn();
  const renderer = render(onSave, onBack);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '이름 입력'})
      .props.onChangeText('이종철2');
  });
  await TestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
    await Promise.resolve();
  });

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({name: '이종철2'}),
    {type: 'unchanged'},
  );
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('선택한 프로필 이미지를 미리보기하고 저장할 때 교체 정보를 전달한다', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const renderer = render(onSave);
  mockLaunchImageLibrary.mockResolvedValueOnce({
    assets: [
      {
        fileName: 'profile.webp',
        fileSize: 2048,
        type: 'image/webp',
        uri: 'content://selected-profile',
      },
    ],
  });

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 이미지 변경'})
      .props.onPress();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '프로필 이미지 변경'})
      .findByType(CachedRemoteImage).props.source,
  ).toEqual({uri: 'content://selected-profile'});

  await TestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
    await Promise.resolve();
  });

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({profileImageUrl: 'content://selected-profile'}),
    {
      asset: {
        contentType: 'image/webp',
        fileName: 'profile.webp',
        sizeBytes: 2048,
        uri: 'content://selected-profile',
      },
      type: 'replace',
    },
  );
});

test('기존 프로필 이미지의 제거 버튼은 저장 시 null 변경을 전달한다', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const renderer = render(
    onSave,
    jest.fn(),
    undefined,
    {...GUARDIAN_PROFILE, profileImageUrl: 'https://example.com/profile.jpg'},
  );

  TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 이미지 제거'})
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '프로필 저장'}).props.onPress();
    await Promise.resolve();
  });

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({profileImageUrl: null}),
    {type: 'remove'},
  );
});

test('허용되지 않은 사진은 안내하고 기존 이미지 변경 상태를 유지한다', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onSave = jest.fn().mockResolvedValue(undefined);
  const renderer = render(onSave);
  editName(renderer, '이종철2');
  mockLaunchImageLibrary.mockResolvedValueOnce({
    assets: [
      {
        fileName: 'profile.gif',
        fileSize: 2048,
        type: 'image/gif',
        uri: 'content://invalid-profile',
      },
    ],
  });

  try {
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 이미지 변경'})
        .props.onPress();
      await Promise.resolve();
    });
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 저장'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      '프로필 사진을 사용할 수 없어요.',
      expect.stringContaining('JPEG'),
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({profileImageUrl: undefined}),
      {type: 'unchanged'},
    );
  } finally {
    alertSpy.mockRestore();
  }
});

test('사진 권한 오류는 안내만 표시하고 선택 상태를 바꾸지 않는다', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onSave = jest.fn().mockResolvedValue(undefined);
  const renderer = render(onSave);
  mockLaunchImageLibrary.mockResolvedValueOnce({errorCode: 'permission'});

  try {
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 이미지 변경'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      '프로필 사진을 선택할 수 없어요.',
      expect.stringContaining('권한'),
    );
    expect(onSave).not.toHaveBeenCalled();
  } finally {
    alertSpy.mockRestore();
  }
});

test('사진 선택을 취소하면 현재 미리보기를 유지한다', async () => {
  const profile = {
    ...GUARDIAN_PROFILE,
    profileImageUrl: 'https://cdn.example.com/current.webp',
  };
  const renderer = render(jest.fn().mockResolvedValue(undefined), jest.fn(), undefined, profile);
  mockLaunchImageLibrary.mockResolvedValueOnce({didCancel: true});

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 이미지 변경'})
      .props.onPress();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '프로필 이미지 변경'})
      .findByType(CachedRemoteImage).props.source,
  ).toEqual({uri: profile.profileImageUrl});
});

test('10 MiB를 초과한 사진은 안내하고 미리보기에 반영하지 않는다', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const renderer = render(jest.fn().mockResolvedValue(undefined));
  mockLaunchImageLibrary.mockResolvedValueOnce({
    assets: [
      {
        fileName: 'large.png',
        fileSize: 10 * 1024 * 1024 + 1,
        type: 'image/png',
        uri: 'content://large-image',
      },
    ],
  });

  try {
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 이미지 변경'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      '프로필 사진을 사용할 수 없어요.',
      expect.stringContaining('10MB'),
    );
  } finally {
    alertSpy.mockRestore();
  }
});

test('필수 사진 메타데이터가 없으면 안내하고 거부한다', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const renderer = render(jest.fn().mockResolvedValue(undefined));
  mockLaunchImageLibrary.mockResolvedValueOnce({
    assets: [
      {
        fileSize: 1024,
        type: 'image/jpeg',
        uri: 'content://missing-file-name',
      },
    ],
  });

  try {
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 이미지 변경'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      '프로필 사진을 사용할 수 없어요.',
      expect.stringContaining('사진 정보'),
    );
  } finally {
    alertSpy.mockRestore();
  }
});

test('저장 중에는 연속 저장을 한 번만 실행한다', async () => {
  let resolveSave!: () => void;
  const savePromise = new Promise<void>(resolve => {
    resolveSave = resolve;
  });
  const onSave = jest.fn(() => savePromise);
  const renderer = render(onSave);
  editName(renderer, '이종철2');

  TestRenderer.act(() => {
    const saveButton = renderer.root.findByProps({
      accessibilityLabel: '프로필 저장',
    });
    saveButton.props.onPress();
    saveButton.props.onPress();
  });
  expect(onSave).toHaveBeenCalledTimes(1);

  await TestRenderer.act(async () => {
    resolveSave();
    await savePromise;
  });
});

test('저장 실패 시 화면과 입력을 유지하고 다시 저장할 수 있다', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onBack = jest.fn();
  const onSave = jest
    .fn()
    .mockRejectedValueOnce(
      new ApiError({
        code: 'NETWORK_ERROR',
        kind: 'network',
        message: 'network error',
      }),
    )
    .mockResolvedValueOnce(undefined);
  const renderer = render(onSave, onBack);
  editName(renderer, '이종철2');

  try {
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 저장'})
        .props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onBack).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      '프로필 수정에 실패했어요.',
      expect.stringContaining('네트워크'),
    );

    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({accessibilityLabel: '프로필 저장'})
        .props.onPress();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onBack).toHaveBeenCalledTimes(1);
  } finally {
    alertSpy.mockRestore();
  }
});
