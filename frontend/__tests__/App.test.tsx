import React from "react";
import { useRoute } from "@react-navigation/native";
import {
  AccessibilityInfo,
  Alert,
  AppState,
  Image,
  Modal,
  Text,
} from "react-native";
import TestRenderer from "react-test-renderer";
import { clearAllMockStorages } from "@react-native-async-storage/async-storage/jest";

import App from "../App";
import { AppShell, type AppScreenProps } from "../src/app-shell";
import { InvalidCredentialsError } from "../src/features/auth/api/mockAuthGateway";
import { LoginBottomSheet } from "../src/features/auth/components/LoginBottomSheet";
import { CreateGroupSheet } from "../src/features/auth/components/CreateGroupSheet";
import { JoinGroupSheet } from "../src/features/auth/components/JoinGroupSheet";
import {
  type AuthRestoreResult,
  type AuthSessionCoordinator,
} from "../src/features/auth/session";
import { SignupFlowScreen } from "../src/features/auth/screens/SignupFlowScreen";
import { SignedInWelcomeScreen } from "../src/features/auth/screens/SignedInWelcomeScreen";
import type { AuthGateway } from "../src/features/auth/types";
import { ApiError } from "../src/shared/api";
import { notifyGroupAccessDenied } from "../src/shared/api/groupAccessEvents";
import { imageDiskCache } from "../src/shared/media/imageDiskCache";
import type {
  FamilyGroupGateway,
  GroupMemberGateway,
} from "../src/features/group-info";
import { ReportScreen } from "../src/features/reports";
import type { ReportGateway } from "../src/features/reports";
import type {
  DeviceTokenProvider,
  NotificationGateway,
} from "../src/features/notifications";
import type {
  ProfileGateway,
  ProfileImageAsset,
} from "../src/features/profile";

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
});

afterEach(async () => {
  await TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
  });
  clearAllMockStorages();
  jest.restoreAllMocks();
});

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");
jest.mock("@react-native-async-storage/async-storage");
jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: jest.fn(),
}));
jest.mock("react-native-config", () => ({ API_BASE_URL: "http://localhost" }));
jest.mock("lucide-react-native/icons/calendar", () => "Icon");
jest.mock("lucide-react-native/icons/bell-off", () => "Icon");
jest.mock("lucide-react-native/icons/check", () => "Icon");
jest.mock("lucide-react-native/icons/chevron-left", () => "Icon");
jest.mock("lucide-react-native/icons/circle-user-round", () => "Icon");
jest.mock("lucide-react-native/icons/file-chart-column", () => "Icon");
jest.mock("lucide-react-native/icons/house", () => "Icon");
jest.mock("lucide-react-native/icons/phone-call", () => "Icon");
jest.mock("lucide-react-native/icons/settings", () => "Icon");
jest.mock("lucide-react-native/icons/users-round", () => "Icon");
jest.mock("lucide-react-native/icons/x", () => "Icon");
jest.mock("react-native-image-picker", () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock("../src/shared/media/imageDiskCache", () => ({
  imageDiskCache: {
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));

beforeEach(() => {
  jest.mocked(imageDiskCache.clearAll).mockClear();
});

jest.mock("react-native-safe-area-context", () => {
  const mockReact = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };

  return {
    // react-navigation의 SafeAreaProviderCompat이 이 컨텍스트를 직접 구독한다.
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    initialWindowMetrics: null,
    useSafeAreaInsets: () => insets,
  };
});

function createAuthGateway(): jest.Mocked<AuthGateway> {
  return {
    login: jest.fn().mockResolvedValue({
      activeGroupId: null,
      id: 1,
      name: "이종철",
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  };
}

interface TestAuthSessionCoordinator
  extends jest.Mocked<AuthSessionCoordinator> {
  emitInvalidated(reason?: unknown): void;
  resolveRestore(): void;
}

function createAuthSessionCoordinator(
  restoreResult: AuthRestoreResult = { status: "signedOut" }
): TestAuthSessionCoordinator {
  let listener: ((reason: unknown) => void) | null = null;
  let resolveRestorePromise: ((result: AuthRestoreResult) => void) | null = null;
  const restorePromise = new Promise<AuthRestoreResult>((resolve) => {
    resolveRestorePromise = resolve;
  });
  const coordinator = {
    clearLocalSession: jest.fn().mockResolvedValue(undefined),
    emitInvalidated(reason: unknown = new Error("invalidated")) {
      listener?.(reason);
    },
    resolveRestore() {
      resolveRestorePromise?.(restoreResult);
    },
    restore: jest.fn().mockReturnValue(restorePromise),
    subscribeAuthInvalidated: jest.fn((nextListener) => {
      listener = nextListener;
      return () => {
        if (listener === nextListener) {
          listener = null;
        }
      };
    }),
    getAccessToken: jest.fn().mockReturnValue(null),
    getRefreshToken: jest.fn().mockReturnValue(null),
    refreshAccessToken: jest.fn().mockRejectedValue(new Error("no session")),
  };
  return coordinator;
}

async function resolveAuthRestore(
  authSession: TestAuthSessionCoordinator
): Promise<void> {
  await TestRenderer.act(async () => {
    authSession.resolveRestore();
    await authSession.restore.mock.results[0]?.value;
  });
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createGroupGateway(): jest.Mocked<FamilyGroupGateway> {
  return {
    createGroup: jest.fn(async (input) => ({
      createdAt: "2026-07-31T01:02:03Z",
      group: { id: "created-group-api", name: input.name, role: input.role },
      inviteCode: "ABC123",
      managerMemberId: "member-manager",
    })),
    getGroupDetail: jest.fn().mockResolvedValue({
      careReceiverCount: 0,
      guardianCount: 1,
      id: "group-api",
      isManager: true,
      managerMemberId: "member-manager",
      memberCount: 1,
      name: "API 가족",
    }),
    getInviteCode: jest.fn().mockResolvedValue({ inviteCode: "ABC123" }),
    loadGroups: jest.fn().mockResolvedValue({ groups: [], joinRequests: [] }),
    renameGroup: jest.fn(async (groupId, name) => ({
      id: groupId,
      name,
      updatedAt: "2026-07-31T02:03:04Z",
    })),
  };
}

function createNotificationGateway(): jest.Mocked<NotificationGateway> {
  return {
    deactivateDeviceToken: jest.fn().mockResolvedValue(undefined),
    getUnreadCount: jest.fn().mockResolvedValue(0),
    loadPage: jest.fn().mockResolvedValue({hasNext: false, notifications: []}),
    loadSettings: jest.fn().mockResolvedValue([]),
    markAllRead: jest.fn().mockResolvedValue({
      readAt: "2026-08-01T00:00:00Z",
      updatedCount: 0,
    }),
    markRead: jest.fn().mockResolvedValue({
      id: "1",
      readAt: "2026-08-01T00:00:00Z",
    }),
    registerDeviceToken: jest.fn().mockResolvedValue({
      active: true,
      deviceType: "ANDROID",
      id: "1",
    }),
    updateSettings: jest.fn().mockResolvedValue({
      updatedAt: "2026-08-01T00:00:00Z",
    }),
  };
}

function createProfileGateway(): jest.Mocked<ProfileGateway> {
  return {
    loadCurrentProfile: jest.fn().mockResolvedValue({
      birthDate: "1990-01-01",
      gender: "MALE",
      loginId: "familink",
      name: "이종철",
      profileImageUrl: null,
    }),
    uploadProfileImage: jest
      .fn()
      .mockResolvedValue('https://cdn.example.com/profile.webp'),
    updateCurrentProfile: jest.fn().mockResolvedValue({
      id: "1",
      name: "이종철",
      updatedAt: "2026-08-01T00:00:00Z",
    }),
    withdrawCurrentUser: jest.fn().mockResolvedValue(undefined),
  };
}

function createDeviceTokenProvider(
  permission: "granted" | "denied" | "blocked" | "unavailable" = "granted",
  token: string | null = "fcm-token"
): jest.Mocked<DeviceTokenProvider> {
  return {
    getToken: jest.fn().mockResolvedValue(token),
    requestPermission: jest.fn().mockResolvedValue(permission),
  };
}

async function renderApp(
  authGateway = createAuthGateway(),
  authSession = createAuthSessionCoordinator(),
  groupGateway = createGroupGateway(),
  notificationGateway?: jest.Mocked<NotificationGateway>,
  deviceTokenProvider?: jest.Mocked<DeviceTokenProvider>,
  profileGateway?: jest.Mocked<ProfileGateway>
) {
  const onOpenActiveGroup = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        authGateway={authGateway}
        authSession={authSession}
        deviceTokenProvider={deviceTokenProvider}
        groupGateway={groupGateway}
        notificationGateway={notificationGateway}
        onOpenActiveGroup={onOpenActiveGroup}
        profileGateway={profileGateway}
      />
    );
  });
  await resolveAuthRestore(authSession);
  mountedRenderers.push(renderer!);

  return {
    authGateway,
    authSession,
    groupGateway,
    notificationGateway,
    deviceTokenProvider,
    profileGateway,
    onOpenActiveGroup,
    renderer: renderer!,
  };
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

async function loginToSignedInWelcome(
  renderer: TestRenderer.ReactTestRenderer
): Promise<void> {
  await openLogin(renderer);
  await enterValidCredentials(renderer);
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await flushAsyncWork();
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

  await TestRenderer.act(() => {
    renderer.root.findByType(SignupFlowScreen).props.onComplete("CaseUser1");
  });

  // 가입 완료 시 방금 만든 아이디를 채운 로그인 시트가 바로 열린다.
  const loginSheet = renderer.root.findByType(LoginBottomSheet);
  expect(loginSheet.props.visible).toBe(true);
  expect(loginSheet.props.initialLoginId).toBe("CaseUser1");
  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 아이디" }).props
      .value
  ).toBe("CaseUser1");
});

test('회원가입 후 로그인하면 선택한 프로필 사진을 저장한다', async () => {
  const profileGateway = createProfileGateway();
  const {renderer} = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    createGroupGateway(),
    undefined,
    undefined,
    profileGateway,
  );
  const asset: ProfileImageAsset = {
    contentType: 'image/jpeg',
    fileName: 'profile.jpg',
    sizeBytes: 1024,
    uri: 'file:///profile.jpg',
  };

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '회원가입 시작'})
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer.root.findByType(SignupFlowScreen).props.onComplete(
      'CaseUser1',
      asset,
    );
  });
  const loginSheet = renderer.root.findByType(LoginBottomSheet);
  await TestRenderer.act(async () => {
    await loginSheet.props.onLogin({
      loginId: 'CaseUser1',
      password: 'password123',
    });
    await flushAsyncWork();
  });

  expect(profileGateway.uploadProfileImage).toHaveBeenCalledWith(asset);
  expect(profileGateway.updateCurrentProfile).toHaveBeenCalledWith({
    profileImageUrl: 'https://cdn.example.com/profile.webp',
  });
});

test("로그인 입력을 보존하고 비밀번호 표시 전환을 제공한다", async () => {
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
      accessibilityLabel: "로그인 아이디",
    }).props.value
  ).toBe("abc!");
  expect(
    renderer.root.findAllByProps({
      children: "아이디를 입력해주세요.",
    })
  ).toHaveLength(0);

  const passwordInput = renderer.root.findByProps({
    accessibilityLabel: "로그인 비밀번호",
  });
  await TestRenderer.act(() => {
    passwordInput.props.onChangeText("old-password!");
  });

  expect(
    renderer.root.findByProps({
      accessibilityLabel: "로그인 비밀번호",
    }).props.value
  ).toBe("old-password!");
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "로그인",
    }).props.accessibilityState.disabled
  ).toBe(false);
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
  authGateway.login.mockRejectedValueOnce(new InvalidCredentialsError());
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

test("네트워크 로그인 실패를 인증 정보 오류로 오인하지 않는다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockRejectedValueOnce(
    new ApiError({
      code: "NETWORK_ERROR",
      kind: "network",
      message: "네트워크 연결을 확인해 주세요.",
    })
  );
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
      children: "네트워크 연결을 확인해 주세요.",
    })
  ).toBeTruthy();
});

