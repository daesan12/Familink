import React from "react";
import { AccessibilityInfo, Alert, Image } from "react-native";
import TestRenderer from "react-test-renderer";

import App from "../App";
import type { AuthGateway } from "../src/features/auth/types";

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockImplementation(() => new Promise<boolean>(() => {}));
});

afterEach(async () => {
  await TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
  });
});

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");
jest.mock("react-native-image-picker", () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");

  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
  };
});

function createAuthGateway(): jest.Mocked<AuthGateway> {
  return {
    login: jest.fn().mockResolvedValue({
      activeGroupId: null,
      id: "test-user",
      name: "이종철",
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  };
}

async function renderApp(authGateway = createAuthGateway()) {
  const onOpenActiveGroup = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App authGateway={authGateway} onOpenActiveGroup={onOpenActiveGroup} />
    );
  });
  mountedRenderers.push(renderer!);

  return { authGateway, onOpenActiveGroup, renderer: renderer! };
}

async function openLogin(renderer: TestRenderer.ReactTestRenderer) {
  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "로그인 시작" })
      .props.onPress();
  });
}

async function enterValidCredentials(renderer: TestRenderer.ReactTestRenderer) {
  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "로그인 아이디" })
      .props.onChangeText("familink");
    renderer.root
      .findByProps({ accessibilityLabel: "로그인 비밀번호" })
      .props.onChangeText("familink123");
  });
}

test("회원가입 시작 화면을 표시하고 기존 회원가입으로 이동한다", async () => {
  const { renderer } = await renderApp();

  expect(
    renderer.root.findByProps({ accessibilityLabel: "Familink" })
  ).toBeTruthy();
  expect(renderer.root.findByProps({ children: "회원가입" })).toBeTruthy();

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "회원가입 시작" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({
      children: "기본 정보를\n입력해주세요",
    })
  ).toBeTruthy();
});

test("로그인 입력 검증과 비밀번호 표시 전환을 제공한다", async () => {
  const { renderer } = await renderApp();
  await openLogin(renderer);

  const loginButton = renderer.root.findByProps({
    accessibilityLabel: "로그인",
  });
  expect(loginButton.props.accessibilityState.disabled).toBe(true);

  const loginIdInput = renderer.root.findByProps({
    accessibilityLabel: "로그인 아이디",
  });
  await TestRenderer.act(() => {
    loginIdInput.props.onChangeText("abc!");
    loginIdInput.props.onBlur();
  });
  expect(
    renderer.root.findByProps({
      children: "아이디는 영문·숫자 5~15자로 입력해주세요.",
    })
  ).toBeTruthy();

  const passwordInput = renderer.root.findByProps({
    accessibilityLabel: "로그인 비밀번호",
  });
  expect(passwordInput.props.secureTextEntry).toBe(true);

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "비밀번호 표시" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({
      accessibilityLabel: "로그인 비밀번호",
    }).props.secureTextEntry
  ).toBe(false);
});

test("로그인 실패 오류를 표시한다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockRejectedValueOnce(new Error("invalid"));
  const { renderer } = await renderApp(authGateway);
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({
      children: "아이디 또는 비밀번호가 일치하지 않습니다.",
    })
  ).toBeTruthy();
});

test("로그인 후 A-10을 거쳐 B-3으로 이동하고 다시 돌아온다", async () => {
  const { renderer } = await renderApp();
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ children: "이종철 님,\n안녕하세요" })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: "가족 앨범 일러스트" })
  ).toBeTruthy();
  expect(renderer.root.findAllByProps({ children: "다음" })).toHaveLength(0);

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "가족과의 연결 시작하기" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ children: "가족과\n연결해볼까요?" })
  ).toBeTruthy();
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "아직 참가한 그룹이 없어요"
  );

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "A-10으로 돌아가기" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ children: "이종철 님,\n안녕하세요" })
  ).toBeTruthy();
});

test("로그인 응답의 현재 회원 이름을 A-10 인사말에 표시한다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: null,
    id: "another-user",
    name: "김민지",
  });
  const { renderer } = await renderApp(authGateway);
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ children: "김민지 님,\n안녕하세요" })
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ children: "이종철 님,\n안녕하세요" })
  ).toHaveLength(0);
});

test("활성 그룹 사용자는 A-10을 건너뛰고 그룹 진입을 요청한다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: "active-group-1",
    id: "test-user",
    name: "이종철",
  });
  const onOpenActiveGroup = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App authGateway={authGateway} onOpenActiveGroup={onOpenActiveGroup} />
    );
  });
  mountedRenderers.push(renderer!);
  await openLogin(renderer!);
  await enterValidCredentials(renderer!);

  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  expect(onOpenActiveGroup).toHaveBeenCalledWith("active-group-1");
  expect(
    renderer!.root.findAllByProps({ children: "이종철 님,\n안녕하세요" })
  ).toHaveLength(0);
});

test("활성 그룹 진입이 연결되지 않아도 안전하게 A-1을 유지한다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: "active-group-1",
    id: "test-user",
    name: "이종철",
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(<App authGateway={authGateway} />);
  });
  mountedRenderers.push(renderer!);
  await openLogin(renderer!);
  await enterValidCredentials(renderer!);

  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    "그룹 화면 준비 중",
    "활성 그룹 진입은 후속 인증·내비게이션 작업에서 연결됩니다."
  );
  expect(
    renderer!.root.findByProps({ accessibilityLabel: "로그인 시작" })
  ).toBeTruthy();
  alertSpy.mockRestore();
});

test("로그아웃 확인 후 A-1로 돌아온다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  const { authGateway, renderer } = await renderApp();
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "로그아웃" })
      .props.onPress();
  });

  expect(alertSpy).not.toHaveBeenCalled();
  expect(
    renderer.root.findByProps({ children: "이 계정에서 로그아웃할까요?" })
  ).toBeTruthy();

  const logoutDialog = renderer.root.findByProps({
    accessibilityLabel: "로그아웃 확인",
  });
  expect(logoutDialog.findAllByType(Image)).toHaveLength(0);

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "로그아웃 취소" })
      .props.onPress();
  });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "로그아웃 확인" })
  ).toHaveLength(0);

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "로그아웃" })
      .props.onPress();
  });

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "로그아웃 확인하기" })
      .props.onPress();
    await Promise.resolve();
  });

  expect(authGateway.logout).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })
  ).toBeTruthy();
  alertSpy.mockRestore();
});