test("로그인 처리 중에는 중복 제출과 시트 닫기·입력 변경을 잠근다", async () => {
  const authGateway = createAuthGateway();
  const login = createDeferred<{
    activeGroupId: null;
    id: number;
    name: string;
  }>();
  authGateway.login.mockReturnValueOnce(login.promise);
  const { renderer } = await renderApp(authGateway);
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  const loginButton = renderer.root.findByProps({
    accessibilityLabel: "로그인",
  });
  let loginPromise: Promise<void> | undefined;
  TestRenderer.act(() => {
    loginPromise = loginButton.props.onPress();
  });
  await TestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(authGateway.login).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 아이디" }).props
      .editable
  ).toBe(false);
  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 비밀번호" }).props
      .editable
  ).toBe(false);

  TestRenderer.act(() => {
    loginButton.props.onPress();
    renderer.root
      .findByProps({ accessibilityLabel: "로그인 닫기" })
      .props.onPress();
    renderer.root.findByType(Modal).props.onRequestClose();
  });

  expect(authGateway.login).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByType(LoginBottomSheet).props.visible).toBe(true);

  await TestRenderer.act(async () => {
    login.resolve({ activeGroupId: null, id: 2, name: "김민지" });
    await loginPromise;
  });
});

test("겹친 로그인 응답은 최신 요청의 사용자만 화면에 적용한다", async () => {
  const authGateway = createAuthGateway();
  const firstLogin = createDeferred<{
    activeGroupId: null;
    id: number;
    name: string;
  }>();
  const secondLogin = createDeferred<{
    activeGroupId: null;
    id: number;
    name: string;
  }>();
  authGateway.login
    .mockReturnValueOnce(firstLogin.promise)
    .mockReturnValueOnce(secondLogin.promise);
  const { renderer } = await renderApp(authGateway);
  await openLogin(renderer);
  const onLogin = renderer.root.findByType(LoginBottomSheet).props.onLogin;
  let firstPromise: Promise<void> | undefined;
  let secondPromise: Promise<void> | undefined;

  TestRenderer.act(() => {
    firstPromise = onLogin({ loginId: "first", password: "password1" });
    secondPromise = onLogin({ loginId: "second", password: "password2" });
  });

  const firstSignal = authGateway.login.mock.calls[0]?.[1]?.signal;
  const secondSignal = authGateway.login.mock.calls[1]?.[1]?.signal;
  expect(firstSignal?.aborted).toBe(true);
  expect(secondSignal?.aborted).toBe(false);

  await TestRenderer.act(async () => {
    secondLogin.resolve({ activeGroupId: null, id: 2, name: "최신 사용자" });
    await secondPromise;
  });
  expect(
    renderer.root.findByProps({ children: "최신 사용자 님,\n안녕하세요" })
  ).toBeTruthy();

  await TestRenderer.act(async () => {
    firstLogin.resolve({ activeGroupId: null, id: 1, name: "이전 사용자" });
    await firstPromise;
  });
  expect(
    renderer.root.findAllByProps({ children: "이전 사용자 님,\n안녕하세요" })
  ).toHaveLength(0);
});

test("닫힌 로그인 시트의 늦은 성공 응답을 무시한다", async () => {
  const authGateway = createAuthGateway();
  const login = createDeferred<{
    activeGroupId: null;
    id: number;
    name: string;
  }>();
  authGateway.login.mockReturnValueOnce(login.promise);
  const { renderer } = await renderApp(authGateway);
  await openLogin(renderer);
  const loginSheet = renderer.root.findByType(LoginBottomSheet);
  let loginPromise: Promise<void> | undefined;

  TestRenderer.act(() => {
    loginPromise = loginSheet.props.onLogin({
      loginId: "familink",
      password: "familink123",
    });
    loginSheet.props.onDismiss();
  });

  expect(authGateway.login.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  await TestRenderer.act(async () => {
    login.resolve({ activeGroupId: null, id: 2, name: "늦은 사용자" });
    await loginPromise;
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ children: "늦은 사용자 님,\n안녕하세요" })
  ).toHaveLength(0);
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

test("로그인 후 서버 그룹 목록이 있으면 해당 그룹으로 앱 셸에 진입한다", async () => {
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups.mockResolvedValueOnce({
    groups: [
      {
        id: "101",
        isManager: true,
        memberCount: 2,
        myMemberId: "201",
        name: "서버 가족",
        role: "guardian",
      },
    ],
    joinRequests: [],
  });
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    groupGateway
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {});

  expect(groupGateway.loadGroups).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByProps({ children: "서버 가족" })).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityRole: "tablist" })
  ).toBeTruthy();
});

test("포그라운드로 돌아오면 그룹 목록을 다시 조회해 바뀐 역할을 반영한다", async () => {
  const appStateListener = jest.spyOn(AppState, "addEventListener");
  const groupGateway = createGroupGateway();
  const serverGroup = {
    id: "101",
    isManager: false,
    memberCount: 2,
    myMemberId: "201",
    name: "서버 가족",
    role: "guardian" as const,
  };
  groupGateway.loadGroups
    .mockResolvedValueOnce({ groups: [serverGroup], joinRequests: [] })
    .mockResolvedValueOnce({
      groups: [{ ...serverGroup, role: "careReceiver" as const }],
      joinRequests: [],
    });
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    groupGateway
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {});

  expect(
    renderer.root.findAllByProps({ children: "리포트" }).length
  ).toBeGreaterThan(0);

  await TestRenderer.act(async () => {
    appStateListener.mock.calls
      .filter(([eventType]) => eventType === "change")
      .forEach(([, handler]) => handler("active"));
    await flushAsyncWork();
  });

  expect(groupGateway.loadGroups).toHaveBeenCalledTimes(2);
  expect(renderer.root.findAllByProps({ children: "리포트" })).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ children: "AI 전화" }).length
  ).toBeGreaterThan(0);

  // 백그라운드 전환에서는 재조회하지 않는다.
  await TestRenderer.act(async () => {
    appStateListener.mock.calls
      .filter(([eventType]) => eventType === "change")
      .forEach(([, handler]) => handler("background"));
    await flushAsyncWork();
  });

  expect(groupGateway.loadGroups).toHaveBeenCalledTimes(2);
});

test("그룹 API가 접근을 거부하고 목록에서 그룹이 사라지면 즉시 그룹 없음 화면으로 이동한다", async () => {
  const groupGateway = createGroupGateway();
  const serverGroup = {
    id: "101",
    isManager: false,
    memberCount: 2,
    myMemberId: "201",
    name: "내보내질 가족",
    role: "guardian" as const,
  };
  groupGateway.loadGroups
    .mockResolvedValueOnce({groups: [serverGroup], joinRequests: []})
    .mockResolvedValueOnce({groups: [], joinRequests: []});
  const {renderer} = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    groupGateway,
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: "로그인"})
      .props.onPress();
    await flushAsyncWork();
  });
  expect(renderer.root.findByType(AppShell)).toBeTruthy();

  await TestRenderer.act(async () => {
    notifyGroupAccessDenied("101");
    await flushAsyncWork();
  });

  expect(groupGateway.loadGroups).toHaveBeenCalledTimes(2);
  expect(renderer.root.findAllByType(AppShell)).toHaveLength(0);
  expect(renderer.root.findByType(SignedInWelcomeScreen)).toBeTruthy();
});

test("비피드 화면에서 현재 그룹이 제거되면 대체 그룹의 피드로 이동한다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: "101",
    id: 1,
    name: "이종철",
  });
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups
    .mockResolvedValueOnce({
      groups: [
        {
          id: "101",
          isManager: false,
          memberCount: 2,
          myMemberId: "201",
          name: "내보내질 가족",
          role: "guardian",
        },
      ],
      joinRequests: [],
    })
    .mockResolvedValueOnce({
      groups: [
        {
          id: "102",
          isManager: false,
          memberCount: 3,
          myMemberId: "202",
          name: "남은 가족",
          role: "guardian",
        },
      ],
      joinRequests: [],
    });
  const authSession = createAuthSessionCoordinator();

  function CalendarProbe() {
    return null;
  }

  function FeedProbe() {
    return null;
  }

  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        authGateway={authGateway}
        authSession={authSession}
        groupGateway={groupGateway}
        initialShellRoute="calendar"
        screens={{calendar: CalendarProbe, feed: FeedProbe}}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  await resolveAuthRestore(authSession);
  await openLogin(renderer!);
  await enterValidCredentials(renderer!);

  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({accessibilityLabel: "로그인"})
      .props.onPress();
    await flushAsyncWork();
  });
  expect(renderer!.root.findByType(CalendarProbe)).toBeTruthy();

  await TestRenderer.act(async () => {
    notifyGroupAccessDenied("101");
    await flushAsyncWork();
  });

  expect(renderer!.root.findAllByType(CalendarProbe)).toHaveLength(0);
  expect(renderer!.root.findByType(FeedProbe)).toBeTruthy();
  expect(renderer!.root.findByType(AppShell).props.initialGroupId).toBe("102");
});

test("앱 셸 첫 화면의 그룹 API 403도 구독 전에 유실하지 않는다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: "101",
    id: 1,
    name: "이종철",
  });
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups
    .mockResolvedValueOnce({
      groups: [
        {
          id: "101",
          isManager: false,
          memberCount: 2,
          myMemberId: "201",
          name: "내보내질 가족",
          role: "guardian",
        },
      ],
      joinRequests: [],
    })
    .mockResolvedValueOnce({groups: [], joinRequests: []});
  const authSession = createAuthSessionCoordinator();

  function DeniedOnMountFeed() {
    React.useEffect(() => {
      notifyGroupAccessDenied("101");
    }, []);
    return null;
  }

  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        authGateway={authGateway}
        authSession={authSession}
        groupGateway={groupGateway}
        screens={{feed: DeniedOnMountFeed}}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  await resolveAuthRestore(authSession);
  await openLogin(renderer!);
  await enterValidCredentials(renderer!);

  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({accessibilityLabel: "로그인"})
      .props.onPress();
    await flushAsyncWork();
  });

  expect(groupGateway.loadGroups).toHaveBeenCalledTimes(2);
  expect(renderer!.root.findAllByType(AppShell)).toHaveLength(0);
  expect(renderer!.root.findByType(SignedInWelcomeScreen)).toBeTruthy();
});

test("현재 선택하지 않은 그룹의 늦은 403은 현재 그룹을 바꾸지 않는다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: "101",
    id: 1,
    name: "이종철",
  });
  const currentGroup = {
    id: "101",
    isManager: false,
    memberCount: 2,
    myMemberId: "201",
    name: "현재 가족",
    role: "guardian" as const,
  };
  const removedInactiveGroup = {
    ...currentGroup,
    id: "102",
    myMemberId: "202",
    name: "이전 가족",
  };
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups
    .mockResolvedValueOnce({
      groups: [currentGroup, removedInactiveGroup],
      joinRequests: [],
    })
    .mockResolvedValueOnce({groups: [currentGroup], joinRequests: []});
  const {renderer} = await renderApp(
    authGateway,
    createAuthSessionCoordinator(),
    groupGateway,
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: "로그인"})
      .props.onPress();
    await flushAsyncWork();
  });

  await TestRenderer.act(async () => {
    notifyGroupAccessDenied("102");
    await flushAsyncWork();
  });

  expect(groupGateway.loadGroups).toHaveBeenCalledTimes(2);
  const appShell = renderer.root.findByType(AppShell);
  expect(appShell.props.initialGroupId).toBe("101");
  expect(appShell.props.groups).toEqual([currentGroup]);
  expect(renderer.root.findAllByType(SignedInWelcomeScreen)).toHaveLength(0);
});

test("현재 그룹과 이전 그룹의 403이 겹쳐도 제거된 현재 그룹을 대체한다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: "101",
    id: 1,
    name: "이종철",
  });
  const currentGroup = {
    id: "101",
    isManager: false,
    memberCount: 2,
    myMemberId: "201",
    name: "내보내질 가족",
    role: "guardian" as const,
  };
  const remainingGroup = {
    ...currentGroup,
    id: "102",
    myMemberId: "202",
    name: "남은 가족",
  };
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups
    .mockResolvedValueOnce({
      groups: [currentGroup, remainingGroup],
      joinRequests: [],
    })
    .mockResolvedValueOnce({groups: [remainingGroup], joinRequests: []});
  const {renderer} = await renderApp(
    authGateway,
    createAuthSessionCoordinator(),
    groupGateway,
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({accessibilityLabel: "로그인"})
      .props.onPress();
    await flushAsyncWork();
  });

  await TestRenderer.act(async () => {
    notifyGroupAccessDenied("101");
    notifyGroupAccessDenied("102");
    await flushAsyncWork();
  });

  expect(groupGateway.loadGroups).toHaveBeenCalledTimes(2);
  const appShell = renderer.root.findByType(AppShell);
  expect(appShell.props.initialGroupId).toBe("102");
  expect(appShell.props.groups).toEqual([remainingGroup]);
});

test("그룹 목록 조회 오류를 정상 빈 목록으로 표시하지 않는다", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups.mockRejectedValueOnce(new Error("network"));
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    groupGateway
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  expect(alert).toHaveBeenCalledWith(
    "그룹 정보를 불러오지 못했어요",
    "네트워크 연결을 확인한 뒤 다시 로그인해 주세요."
  );
  expect(
    renderer.root.findByProps({ children: "이종철 님,\n안녕하세요" })
  ).toBeTruthy();
  expect(renderer.root.findAllByType(AppShell)).toHaveLength(0);
});

test("그룹 조회 중 인증이 무효화되면 로그인 상태를 다시 살리지 않는다", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const authSession = createAuthSessionCoordinator();
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups.mockImplementationOnce(async () => {
    authSession.emitInvalidated();
    throw new Error("unauthorized");
  });
  const { renderer } = await renderApp(
    createAuthGateway(),
    authSession,
    groupGateway
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  expect(alert).not.toHaveBeenCalled();
  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })
  ).toBeTruthy();
  expect(renderer.root.findAllByType(SignedInWelcomeScreen)).toHaveLength(0);
});

test("새 그룹을 만들면 입력한 그룹으로 앱 셸에 진입한다", async () => {
  const onCreateGroup = jest.fn().mockResolvedValue({
    id: "created-group-1",
    name: "행복한 가족",
    role: "guardian",
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="groupOnboarding" onCreateGroup={onCreateGroup} />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "받은 코드로 기존 그룹에 들어가요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "우리 가족만의 공간을 시작해요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "그룹 이름" })
      .props.onChangeText("행복한 가족");
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "생성하기" })
      .props.onPress();
  });

  expect(onCreateGroup).toHaveBeenCalledWith(
    {
      name: "행복한 가족",
      role: "guardian",
    },
    expect.any(Object)
  );
  expect(renderer!.root.findByProps({ children: "행복한 가족" })).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityRole: "tablist" })
  ).toBeTruthy();
});

test("피보호자로 새 그룹을 만들면 관심사 설정 후 앱 셸에 진입한다", async () => {
  const onSaveInterests = jest.fn().mockResolvedValue(undefined);
  const groupGateway = createGroupGateway();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        groupGateway={groupGateway}
        initialRootRoute="groupOnboarding"
        onSaveInterests={onSaveInterests}
      />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "우리 가족만의 공간을 시작해요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "그룹 이름" })
      .props.onChangeText("돌봄 가족");
    renderer!.root
      .findByProps({ accessibilityLabel: "피보호자" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "생성하기" })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({ children: "관심사를 선택해주세요" })
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "가족과 일상 관심사" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "관심사 저장하고 다음" })
      .props.onPress();
  });

  expect(onSaveInterests).toHaveBeenCalledWith({
    groupId: "created-group-api",
    interests: ["가족과 일상"],
  });
  expect(
    renderer!.root.findByProps({ accessibilityLabel: "관심사 저장 완료" })
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "피드로 이동" })
      .props.onPress();
  });
  expect(renderer!.root.findByProps({ children: "돌봄 가족" })).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityRole: "tablist" })
  ).toBeTruthy();
});

test("피보호자 그룹 생성 시 관심사 전체 교체 API를 연결한다", async () => {
  const groupGateway = createGroupGateway();
  const interestGateway = {
    loadInterests: jest.fn().mockResolvedValue({
      memberId: "member-manager",
      interests: ["산책"],
    }),
    replaceInterests: jest.fn().mockResolvedValue({
      memberId: "member-manager",
      interests: ["음악"],
    }),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        groupGateway={groupGateway}
        initialRootRoute="groupOnboarding"
        interestGateway={interestGateway}
      />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "우리 가족만의 공간을 시작해요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "그룹 이름" })
      .props.onChangeText("API 가족");
    renderer!.root
      .findByProps({ accessibilityLabel: "피보호자" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "생성하기" })
      .props.onPress();
    await Promise.resolve();
  });

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "음악 관심사" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "관심사 저장하고 다음" })
      .props.onPress();
  });

  expect(interestGateway.replaceInterests).toHaveBeenCalledWith(
    "created-group-api",
    "member-manager",
    ["음악"],
  );
  expect(interestGateway.loadInterests).not.toHaveBeenCalled();
});

test("피보호자 그룹 생성 시 관심사 설정 건너뛰기는 API를 호출하지 않는다", async () => {
  const groupGateway = createGroupGateway();
  const interestGateway = {
    loadInterests: jest.fn().mockResolvedValue({
      memberId: "member-manager",
      interests: ["산책"],
    }),
    replaceInterests: jest.fn().mockResolvedValue({
      memberId: "member-manager",
      interests: [],
    }),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        groupGateway={groupGateway}
        initialRootRoute="groupOnboarding"
        interestGateway={interestGateway}
      />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "우리 가족만의 공간을 시작해요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "그룹 이름" })
      .props.onChangeText("API 가족");
    renderer!.root
      .findByProps({ accessibilityLabel: "피보호자" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "생성하기" })
      .props.onPress();
    await Promise.resolve();
  });

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "관심사 설정 건너뛰기" })
      .props.onPress();
  });

  expect(interestGateway.loadInterests).not.toHaveBeenCalled();
  expect(interestGateway.replaceInterests).not.toHaveBeenCalled();
  expect(renderer!.root.findByProps({ children: "API 가족" })).toBeTruthy();
});

test("승인 카드로 진입한 피보호자는 관심사 화면을 거치지 않고 피드로 이동한다", async () => {
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups.mockResolvedValue({
    groups: [
      {
        id: "approved-care-group",
        name: "돌봄 가족",
        role: "careReceiver",
        isManager: false,
        memberCount: 1,
        myMemberId: "member-manager",
      },
    ],
    joinRequests: [],
  });
  const interestGateway = {
    loadInterests: jest.fn(),
    replaceInterests: jest.fn().mockResolvedValue({
      memberId: "member-manager",
      interests: [],
    }),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        groupGateway={groupGateway}
        initialJoinRequests={[
          {
            groupId: "approved-care-group",
            groupName: "돌봄 가족",
            id: "approved-request",
            myMemberId: "member-manager",
            role: "careReceiver",
            status: "APPROVED",
          },
        ]}
        initialRootRoute="groupOnboarding"
        interestGateway={interestGateway}
      />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "돌봄 가족 열기" })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(renderer!.root.findByType(AppShell)).toBeTruthy();
  expect(renderer!.root.findByProps({accessibilityLabel: "피드 탭"})).toBeTruthy();
  expect(interestGateway.loadInterests).not.toHaveBeenCalled();
  expect(interestGateway.replaceInterests).not.toHaveBeenCalled();
});

test("초대 코드 참여 요청을 보내면 승인 대기 카드를 표시한다", async () => {
  const onJoinGroup = jest.fn().mockReturnValue({
    groupName: "가족 소모임",
    id: "request-family",
    status: "PENDING_ADMIN",
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="groupOnboarding" onJoinGroup={onJoinGroup} />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "받은 코드로 기존 그룹에 들어가요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "6자리 초대 코드" })
      .props.onChangeText("fa12bc");
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "참여 요청 보내기" })
      .props.onPress();
  });

  expect(onJoinGroup).toHaveBeenCalledWith("FA12BC", expect.any(Object));
  expect(renderer!.root.findByProps({ children: "가족 소모임" })).toBeTruthy();
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    "관리자 승인을 기다리고 있어요"
  );
});

test("기본 그룹 게이트웨이로 초대 코드 가입 요청과 상태 재조회를 연결한다", async () => {
  const groupGateway = createGroupGateway();
  groupGateway.requestJoinByCode = jest.fn().mockResolvedValue({
    groupId: "group-join-api",
    groupName: "API 가족",
    joinRequestId: "request-api",
    status: "PENDING_ADMIN",
  });
  groupGateway.loadGroups.mockResolvedValueOnce({
    groups: [],
    joinRequests: [
      {
        groupId: "group-join-api",
        groupName: "API 가족",
        joinRequestId: "request-api",
        processedAt: null,
        requestedAt: "2026-07-31T01:02:03Z",
        status: "PENDING_ADMIN",
      },
    ],
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="groupOnboarding" groupGateway={groupGateway} />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "받은 코드로 기존 그룹에 들어가요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "6자리 초대 코드" })
      .props.onChangeText("ab12c3");
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "참여 요청 보내기" })
      .props.onPress();
  });

  expect(groupGateway.requestJoinByCode).toHaveBeenCalledWith(
    "AB12C3",
    expect.any(Object)
  );
  expect(groupGateway.loadGroups).toHaveBeenCalled();
  expect(renderer!.root.findByProps({ children: "API 가족" })).toBeTruthy();
});

test("가입 대기 화면을 열어 둔 채 승인되면 승인 카드로 전환한다", async () => {
  const groupGateway = createGroupGateway();
  groupGateway.requestJoinByCode = jest.fn().mockResolvedValue({
    groupId: "approved-while-open",
    groupName: "승인 가족",
    joinRequestId: "request-approved",
    status: "PENDING_ADMIN",
  });
  groupGateway.loadGroups.mockResolvedValueOnce({
    groups: [
      {
        id: "approved-while-open",
        isManager: false,
        memberCount: 2,
        myMemberId: "member-approved",
        name: "승인 가족",
        role: "guardian",
      },
    ],
    joinRequests: [
      {
        groupId: "approved-while-open",
        groupName: "승인 가족",
        joinRequestId: "request-approved",
        processedAt: "2026-08-03T00:00:00Z",
        requestedAt: "2026-08-02T00:00:00Z",
        status: "APPROVED",
      },
    ],
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="groupOnboarding" groupGateway={groupGateway} />,
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "받은 코드로 기존 그룹에 들어가요",
      })
      .props.onPress();
  });

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: "6자리 초대 코드"})
      .props.onChangeText("ab12c3");
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({accessibilityLabel: "참여 요청 보내기"})
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: "승인 가족 열기"}),
  ).toBeTruthy();
  expect(JSON.stringify(renderer!.toJSON())).toContain("가입이 승인되었어요");
});

test("저장된 가입 요청은 재실행 후 승인 카드로 복원하고 입장 뒤 제거한다", async () => {
  let storedIds = ["request-restored"];
  const joinRequestStore = {
    load: jest.fn(async (userId: number) =>
      userId === 7 ? [...storedIds] : [],
    ),
    save: jest.fn(async (_userId: number, requestIds: readonly string[]) => {
      storedIds = [...requestIds];
    }),
  };
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups.mockResolvedValue({
    groups: [
      {
        id: "restored-group",
        isManager: false,
        memberCount: 2,
        myMemberId: "restored-member",
        name: "복원 가족",
        role: "guardian",
      },
    ],
    joinRequests: [
      {
        groupId: "restored-group",
        groupName: "복원 가족",
        joinRequestId: "request-restored",
        processedAt: "2026-08-03T00:00:00Z",
        requestedAt: "2026-08-02T00:00:00Z",
        status: "APPROVED",
      },
    ],
  });
  const authSession = createAuthSessionCoordinator({
    status: "authenticated",
    user: {id: 7, name: "복원 사용자"},
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        authSession={authSession}
        groupGateway={groupGateway}
        initialShellRoute="calendar"
        joinRequestStore={joinRequestStore}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  await resolveAuthRestore(authSession);

  expect(
    renderer!.root.findByProps({accessibilityLabel: "복원 가족 열기"}),
  ).toBeTruthy();

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({accessibilityLabel: "복원 가족 열기"})
      .props.onPress();
    await flushAsyncWork();
  });

  expect(storedIds).toEqual([]);
  expect(renderer!.root.findByType(AppShell).props.initialRoute).toBe("feed");
  expect(groupGateway.loadGroups).toHaveBeenCalled();
});

test("저장소에 없는 과거 승인 요청은 재실행 시 새 카드로 표시하지 않는다", async () => {
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups.mockResolvedValue({
    groups: [
      {
        id: "historical-group",
        isManager: false,
        memberCount: 2,
        myMemberId: "historical-member",
        name: "과거 가족",
        role: "guardian",
      },
    ],
    joinRequests: [
      {
        groupId: "historical-group",
        groupName: "과거 가족",
        joinRequestId: "historical-request",
        processedAt: "2026-08-01T00:00:00Z",
        requestedAt: "2026-07-31T00:00:00Z",
        status: "APPROVED",
      },
    ],
  });
  const authSession = createAuthSessionCoordinator({
    status: "authenticated",
    user: {id: 7, name: "복원 사용자"},
  });
  const joinRequestStore = {
    load: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        authSession={authSession}
        groupGateway={groupGateway}
        joinRequestStore={joinRequestStore}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  await resolveAuthRestore(authSession);

  expect(renderer!.root.findByType(AppShell)).toBeTruthy();
  expect(
    renderer!.root.findAllByProps({accessibilityLabel: "과거 가족 열기"}),
  ).toHaveLength(0);
});

test("실제 3초 폴링은 그룹 요약이 함께 보일 때 승인 카드로 전환한다", async () => {
  jest.useFakeTimers();
  try {
    const pendingSnapshot = {
      groups: [],
      joinRequests: [
        {
          groupId: "polled-group",
          groupName: "폴링 가족",
          joinRequestId: "request-polled",
          processedAt: null,
          requestedAt: "2026-08-02T00:00:00Z",
          status: "PENDING_ADMIN" as const,
        },
      ],
    };
    const approvedWithoutGroup = {
      groups: [],
      joinRequests: [
        {
          ...pendingSnapshot.joinRequests[0],
          processedAt: "2026-08-03T00:00:00Z",
          status: "APPROVED" as const,
        },
      ],
    };
    const approvedWithGroup = {
      groups: [
        {
          id: "polled-group",
          isManager: false,
          memberCount: 2,
          myMemberId: "polled-member",
          name: "폴링 가족",
          role: "guardian" as const,
        },
      ],
      joinRequests: approvedWithoutGroup.joinRequests,
    };
    const groupGateway = createGroupGateway();
    groupGateway.loadGroups
      .mockResolvedValueOnce(pendingSnapshot)
      .mockResolvedValueOnce(pendingSnapshot)
      .mockResolvedValueOnce(approvedWithoutGroup)
      .mockResolvedValueOnce(approvedWithGroup);
    const authSession = createAuthSessionCoordinator({
      status: "authenticated",
      user: {id: 7, name: "폴링 사용자"},
    });
    const joinRequestStore = {
      load: jest.fn().mockResolvedValue(["request-polled"]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    let renderer: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      renderer = TestRenderer.create(
        <App
          authSession={authSession}
          groupGateway={groupGateway}
          joinRequestStore={joinRequestStore}
        />,
      );
    });
    mountedRenderers.push(renderer!);
    await resolveAuthRestore(authSession);
    await TestRenderer.act(flushAsyncWork);

    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3_000);
      await flushAsyncWork();
    });
    expect(
      renderer!.root.findAllByProps({accessibilityLabel: "폴링 가족 열기"}),
    ).toHaveLength(0);
    expect(JSON.stringify(renderer!.toJSON())).toContain("승인 요청 대기");

    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3_000);
      await flushAsyncWork();
    });
    expect(
      renderer!.root.findByProps({accessibilityLabel: "폴링 가족 열기"}),
    ).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

test("가입 요청 뒤 그룹 재조회 중 화면이 종료되면 늦은 결과를 읽지 않는다", async () => {
  const groupGateway = createGroupGateway();
  const reload = createDeferred<
    Awaited<ReturnType<FamilyGroupGateway["loadGroups"]>>
  >();
  const requestJoinByCode = jest.fn().mockResolvedValue({
    groupId: "group-join-api",
    groupName: "API 가족",
    joinRequestId: "request-api",
    status: "PENDING_ADMIN",
  });
  groupGateway.requestJoinByCode = requestJoinByCode;
  groupGateway.loadGroups.mockReturnValueOnce(reload.promise);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="groupOnboarding" groupGateway={groupGateway} />
    );
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "받은 코드로 기존 그룹에 들어가요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "6자리 초대 코드" })
      .props.onChangeText("ab12c3");
  });
  let submitPromise!: Promise<void>;
  TestRenderer.act(() => {
    submitPromise = renderer!.root
      .findByProps({ accessibilityLabel: "참여 요청 보내기" })
      .props.onPress();
  });
  await TestRenderer.act(flushAsyncWork);

  const signal = requestJoinByCode.mock.calls[0]?.[1];
  expect(groupGateway.loadGroups).toHaveBeenCalledTimes(1);
  expect(signal?.aborted).toBe(false);

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
  expect(signal?.aborted).toBe(true);

  let joinRequestsReadCount = 0;
  await TestRenderer.act(async () => {
    reload.resolve({
      groups: [],
      get joinRequests() {
        joinRequestsReadCount += 1;
        return [];
      },
    });
    await submitPromise;
  });

  expect(joinRequestsReadCount).toBe(0);
});

test("초대 코드 참여 요청이 실패하면 입력창을 유지하고 대기 카드를 추가하지 않는다", async () => {
  const onJoinGroup = jest
    .fn()
    .mockRejectedValue(new Error("invalid invite code"));
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="groupOnboarding" onJoinGroup={onJoinGroup} />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "받은 코드로 기존 그룹에 들어가요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "6자리 초대 코드" })
      .props.onChangeText("123456");
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "참여 요청 보내기" })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({
      children: "초대 코드를 확인하고 다시 시도해주세요.",
    })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: "6자리 초대 코드",
    }).props.value
  ).toBe("123456");
  expect(renderer!.root.findAllByProps({ children: "우리 가족" })).toHaveLength(
    0
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    "아직 참가한 그룹이 없어요"
  );
});

test("가입 게이트웨이가 없으면 코드 오류 대신 후속 연동을 안내한다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  const groupGateway = createGroupGateway();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="groupOnboarding" groupGateway={groupGateway} />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityHint: "받은 코드로 기존 그룹에 들어가요",
      })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "6자리 초대 코드" })
      .props.onChangeText("123456");
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "참여 요청 보내기" })
      .props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    "코드로 참여",
    "후속 작업에서 연결될 화면입니다."
  );
  expect(
    renderer!.root.findAllByProps({
      children: "초대 코드를 확인하고 다시 시도해주세요.",
    })
  ).toHaveLength(0);
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: "6자리 초대 코드",
    })
  ).toHaveLength(0);
  alertSpy.mockRestore();
});

test("피드의 생성·참여 버튼은 시트를 바로 열고 취소하면 피드로 돌아온다", async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="appShell" groups={[]} />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root.findByType(AppShell).props.onJoinGroup();
  });
  expect(
    renderer!.root.findByProps({ children: "가족과\n연결해볼까요?" })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityLabel: "6자리 초대 코드" })
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.root.findByType(JoinGroupSheet).props.onDismiss();
  });

  expect(renderer!.root.findByType(AppShell)).toBeTruthy();
  expect(renderer!.root.findByType(AppShell).props.initialRoute).toBe("feed");
  expect(
    renderer!.root.findByProps({ children: "참여 중인 그룹이 없어요" })
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.root.findByType(AppShell).props.onCreateGroup();
  });
  expect(renderer!.root.findByType(CreateGroupSheet).props.visible).toBe(true);

  await TestRenderer.act(() => {
    renderer!.root.findByType(CreateGroupSheet).props.onDismiss();
  });
  expect(renderer!.root.findByType(AppShell).props.initialRoute).toBe("feed");
});

test("승인된 피보호자는 지정된 역할로 그룹에 진입한다", async () => {
  const groupStore = {
    load: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        groupStore={groupStore}
        initialJoinRequests={[
          {
            groupId: "approved-care-group",
            groupName: "돌봄 가족",
            id: "approved-request",
            myMemberId: "member-manager",
            role: "careReceiver",
            status: "APPROVED",
          },
        ]}
        initialRootRoute="groupOnboarding"
      />
    );
  });
  mountedRenderers.push(renderer!);

  expect(JSON.stringify(renderer!.toJSON())).toContain("가입이 승인되었어요");
  expect(JSON.stringify(renderer!.toJSON())).toContain("눌러서 입장하기");

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "돌봄 가족 열기" })
      .props.onPress();
  });

  expect(renderer!.root.findByType(AppShell)).toBeTruthy();
  expect(renderer!.root.findByProps({accessibilityLabel: "피드 탭"})).toBeTruthy();
  expect(renderer!.root.findByProps({ children: "돌봄 가족" })).toBeTruthy();
  expect(renderer!.root.findAllByProps({ children: "리포트" })).toHaveLength(0);
  expect(groupStore.save).toHaveBeenCalledWith("approved-care-group");
});

test("로그인 응답의 현재 회원 이름을 A-10 인사말에 표시한다", async () => {
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: null,
    id: 2,
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
    id: 1,
    name: "이종철",
  });
  const authSession = createAuthSessionCoordinator();
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups.mockResolvedValueOnce({
    groups: [
      {
        id: "active-group-1",
        isManager: true,
        memberCount: 2,
        myMemberId: "member-1",
        name: "우리 가족",
        role: "guardian",
      },
    ],
    joinRequests: [],
  });
  const onOpenActiveGroup = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        authGateway={authGateway}
        authSession={authSession}
        groupGateway={groupGateway}
        onOpenActiveGroup={onOpenActiveGroup}
      />
    );
  });
  await resolveAuthRestore(authSession);
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

test("활성 그룹 사용자는 연결된 앱 셸로 이동한다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  const authGateway = createAuthGateway();
  authGateway.login.mockResolvedValueOnce({
    activeGroupId: "active-group-1",
    id: 1,
    name: "이종철",
  });
  const authSession = createAuthSessionCoordinator();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        authGateway={authGateway}
        authSession={authSession}
        groups={[
          {
            id: "active-group-1",
            name: "우리 가족",
            role: "guardian",
          },
        ]}
      />
    );
  });
  await resolveAuthRestore(authSession);
  mountedRenderers.push(renderer!);
  await openLogin(renderer!);
  await enterValidCredentials(renderer!);

  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  expect(alertSpy).not.toHaveBeenCalled();
  expect(renderer!.root.findByProps({ children: "우리 가족" })).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityRole: "tablist" })
  ).toBeTruthy();
  alertSpy.mockRestore();
});

test("그룹 이름 변경 API가 성공하면 현재 그룹 이름도 갱신한다", async () => {
  const groupGateway = createGroupGateway();
  let currentName = "기존 가족";
  groupGateway.getGroupDetail.mockImplementation(async (groupId) => ({
    careReceiverCount: 0,
    guardianCount: 1,
    id: groupId,
    isManager: true,
    managerMemberId: "member-manager",
    memberCount: 1,
    name: currentName,
  }));
  groupGateway.renameGroup.mockImplementation(async (groupId, name) => {
    currentName = name;
    return {
      id: groupId,
      name,
      updatedAt: "2026-07-31T02:03:04Z",
    };
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        groupGateway={groupGateway}
        groups={[{ id: "101", name: currentName, role: "guardian" }]}
        initialGroupId="101"
        initialRootRoute="appShell"
      />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "그룹정보 탭" })
      .props.onPress();
    await Promise.resolve();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "그룹명 변경" })
      .props.onPress();
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "그룹 이름 입력" })
      .props.onChangeText("새 가족");
  });
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "변경하기" })
      .props.onPress();
  });

  expect(groupGateway.renameGroup).toHaveBeenCalledWith("101", "새 가족");
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "피드 탭" })
      .props.onPress();
  });
  expect(renderer!.root.findByProps({ children: "새 가족" })).toBeTruthy();
});

test("현재 사용자의 역할 변경 성공은 하단 탭 권한을 즉시 갱신한다", async () => {
  const groupGateway = createGroupGateway();
  groupGateway.getGroupDetail.mockResolvedValue({
    careReceiverCount: 0,
    guardianCount: 1,
    id: "role-group",
    isManager: true,
    managerMemberId: "member-self",
    memberCount: 1,
    name: "역할 가족",
  });
  const groupMemberGateway: jest.Mocked<GroupMemberGateway> = {
    loadMemberProfile: jest.fn(),
    loadMembers: jest.fn().mockResolvedValue([
      {
        age: null,
        alias: null,
        avatarText: "나",
        gender: null,
        isManager: true,
        memberId: "member-self",
        name: "나",
        role: "guardian",
        userId: "1",
      },
    ]),
    updateMemberAlias: jest.fn(),
    updateMemberRole: jest.fn().mockResolvedValue({
      groupId: "role-group",
      memberId: "member-self",
      role: "careReceiver",
    }),
  };
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        groupGateway={groupGateway}
        groupMemberGateway={groupMemberGateway}
        groups={[
          {
            id: "role-group",
            myMemberId: "member-self",
            name: "역할 가족",
            role: "guardian",
          },
        ]}
        initialGroupId="role-group"
        initialRootRoute="appShell"
      />,
    );
    await flushAsyncWork();
  });
  mountedRenderers.push(renderer!);
  expect(renderer!.root.findAllByProps({children: "리포트"}).length).toBeGreaterThan(0);

  await TestRenderer.act(async () => {
    renderer!.root.findByProps({accessibilityLabel: "그룹정보 탭"}).props.onPress();
    await flushAsyncWork();
  });
  await TestRenderer.act(() => {
    renderer!.root.findByProps({accessibilityLabel: "나 피보호자"}).props.onPress();
  });
  const changeAction = alertSpy.mock.calls.at(-1)?.[2]?.find(
    action => action.text === "변경",
  );
  await TestRenderer.act(async () => {
    changeAction?.onPress?.();
    await flushAsyncWork();
  });

  expect(groupMemberGateway.updateMemberRole).toHaveBeenCalledWith(
    "role-group",
    "member-self",
    "careReceiver",
  );
  expect(renderer!.root.findAllByProps({children: "리포트"})).toHaveLength(0);
});

test("로그아웃 확인 후 로컬 세션을 지우고 A-1로 돌아온다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  const { authGateway, authSession, renderer } = await renderApp();
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
  expect(authSession.clearLocalSession).toHaveBeenCalledTimes(1);
  expect(imageDiskCache.clearAll).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })
  ).toBeTruthy();
  alertSpy.mockRestore();
});

test("회원탈퇴를 취소하면 탈퇴 API를 호출하지 않는다", async () => {
  const profileGateway = createProfileGateway();
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    createGroupGateway(),
    undefined,
    undefined,
    profileGateway
  );
  await loginToSignedInWelcome(renderer);

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "회원탈퇴" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({
      accessibilityLabel: "회원탈퇴 확인",
    })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      children:
        "탈퇴하면 개인정보가 익명화되고 계정을 복구할 수 없습니다. 계속할까요?",
    })
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "회원탈퇴 취소" })
      .props.onPress();
  });

  expect(profileGateway.withdrawCurrentUser).not.toHaveBeenCalled();
  expect(renderer.root.findByType(SignedInWelcomeScreen)).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "회원탈퇴 확인" })
  ).toHaveLength(0);
});

test("회원탈퇴 확인을 연속 제출해도 단일 요청만 보낸다", async () => {
  const profileGateway = createProfileGateway();
  let resolveWithdrawal: (() => void) | undefined;
  const withdrawalPromise = new Promise<void>(resolve => {
    resolveWithdrawal = resolve;
  });
  profileGateway.withdrawCurrentUser.mockReturnValue(withdrawalPromise);
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    createGroupGateway(),
    undefined,
    undefined,
    profileGateway
  );
  await loginToSignedInWelcome(renderer);

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "회원탈퇴" })
      .props.onPress();
  });

  const confirmButton = renderer.root.findByProps({
    accessibilityLabel: "회원탈퇴 확인하기",
  });
  await TestRenderer.act(async () => {
    confirmButton.props.onPress();
    confirmButton.props.onPress();
    await Promise.resolve();
  });

  expect(profileGateway.withdrawCurrentUser).toHaveBeenCalledTimes(1);
  resolveWithdrawal?.();
  await TestRenderer.act(async () => {
    await withdrawalPromise;
    await flushAsyncWork();
  });
  expect(renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })).toBeTruthy();
});

test("회원탈퇴 204 성공 후 로그아웃 API 없이 로컬 상태를 지우고 시작 화면으로 이동한다", async () => {
  const authGateway = createAuthGateway();
  const authSession = createAuthSessionCoordinator();
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "withdraw-token");
  const profileGateway = createProfileGateway();
  const { renderer } = await renderApp(
    authGateway,
    authSession,
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider,
    profileGateway
  );
  await loginToSignedInWelcome(renderer);

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "회원탈퇴" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "회원탈퇴 확인하기" })
      .props.onPress();
    await flushAsyncWork();
  });

  expect(profileGateway.withdrawCurrentUser).toHaveBeenCalledTimes(1);
  expect(authGateway.logout).not.toHaveBeenCalled();
  expect(authSession.clearLocalSession).toHaveBeenCalledTimes(1);
  expect(imageDiskCache.clearAll).toHaveBeenCalledTimes(1);
  expect(notificationGateway.deactivateDeviceToken).not.toHaveBeenCalled();
  expect(renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })).toBeTruthy();
});

test.each([
  [
    "관리자 위임 필요",
    new ApiError({
      code: "MANAGER_TRANSFER_REQUIRED",
      kind: "server",
      message: "관리자 위임이 필요합니다.",
      status: 409,
    }),
  ],
  [
    "인증 만료",
    new ApiError({
      code: "UNAUTHORIZED",
      kind: "server",
      message: "인증이 만료되었습니다.",
      status: 401,
    }),
  ],
  [
    "네트워크 오류",
    new ApiError({
      code: "NETWORK_ERROR",
      kind: "network",
      message: "네트워크 연결을 확인해 주세요.",
    }),
  ],
  [
    "시간초과 오류",
    new ApiError({
      code: "API_TIMEOUT",
      kind: "timeout",
      message: "요청 시간이 초과되었습니다.",
    }),
  ],
])(
  "회원탈퇴 %s 시 상태를 보존하고 재시도할 수 있다",
  async (_label, failure) => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const authSession = createAuthSessionCoordinator();
    const profileGateway = createProfileGateway();
    profileGateway.withdrawCurrentUser
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const { renderer } = await renderApp(
      createAuthGateway(),
      authSession,
      createGroupGateway(),
      undefined,
      undefined,
      profileGateway
    );
    await loginToSignedInWelcome(renderer);

    await TestRenderer.act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: "회원탈퇴" })
        .props.onPress();
    });
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: "회원탈퇴 확인하기" })
        .props.onPress();
      await flushAsyncWork();
    });

    expect(profileGateway.withdrawCurrentUser).toHaveBeenCalledTimes(1);
    expect(authSession.clearLocalSession).not.toHaveBeenCalled();
    expect(renderer.root.findByType(SignedInWelcomeScreen)).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      "회원 탈퇴에 실패했습니다.",
      expect.any(String)
    );

    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: "회원탈퇴 확인하기" })
        .props.onPress();
      await flushAsyncWork();
    });

    expect(profileGateway.withdrawCurrentUser).toHaveBeenCalledTimes(2);
    expect(renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })).toBeTruthy();
  }
);

test("회원탈퇴 실패 중 완료된 디바이스 토큰 등록을 이후 로그아웃에서 해제한다", async () => {
  const authGateway = createAuthGateway();
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider(
    "granted",
    "pending-withdraw-token"
  );
  const profileGateway = createProfileGateway();
  const withdrawalFailure = new ApiError({
    code: "NETWORK_ERROR",
    kind: "network",
    message: "네트워크 연결을 확인해 주세요.",
  });
  profileGateway.withdrawCurrentUser.mockRejectedValueOnce(withdrawalFailure);
  let resolveRegistration:
    | ((value: Awaited<ReturnType<NotificationGateway["registerDeviceToken"]>>) => void)
    | undefined;
  const registrationPromise = new Promise<
    Awaited<ReturnType<NotificationGateway["registerDeviceToken"]>>
  >(resolve => {
    resolveRegistration = resolve;
  });
  notificationGateway.registerDeviceToken.mockReturnValueOnce(registrationPromise);
  const { renderer } = await renderApp(
    authGateway,
    createAuthSessionCoordinator(),
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider,
    profileGateway
  );
  await loginToSignedInWelcome(renderer);

  let withdrawalPromise: Promise<void> | undefined;
  await TestRenderer.act(async () => {
    withdrawalPromise = renderer.root
      .findByType(SignedInWelcomeScreen)
      .props.onRequestWithdrawal();
    await flushAsyncWork();
  });
  expect(profileGateway.withdrawCurrentUser).not.toHaveBeenCalled();

  resolveRegistration?.({
    active: true,
    deviceType: "ANDROID",
    id: "1",
  });
  await TestRenderer.act(async () => {
    await expect(withdrawalPromise).rejects.toBe(withdrawalFailure);
    await flushAsyncWork();
  });

  expect(renderer.root.findByType(SignedInWelcomeScreen)).toBeTruthy();
  await TestRenderer.act(async () => {
    await renderer.root.findByType(SignedInWelcomeScreen).props.onLogout();
  });
  expect(notificationGateway.deactivateDeviceToken).toHaveBeenCalledWith(
    "pending-withdraw-token"
  );
  expect(authGateway.logout).toHaveBeenCalledTimes(1);
});

test("회원탈퇴 실패 전에 인증이 무효화되면 활성·등록 중 디바이스 토큰을 해제한다", async () => {
  const authSession = createAuthSessionCoordinator();
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider(
    "granted",
    "active-before-withdrawal"
  );
  let refreshListener: ((token: string) => void) | undefined;
  deviceTokenProvider.subscribeTokenRefresh = jest.fn(listener => {
    refreshListener = listener;
    return jest.fn();
  });
  const profileGateway = createProfileGateway();
  const withdrawalFailure = new ApiError({
    code: "UNAUTHORIZED",
    kind: "server",
    message: "인증이 만료되었습니다.",
    status: 401,
  });
  profileGateway.withdrawCurrentUser.mockRejectedValueOnce(withdrawalFailure);
  let resolveRegistration:
    | ((value: Awaited<ReturnType<NotificationGateway["registerDeviceToken"]>>) => void)
    | undefined;
  const registrationPromise = new Promise<
    Awaited<ReturnType<NotificationGateway["registerDeviceToken"]>>
  >(resolve => {
    resolveRegistration = resolve;
  });
  const { renderer } = await renderApp(
    createAuthGateway(),
    authSession,
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider,
    profileGateway
  );
  await loginToSignedInWelcome(renderer);
  notificationGateway.registerDeviceToken.mockReturnValueOnce(registrationPromise);
  await TestRenderer.act(async () => {
    refreshListener?.("invalidated-withdraw-token");
    await flushAsyncWork();
  });

  let withdrawalPromise: Promise<void> | undefined;
  await TestRenderer.act(async () => {
    withdrawalPromise = renderer.root
      .findByType(SignedInWelcomeScreen)
      .props.onRequestWithdrawal();
    await flushAsyncWork();
    authSession.emitInvalidated();
  });
  resolveRegistration?.({
    active: true,
    deviceType: "ANDROID",
    id: "1",
  });
  await TestRenderer.act(async () => {
    await expect(withdrawalPromise).rejects.toBe(withdrawalFailure);
    await flushAsyncWork();
  });

  expect(notificationGateway.deactivateDeviceToken).toHaveBeenCalledWith(
    "invalidated-withdraw-token"
  );
  expect(notificationGateway.deactivateDeviceToken).toHaveBeenCalledWith(
    "active-before-withdrawal"
  );
  expect(renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })).toBeTruthy();
});

test("이전 세션의 탈퇴 실패가 재로그인한 세션의 디바이스 토큰을 덮어쓰지 않는다", async () => {
  const authGateway = createAuthGateway();
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "first-token");
  let refreshListener: ((token: string) => void) | undefined;
  deviceTokenProvider.subscribeTokenRefresh = jest.fn(listener => {
    refreshListener = listener;
    return jest.fn();
  });
  const profileGateway = createProfileGateway();
  const withdrawalFailure = new ApiError({
    code: "NETWORK_ERROR",
    kind: "network",
    message: "네트워크 연결을 확인해 주세요.",
  });
  let rejectWithdrawal: ((reason: unknown) => void) | undefined;
  profileGateway.withdrawCurrentUser.mockReturnValueOnce(
    new Promise<void>((_resolve, reject) => {
      rejectWithdrawal = reject;
    })
  );
  let resolveRegistration:
    | ((value: Awaited<ReturnType<NotificationGateway["registerDeviceToken"]>>) => void)
    | undefined;
  notificationGateway.registerDeviceToken.mockImplementationOnce(async token => ({
    active: true,
    deviceType: "ANDROID",
    id: token,
  }));
  notificationGateway.registerDeviceToken.mockReturnValueOnce(
    new Promise(resolve => {
      resolveRegistration = resolve;
    })
  );
  const { renderer } = await renderApp(
    authGateway,
    createAuthSessionCoordinator(),
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider,
    profileGateway
  );
  await loginToSignedInWelcome(renderer);

  await TestRenderer.act(async () => {
    refreshListener?.("withdrawal-token");
    await flushAsyncWork();
  });
  let withdrawalPromise: Promise<void> | undefined;
  await TestRenderer.act(async () => {
    withdrawalPromise = renderer.root
      .findByType(SignedInWelcomeScreen)
      .props.onRequestWithdrawal();
    await flushAsyncWork();
  });
  resolveRegistration?.({
    active: true,
    deviceType: "ANDROID",
    id: "withdrawal-registration",
  });
  await TestRenderer.act(async () => {
    await flushAsyncWork();
  });
  expect(profileGateway.withdrawCurrentUser).toHaveBeenCalledTimes(1);

  await TestRenderer.act(async () => {
    await renderer.root.findByType(SignedInWelcomeScreen).props.onLogout();
  });
  deviceTokenProvider.getToken.mockResolvedValue("second-token");
  await loginToSignedInWelcome(renderer);

  rejectWithdrawal?.(withdrawalFailure);
  await TestRenderer.act(async () => {
    await expect(withdrawalPromise).rejects.toBe(withdrawalFailure);
    await flushAsyncWork();
  });

  expect(notificationGateway.deactivateDeviceToken).not.toHaveBeenCalledWith(
    "second-token"
  );
  await TestRenderer.act(async () => {
    await renderer.root.findByType(SignedInWelcomeScreen).props.onLogout();
  });
  expect(notificationGateway.deactivateDeviceToken).toHaveBeenCalledWith(
    "second-token"
  );
});

test("이전 세션 토큰 정리가 끝난 뒤 같은 토큰을 새 세션에 등록한다", async () => {
  const authGateway = createAuthGateway();
  const authSession = createAuthSessionCoordinator();
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "same-token");
  const profileGateway = createProfileGateway();
  const withdrawalFailure = new ApiError({
    code: "NETWORK_ERROR",
    kind: "network",
    message: "네트워크 연결을 확인해 주세요.",
  });
  let rejectWithdrawal: ((reason: unknown) => void) | undefined;
  profileGateway.withdrawCurrentUser.mockReturnValueOnce(
    new Promise<void>((_resolve, reject) => {
      rejectWithdrawal = reject;
    })
  );
  const { renderer } = await renderApp(
    authGateway,
    authSession,
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider,
    profileGateway
  );
  await loginToSignedInWelcome(renderer);

  let withdrawalPromise: Promise<void> | undefined;
  await TestRenderer.act(async () => {
    withdrawalPromise = renderer.root
      .findByType(SignedInWelcomeScreen)
      .props.onRequestWithdrawal();
    await flushAsyncWork();
    authSession.emitInvalidated();
  });

  let resolveNextToken: ((token: string) => void) | undefined;
  deviceTokenProvider.getToken.mockReturnValueOnce(
    new Promise(resolve => {
      resolveNextToken = resolve;
    })
  );
  await loginToSignedInWelcome(renderer);

  let resolveDeactivation: (() => void) | undefined;
  notificationGateway.deactivateDeviceToken.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        resolveDeactivation = resolve;
      })
  );
  const withdrawalResult = withdrawalPromise?.then(
    () => undefined,
    error => error
  );
  rejectWithdrawal?.(withdrawalFailure);
  await TestRenderer.act(async () => {
    await flushAsyncWork();
  });

  expect(notificationGateway.deactivateDeviceToken).toHaveBeenCalledWith(
    "same-token"
  );
  resolveNextToken?.("same-token");
  await TestRenderer.act(async () => {
    await flushAsyncWork();
  });
  expect(notificationGateway.registerDeviceToken).toHaveBeenCalledTimes(1);

  resolveDeactivation?.();
  await TestRenderer.act(async () => {
    await expect(withdrawalResult).resolves.toBe(withdrawalFailure);
    await flushAsyncWork();
  });
  expect(notificationGateway.registerDeviceToken).toHaveBeenCalledTimes(2);
  expect(notificationGateway.registerDeviceToken).toHaveBeenLastCalledWith(
    "same-token"
  );
});

test("서버 탈퇴 성공 후 로컬 세션 정리가 실패해도 화면을 초기화하고 경고한다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  const authSession = createAuthSessionCoordinator();
  authSession.clearLocalSession.mockRejectedValueOnce(
    new Error("local storage unavailable")
  );
  const profileGateway = createProfileGateway();
  const { renderer } = await renderApp(
    createAuthGateway(),
    authSession,
    createGroupGateway(),
    undefined,
    undefined,
    profileGateway
  );
  await loginToSignedInWelcome(renderer);

  await TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "회원탈퇴" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "회원탈퇴 확인하기" })
      .props.onPress();
    await flushAsyncWork();
  });

  expect(profileGateway.withdrawCurrentUser).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })).toBeTruthy();
  expect(alertSpy).toHaveBeenCalledWith(
    "회원 탈퇴 완료",
    expect.stringContaining("로컬 로그인 정보 정리")
  );
});

test("로그인 완료 후 허용된 디바이스 토큰을 등록한다", async () => {
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "login-token");
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await flushAsyncWork();
  });

  expect(deviceTokenProvider.requestPermission).toHaveBeenCalledTimes(1);
  expect(deviceTokenProvider.getToken).toHaveBeenCalledTimes(1);
  expect(notificationGateway.registerDeviceToken).toHaveBeenCalledWith(
    "login-token"
  );
});

test("알림 권한이 거부되면 디바이스 토큰을 등록하지 않는다", async () => {
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("denied", "denied-token");
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await flushAsyncWork();
  });

  expect(deviceTokenProvider.getToken).not.toHaveBeenCalled();
  expect(notificationGateway.registerDeviceToken).not.toHaveBeenCalled();
});

test("로그아웃은 인증 로그아웃 전에 활성 디바이스 토큰을 비활성화한다", async () => {
  const authGateway = createAuthGateway();
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "logout-token");
  const { renderer } = await renderApp(
    authGateway,
    createAuthSessionCoordinator(),
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await flushAsyncWork();
  });
  await TestRenderer.act(async () => {
    await renderer.root.findByType(SignedInWelcomeScreen).props.onLogout();
  });

  expect(notificationGateway.deactivateDeviceToken).toHaveBeenCalledWith(
    "logout-token"
  );
  expect(
    notificationGateway.deactivateDeviceToken.mock.invocationCallOrder[0]
  ).toBeLessThan(authGateway.logout.mock.invocationCallOrder[0]);
});

test("앱 시작 시 저장된 인증 사용자를 기존 로그인 후 경로로 복원한다", async () => {
  const authSession = createAuthSessionCoordinator({
    status: "authenticated",
    user: { id: 7, name: "복원 사용자" },
  });
  const { renderer } = await renderApp(createAuthGateway(), authSession);

  expect(authSession.restore).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({ children: "복원 사용자 님,\n안녕하세요" })
  ).toBeTruthy();
});

test("저장된 인증 사용자 복원 후에도 디바이스 토큰을 등록한다", async () => {
  const authSession = createAuthSessionCoordinator({
    status: "authenticated",
    user: { id: 7, name: "복원 사용자" },
  });
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "restore-token");
  await renderApp(
    createAuthGateway(),
    authSession,
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider
  );

  await TestRenderer.act(async () => {
    await flushAsyncWork();
  });

  expect(notificationGateway.registerDeviceToken).toHaveBeenCalledWith(
    "restore-token"
  );
});

test("인증 상태의 토큰 갱신 이벤트는 새 토큰을 등록하고 이전 토큰을 해제한다", async () => {
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "initial-token");
  let refreshListener: ((token: string) => void) | undefined;
  deviceTokenProvider.subscribeTokenRefresh = jest.fn(listener => {
    refreshListener = listener;
    return jest.fn();
  });
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await flushAsyncWork();
  });

  expect(refreshListener).toBeDefined();
  await TestRenderer.act(async () => {
    refreshListener!("rotated-token");
    await flushAsyncWork();
  });

  expect(notificationGateway.registerDeviceToken).toHaveBeenLastCalledWith(
    "rotated-token"
  );
  expect(notificationGateway.deactivateDeviceToken).toHaveBeenCalledWith(
    "initial-token"
  );
});

test("겹친 동일 토큰 등록을 한 요청으로 합쳐 최신 활성 토큰을 해제하지 않는다", async () => {
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "same-token");
  let refreshListener: ((token: string) => void) | undefined;
  let resolveRegistration:
    | ((value: Awaited<ReturnType<NotificationGateway["registerDeviceToken"]>>) => void)
    | undefined;
  deviceTokenProvider.subscribeTokenRefresh = jest.fn(listener => {
    refreshListener = listener;
    return jest.fn();
  });
  notificationGateway.registerDeviceToken.mockReturnValueOnce(
    new Promise(resolve => {
      resolveRegistration = resolve;
    })
  );
  const { renderer } = await renderApp(
    createAuthGateway(),
    createAuthSessionCoordinator(),
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await flushAsyncWork();
  });

  expect(notificationGateway.registerDeviceToken).toHaveBeenCalledTimes(1);
  expect(refreshListener).toBeDefined();
  await TestRenderer.act(async () => {
    refreshListener!("same-token");
    await flushAsyncWork();
  });
  expect(notificationGateway.registerDeviceToken).toHaveBeenCalledTimes(1);

  resolveRegistration?.({
    active: true,
    deviceType: "ANDROID",
    id: "same-token",
  });
  await TestRenderer.act(async () => {
    await flushAsyncWork();
  });

  expect(notificationGateway.deactivateDeviceToken).not.toHaveBeenCalledWith(
    "same-token"
  );
});

test("로그아웃 시작 후 도착한 토큰 갱신은 새 토큰을 등록하지 않는다", async () => {
  const authGateway = createAuthGateway();
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "active-token");
  let refreshListener: ((token: string) => void) | undefined;
  deviceTokenProvider.subscribeTokenRefresh = jest.fn(listener => {
    refreshListener = listener;
    return jest.fn();
  });
  const { renderer } = await renderApp(
    authGateway,
    createAuthSessionCoordinator(),
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await flushAsyncWork();
  });

  await TestRenderer.act(async () => {
    const logoutPromise = renderer.root
      .findByType(SignedInWelcomeScreen)
      .props.onLogout();
    refreshListener!("late-token");
    await logoutPromise;
    await flushAsyncWork();
  });

  expect(notificationGateway.registerDeviceToken).not.toHaveBeenCalledWith(
    "late-token"
  );
  expect(authGateway.logout).toHaveBeenCalledTimes(1);
});

test("인증 무효화 중 빠른 재로그인은 이전 토큰 해제 후 새 토큰을 등록한다", async () => {
  const authGateway = createAuthGateway();
  const authSession = createAuthSessionCoordinator();
  const notificationGateway = createNotificationGateway();
  const deviceTokenProvider = createDeviceTokenProvider("granted", "same-token");
  let resolveDeactivation: (() => void) | undefined;
  notificationGateway.deactivateDeviceToken.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        resolveDeactivation = resolve;
      })
  );
  const { renderer } = await renderApp(
    authGateway,
    authSession,
    createGroupGateway(),
    notificationGateway,
    deviceTokenProvider
  );
  await openLogin(renderer);
  await enterValidCredentials(renderer);
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await flushAsyncWork();
  });

  await TestRenderer.act(async () => {
    authSession.emitInvalidated();
    await Promise.resolve();
  });
  await openLogin(renderer);
  await enterValidCredentials(renderer);

  let loginPromise: Promise<void> | undefined;
  await TestRenderer.act(async () => {
    loginPromise = renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
    await Promise.resolve();
    expect(notificationGateway.registerDeviceToken).toHaveBeenCalledTimes(1);
    resolveDeactivation?.();
    await loginPromise;
    await flushAsyncWork();
  });

  expect(notificationGateway.registerDeviceToken).toHaveBeenCalledTimes(2);
  expect(
    notificationGateway.deactivateDeviceToken.mock.invocationCallOrder[0]
  ).toBeLessThan(
    notificationGateway.registerDeviceToken.mock.invocationCallOrder[1]
  );
});

test("재시도 가능한 복원 오류에서는 인증 화면 대신 재시도 화면을 보여준다", async () => {
  const authSession = createAuthSessionCoordinator({
    error: new Error("network"),
    status: "retryableError",
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<App authSession={authSession} />);
  });
  await resolveAuthRestore(authSession);
  mountedRenderers.push(renderer!);

  // 백지가 아니라 오류 안내와 재시도 버튼을 보여준다.
  expect(renderer!.toJSON()).not.toBeNull();
  expect(
    renderer!.root.findByProps({ children: "연결에 문제가 있어요" })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityLabel: "다시 시도" })
  ).toBeTruthy();
  // 인증·비로그인 화면은 선택하지 않고 세션도 지우지 않는다.
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: "로그인 시작" })
  ).toHaveLength(0);
  expect(authSession.clearLocalSession).not.toHaveBeenCalled();
});

test("재시도 진행 중에는 백지 대신 오류 화면을 유지하고 버튼을 잠근다", async () => {
  const authSession = createAuthSessionCoordinator({
    error: new Error("network"),
    status: "retryableError",
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<App authSession={authSession} />);
  });
  await resolveAuthRestore(authSession);
  mountedRenderers.push(renderer!);

  // 두 번째 복원은 확정되지 않은 채 진행 중으로 둔다.
  let resolveSecondRestore: ((result: AuthRestoreResult) => void) | undefined;
  authSession.restore.mockReturnValueOnce(
    new Promise<AuthRestoreResult>((resolve) => {
      resolveSecondRestore = resolve;
    })
  );

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "다시 시도" })
      .props.onPress();
  });

  // 복원이 진행되는 동안에도 오류 화면이 유지되고 버튼은 로딩으로 잠긴다.
  expect(renderer!.toJSON()).not.toBeNull();
  expect(
    renderer!.root.findByProps({ children: "연결에 문제가 있어요" })
  ).toBeTruthy();
  const retryButton = renderer!.root.findByProps({
    accessibilityLabel: "다시 시도",
  });
  expect(retryButton.props.accessibilityState.busy).toBe(true);

  // 재시도도 실패하면 오류 화면이 남고 버튼이 다시 풀린다.
  await TestRenderer.act(async () => {
    resolveSecondRestore?.({ error: new Error("still down"), status: "retryableError" });
    await flushAsyncWork();
  });
  expect(
    renderer!.root.findByProps({ children: "연결에 문제가 있어요" })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityLabel: "다시 시도" }).props
      .accessibilityState.busy
  ).toBe(false);
});

test("복원 자체가 예외로 실패해도 재시도 화면으로 전환한다", async () => {
  const authSession = createAuthSessionCoordinator();
  authSession.restore.mockRejectedValueOnce(new Error("unexpected"));
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<App authSession={authSession} />);
    await flushAsyncWork();
  });
  mountedRenderers.push(renderer!);

  expect(
    renderer!.root.findByProps({ children: "연결에 문제가 있어요" })
  ).toBeTruthy();
  expect(authSession.clearLocalSession).not.toHaveBeenCalled();
});

test("복원 재시도가 성공하면 기존 흐름대로 인증 상태에 진입한다", async () => {
  const authSession = createAuthSessionCoordinator({
    error: new Error("network"),
    status: "retryableError",
  });
  const groupGateway = createGroupGateway();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        authSession={authSession}
        groupGateway={groupGateway}
        notificationGateway={createNotificationGateway()}
        deviceTokenProvider={createDeviceTokenProvider()}
      />
    );
  });
  await resolveAuthRestore(authSession);
  mountedRenderers.push(renderer!);

  // 재시도는 백엔드 복구를 가정해 인증 성공을 반환한다.
  authSession.restore.mockResolvedValueOnce({
    status: "authenticated",
    user: { id: 7, name: "복원 사용자" },
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "다시 시도" })
      .props.onPress();
    await flushAsyncWork();
  });

  expect(authSession.restore).toHaveBeenCalledTimes(2);
  // 그룹이 없는 복원 사용자는 A-10 환영 화면으로 진입한다.
  expect(
    renderer!.root.findByProps({
      children: "복원 사용자 님,\n안녕하세요",
    })
  ).toBeTruthy();
});

test("authInvalidated 신호가 오면 사용자 상태를 비우고 A-1로 전환한다", async () => {
  const authSession = createAuthSessionCoordinator({
    status: "authenticated",
    user: { id: 7, name: "복원 사용자" },
  });
  const { renderer } = await renderApp(createAuthGateway(), authSession);

  await TestRenderer.act(() => {
    authSession.emitInvalidated();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({
      children: "복원 사용자 님,\n안녕하세요",
    })
  ).toHaveLength(0);
});

test("서버 로그아웃 실패에도 로컬 세션과 앱 인증 상태를 지운다", async () => {
  const authGateway = createAuthGateway();
  const serverFailure = new Error("server logout failed");
  authGateway.logout.mockRejectedValueOnce(serverFailure);
  const { authSession, renderer } = await renderApp(authGateway);
  await openLogin(renderer);
  await enterValidCredentials(renderer);
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "로그인" })
      .props.onPress();
  });

  let returnedFailure: unknown;
  await TestRenderer.act(async () => {
    try {
      await renderer.root.findByType(SignedInWelcomeScreen).props.onLogout();
    } catch (error) {
      returnedFailure = error;
    }
  });

  expect(returnedFailure).toBe(serverFailure);
  expect(authSession.clearLocalSession).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })
  ).toBeTruthy();
});

test("앱 셸에 참여 중인 그룹이 없으면 빈 상태를 표시한다", async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App initialRootRoute="appShell" groups={[]} />
    );
  });

  expect(
    renderer!.root.findByProps({
      children: "참여 중인 그룹이 없어요",
    })
  ).toBeTruthy();

  mountedRenderers.push(renderer!);
});

test("앱 셸을 명시하면 개발 그룹과 하단 탭을 표시한다", async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(<App initialRootRoute="appShell" />);
  });

  expect(
    renderer!.root.findByProps({
      children: "우리 가족의 이야기",
    })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityRole: "tablist" })
  ).toBeTruthy();

  mountedRenderers.push(renderer!);
});

test("새 게시글 작성 버튼은 피드에서만 플로팅 버튼으로 표시한다", async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(<App initialRootRoute="appShell" />);
  });
  mountedRenderers.push(renderer!);

  expect(
    renderer!.root.findByProps({ accessibilityLabel: "새 게시글 작성" })
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "일정 탭" })
      .props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: "새 게시글 작성" })
  ).toHaveLength(0);
});

test("앱 셸 진입 시 알림 미읽음 개수를 벨 배지에 표시한다", async () => {
  const notificationGateway = createNotificationGateway();
  notificationGateway.getUnreadCount.mockResolvedValue(4);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        initialRootRoute="appShell"
        notificationGateway={notificationGateway}
      />
    );
    await flushAsyncWork();
  });
  mountedRenderers.push(renderer!);

  expect(notificationGateway.getUnreadCount).toHaveBeenCalledTimes(1);
  expect(
    renderer!.root.findAllByProps({ children: 4 }).length
  ).toBeGreaterThan(0);
});

test("활성 탭을 다시 누르면 화면을 재마운트해 최신 데이터를 다시 조회한다", async () => {
  const mountLog: number[] = [];
  function FeedProbe() {
    React.useEffect(() => {
      mountLog.push(1);
    }, []);
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        initialRootRoute="appShell"
        screens={{ feed: FeedProbe }}
      />
    );
  });
  mountedRenderers.push(renderer!);

  expect(mountLog).toHaveLength(1);

  // 이미 활성인 피드 탭을 다시 누르면 화면이 재마운트되어 조회가 다시 실행된다.
  await TestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityLabel: "피드 탭" }).props.onPress();
  });

  expect(mountLog).toHaveLength(2);
});

test("피드에 진입하거나 피드를 다시 누르면 미읽음 배지를 다시 조회한다", async () => {
  const notificationGateway = createNotificationGateway();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        initialRootRoute="appShell"
        notificationGateway={notificationGateway}
        screens={{}}
      />
    );
    await flushAsyncWork();
  });
  mountedRenderers.push(renderer!);

  expect(notificationGateway.getUnreadCount).toHaveBeenCalledTimes(1);

  // 배지는 피드 헤더에서만 쓰므로 다른 탭 진입에는 재조회하지 않는다.
  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "그룹정보 탭" })
      .props.onPress();
    await flushAsyncWork();
  });
  expect(notificationGateway.getUnreadCount).toHaveBeenCalledTimes(1);

  // 피드로 돌아오면 최신 미읽음 수를 다시 조회한다.
  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "피드 탭" })
      .props.onPress();
    await flushAsyncWork();
  });
  expect(notificationGateway.getUnreadCount).toHaveBeenCalledTimes(2);

  // 피드 탭을 다시 눌러도 재조회한다.
  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "피드 탭" })
      .props.onPress();
    await flushAsyncWork();
  });
  expect(notificationGateway.getUnreadCount).toHaveBeenCalledTimes(3);
});

test("아카이브 화면에서 피드 탭을 누르면 재탭이 아니라 피드로 복귀한다", async () => {
  // 재탭이면 셸이 pop:true 중첩 params를 함께 dispatch해 스택 루트로 정규화한다.
  // 아카이브는 피드 탭 위에 쌓인 하위 화면이므로 재탭이 아닌 일반 이동이어야 한다.
  function FeedProbe() {
    const route = useRoute();
    const nested = route.params as { pop?: boolean } | undefined;
    return <Text>{`feed:${String(nested?.pop ?? "none")}`}</Text>;
  }
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        initialRootRoute="appShell"
        screens={{ archive: () => <Text>screen:archive</Text>, feed: FeedProbe }}
      />
    );
  });
  mountedRenderers.push(renderer!);

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "게시글 보관함" })
      .props.onPress();
  });
  expect(
    renderer!.root.findAllByProps({ children: "screen:archive" }).length,
  ).toBeGreaterThan(0);

  await TestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityLabel: "피드 탭" }).props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({ children: "screen:archive" }),
  ).toHaveLength(0);
  expect(
    renderer!.root.findAllByProps({ children: "feed:none" }).length,
  ).toBeGreaterThan(0);
});

test("AI 전화 탭은 다시 눌러도 재마운트하지 않는다", async () => {
  const mountLog: number[] = [];
  function AiCallProbe({ onHeaderVisibilityChange }: AppScreenProps) {
    React.useEffect(() => {
      mountLog.push(1);
      onHeaderVisibilityChange?.(false);
      return () => onHeaderVisibilityChange?.(true);
    }, [onHeaderVisibilityChange]);
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        groups={[
          { id: "cr-group", name: "우리 가족", role: "careReceiver" },
        ]}
        initialGroupId="cr-group"
        initialRootRoute="appShell"
        initialShellRoute="aiCall"
        screens={{ aiCall: AiCallProbe }}
      />
    );
  });
  mountedRenderers.push(renderer!);

  expect(mountLog).toHaveLength(1);
  expect(
    renderer!.root.findAllByProps({ testID: "app-shell-header" }),
  ).toHaveLength(0);

  // 통화 선택 상태를 잃지 않도록 AI 전화는 재탭 새로고침에서 제외한다.
  await TestRenderer.act(() => {
    const aiCallTab = renderer!.root.findByProps({
      accessibilityLabel: "AI 전화 탭",
    });
    aiCallTab.props.onPress();
    aiCallTab.props.onPress();
    aiCallTab.props.onPress();
  });

  expect(mountLog).toHaveLength(1);
  expect(
    renderer!.root.findAllByProps({ testID: "app-shell-header" }),
  ).toHaveLength(0);
});

// 캘린더 탭 route의 중첩 params(CalendarStack) 계약을 텍스트로 렌더하는 프로브.
// 셸의 navigateInCalendarTab이 전달하는 screen과 mode·openEventId를 단언한다.
function CalendarTabParamsProbe() {
  const route = useRoute();
  const nested = route.params as
    | { params?: { mode?: string; openEventId?: string }; screen?: string }
    | undefined;
  return (
    <Text>
      {`screen:calendar:${nested?.screen ?? "none"}:${nested?.params?.mode ?? nested?.params?.openEventId ?? "none"}`}
    </Text>
  );
}

test("캘린더 헤더는 일정 추가 버튼과 그룹 전환만 표시한다", async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        initialRootRoute="appShell"
        initialShellRoute="calendar"
        screens={{
          calendar: () => <CalendarTabParamsProbe />,
        }}
      />
    );
  });
  mountedRenderers.push(renderer!);

  const addButton = renderer!.root.findByProps({
    accessibilityLabel: "일정 추가",
  });
  expect(
    renderer!.root.findByProps({
      accessibilityHint: "다른 가족 그룹으로 전환합니다",
    })
  ).toBeTruthy();
  const header = renderer!.root.findByProps({ testID: "app-shell-header" });
  const headerActionOrder = header
    .findAll(
      (node) =>
        node.props.accessibilityLabel === "일정 추가" ||
        node.props.accessibilityHint === "다른 가족 그룹으로 전환합니다"
    )
    .map((node) =>
      node.props.accessibilityHint === "다른 가족 그룹으로 전환합니다"
        ? "group"
        : "add"
    );
  // 그룹 전환기는 중앙 절대배치라(S15P11B104-265) DOM 순서가 시각 순서를
  // 반영하지 않는다. 두 동작만 존재하는지 집합으로 단언한다.
  expect(new Set(headerActionOrder)).toEqual(new Set(["add", "group"]));
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: "오늘 일정 보기" })
  ).toHaveLength(0);

  await TestRenderer.act(() => {
    addButton.props.onPress();
  });

  // 일정 추가 버튼은 캘린더 스택의 편집 화면으로 중첩 navigate한다.
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    "screen:calendar:CalendarEventForm:create"
  );
});

test("보호자 리포트 탭에 리포트 화면을 연결한다", async () => {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        groups={[
          {
            id: "guardian-group",
            name: "우리 가족",
            role: "guardian",
          },
        ]}
        initialGroupId="guardian-group"
        initialRootRoute="appShell"
        initialShellRoute="report"
        reportTargetsByGroup={{ "guardian-group": [] }}
      />
    );
  });

  expect(renderer!.root.findByType(ReportScreen)).toBeTruthy();
  mountedRenderers.push(renderer!);
});

test("앱에 주입한 리포트 Gateway와 현재 그룹 피보호자를 조회한다", async () => {
  const reportGateway: jest.Mocked<ReportGateway> = {
    getCallReport: jest.fn(),
    getCallReportStatus: jest.fn(),
    getDailyReport: jest.fn().mockResolvedValue({
      calls: [],
      dailyReport: {
        emotionCategory: "JOY",
        emotionSubcategory: "즐거움",
        guardianMessageSummary: null,
        id: "7",
        summary: "가족 이야기를 나누며 즐거워하셨어요.",
      },
      date: "2026-07-31",
      generationStatus: "ready",
    }),
    getReportDates: jest.fn().mockResolvedValue({
      latestReportDate: "2026-07-31",
      reportDates: ["2026-07-31"],
      yearMonth: "2026-07",
    }),
    requestDailyReportGeneration: jest.fn(),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        groups={[
          {
            id: "guardian-group",
            name: "우리 가족",
            role: "guardian",
          },
        ]}
        initialGroupId="guardian-group"
        initialRootRoute="appShell"
        initialShellRoute="report"
        reportGateway={reportGateway}
        reportTargetsByGroup={{
          "guardian-group": [{ displayName: "김말순", memberId: "12" }],
        }}
      />
    );
  });

  expect(reportGateway.getDailyReport).toHaveBeenCalledWith(
    "guardian-group",
    "12",
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    "가족 이야기를 나누며 즐거워하셨어요."
  );

  mountedRenderers.push(renderer!);
});

test("현재 그룹 구성원 API에서 피보호자만 리포트 조회 대상으로 연결한다", async () => {
  const groupMemberGateway: jest.Mocked<GroupMemberGateway> = {
    loadMemberProfile: jest.fn(),
    loadMembers: jest.fn().mockResolvedValue([
      {
        age: null,
        alias: "말순 할머니",
        avatarText: "김",
        gender: null,
        isManager: false,
        memberId: "12",
        name: "김말순",
        role: "careReceiver",
        userId: "112",
      },
      {
        age: null,
        alias: null,
        avatarText: "박",
        gender: null,
        isManager: true,
        memberId: "13",
        name: "박민수",
        role: "guardian",
        userId: "113",
      },
    ]),
    updateMemberAlias: jest.fn(),
    updateMemberRole: jest.fn(),
  };
  const reportGateway: jest.Mocked<ReportGateway> = {
    getCallReport: jest.fn(),
    getCallReportStatus: jest.fn(),
    getDailyReport: jest.fn().mockResolvedValue({
      calls: [],
      dailyReport: null,
      date: "2026-08-01",
      generationStatus: "notReady",
    }),
    getReportDates: jest.fn().mockResolvedValue({
      latestReportDate: null,
      reportDates: [],
      yearMonth: "2026-08",
    }),
    requestDailyReportGeneration: jest.fn(),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        groupMemberGateway={groupMemberGateway}
        groups={[
          {
            id: "guardian-group",
            name: "우리 가족",
            role: "guardian",
          },
        ]}
        initialGroupId="guardian-group"
        initialRootRoute="appShell"
        initialShellRoute="report"
        reportGateway={reportGateway}
      />
    );
  });

  expect(groupMemberGateway.loadMembers).toHaveBeenCalledWith("guardian-group");
  expect(reportGateway.getDailyReport).toHaveBeenCalledWith(
    "guardian-group",
    "12",
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
  );
  expect(reportGateway.getDailyReport).not.toHaveBeenCalledWith(
    "guardian-group",
    "13",
    expect.any(String)
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain("말순 할머니");

  mountedRenderers.push(renderer!);
});

test("그룹 선택 바텀시트에서 빈 피드 그룹으로 전환한다", async () => {
  jest.useFakeTimers();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<App initialRootRoute="appShell" />);
    jest.runOnlyPendingTimers();
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityHint: "다른 가족 그룹으로 전환합니다" })
      .props.onPress();
    jest.runOnlyPendingTimers();
  });

  expect(renderer!.root.findByProps({ children: "그룹 선택" })).toBeTruthy();

  const emptyGroupOption = renderer!.root
    .findAllByProps({ accessibilityRole: "menuitem" })
    .find(
      (option) =>
        option.findAllByProps({ children: "외갓집 식구들" }).length > 0
    );

  expect(emptyGroupOption).toBeTruthy();

  await TestRenderer.act(async () => {
    emptyGroupOption!.props.onPress();
    jest.runOnlyPendingTimers();
  });

  expect(
    renderer!.root.findByProps({ accessibilityLabel: "게시물이 없는 피드" })
  ).toBeTruthy();

  mountedRenderers.push(renderer!);
  jest.useRealTimers();
});

// OS 푸시 알림 탭 2단 해석: 탭 → 앱 셸 진입 후 알림 목록에서 알림을 찾아 목적지로 이동한다.

function createNotificationTapProvider(tap: {
  notificationId: string;
  type?: string;
} | null) {
  return {
    consumePendingTap: jest.fn().mockResolvedValue(tap),
    subscribeTap: jest.fn().mockReturnValue(() => {}),
  };
}

async function renderAppWithPendingTap(options: {
  notificationGateway: jest.Mocked<NotificationGateway>;
  screens: Record<string, (props: AppScreenProps) => React.ReactNode>;
  tap: { notificationId: string; type?: string };
}) {
  const groupGateway = createGroupGateway();
  groupGateway.loadGroups.mockResolvedValueOnce({
    groups: [
      {
        id: "101",
        isManager: true,
        memberCount: 2,
        myMemberId: "201",
        name: "서버 가족",
        role: "guardian",
      },
    ],
    joinRequests: [],
  });
  const tapProvider = createNotificationTapProvider(options.tap);
  // 세션 복원 경로를 쓴다. 미인증(signedOut) 복원은 clearAuthenticationState가
  // 이전 사용자의 보류 탭을 비우므로 콜드 스타트 푸시 탭 시나리오와 다르다.
  const authSession = createAuthSessionCoordinator({
    status: "authenticated",
    user: { id: 7, name: "복원 사용자" },
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <App
        authGateway={createAuthGateway()}
        authSession={authSession}
        groupGateway={groupGateway}
        notificationGateway={options.notificationGateway}
        notificationTapProvider={tapProvider}
        screens={options.screens}
      />
    );
  });
  await resolveAuthRestore(authSession);
  mountedRenderers.push(renderer!);
  await TestRenderer.act(async () => {});
  await TestRenderer.act(async () => {});

  return { renderer: renderer!, tapProvider };
}

test("푸시 탭은 앱 셸 진입 후 알림을 해석해 목적지로 이동하고 읽음 처리한다", async () => {
  const notificationGateway = createNotificationGateway();
  notificationGateway.loadPage.mockResolvedValue({
    hasNext: false,
    notifications: [
      {
        avatarText: "알",
        body: "일정이 변경됐어요.",
        createdAtLabel: "방금",
        groupId: "101",
        id: "77",
        isRead: false,
        relatedEventId: "9",
        relatedJoinRequestStatus: null,
        title: "일정 변경",
        type: "EVENT_CHANGED",
      },
    ],
  });

  const { renderer, tapProvider } = await renderAppWithPendingTap({
    notificationGateway,
    screens: {
      calendar: () => <CalendarTabParamsProbe />,
    },
    tap: { notificationId: "77", type: "EVENT_CHANGED" },
  });

  expect(tapProvider.consumePendingTap).toHaveBeenCalled();
  expect(notificationGateway.loadPage).toHaveBeenCalledWith(0);
  expect(notificationGateway.markRead).toHaveBeenCalledWith("77");
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "screen:calendar:CalendarHome:9"
  );
});

test("푸시 탭의 알림을 첫 페이지에서 찾지 못하면 알림 목록으로 폴백한다", async () => {
  const notificationGateway = createNotificationGateway();
  notificationGateway.loadPage.mockResolvedValue({
    hasNext: false,
    notifications: [],
  });

  const { renderer } = await renderAppWithPendingTap({
    notificationGateway,
    screens: {
      notifications: () => <Text>screen:notifications</Text>,
    },
    tap: { notificationId: "404", type: "NEW_POST" },
  });

  expect(notificationGateway.markRead).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain("screen:notifications");
});
