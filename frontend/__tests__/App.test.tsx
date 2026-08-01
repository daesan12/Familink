import React from "react";
import { AccessibilityInfo, Alert, Image } from "react-native";
import TestRenderer from "react-test-renderer";
import { clearAllMockStorages } from "@react-native-async-storage/async-storage/jest";

import App from "../App";
import { AppShell } from "../src/app-shell";
import { InvalidCredentialsError } from "../src/features/auth/api/mockAuthGateway";
import {
  type AuthRestoreResult,
  type AuthSessionCoordinator,
} from "../src/features/auth/session";
import { SignupFlowScreen } from "../src/features/auth/screens/SignupFlowScreen";
import { SignedInWelcomeScreen } from "../src/features/auth/screens/SignedInWelcomeScreen";
import type { AuthGateway } from "../src/features/auth/types";
import { ApiError } from "../src/shared/api";
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
import type { ProfileGateway } from "../src/features/profile";

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

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");

  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    }),
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
    renderer.root.findByType(SignupFlowScreen).props.onComplete();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: "로그인 시작" })
  ).toBeTruthy();
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

  expect(onCreateGroup).toHaveBeenCalledWith({
    name: "행복한 가족",
    role: "guardian",
  });
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

test("관심사 초기 조회 실패 시 기존 목록을 지우는 저장을 보내지 않는다", async () => {
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
    loadInterests: jest.fn().mockRejectedValue(new Error("network")),
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
  await TestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: "관심사 저장하고 다음" })
      .props.onPress();
  });

  expect(interestGateway.loadInterests).toHaveBeenCalledWith(
    "approved-care-group",
    "member-manager",
  );
  expect(interestGateway.replaceInterests).not.toHaveBeenCalled();
});

test("관심사 조회 중 화면을 나가면 늦은 실패 알림을 표시하지 않는다", async () => {
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
  let rejectLoad: (error: Error) => void = () => undefined;
  const pendingLoad = new Promise<never>((_, reject) => {
    rejectLoad = reject;
  });
  const interestGateway = {
    loadInterests: jest.fn().mockReturnValue(pendingLoad),
    replaceInterests: jest.fn().mockResolvedValue({
      memberId: "member-manager",
      interests: [],
    }),
  };
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
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
  });
  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "관심사 설정 건너뛰기" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    rejectLoad(new Error("network"));
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(alertSpy).not.toHaveBeenCalled();
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

  expect(onJoinGroup).toHaveBeenCalledWith("FA12BC");
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

  expect(groupGateway.requestJoinByCode).toHaveBeenCalledWith("AB12C3");
  expect(groupGateway.loadGroups).toHaveBeenCalled();
  expect(renderer!.root.findByProps({ children: "API 가족" })).toBeTruthy();
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

test("앱 셸에서 그룹 연결 화면을 열었다가 기존 앱 셸로 돌아온다", async () => {
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

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "A-10으로 돌아가기" })
      .props.onPress();
  });

  expect(renderer!.root.findByType(AppShell)).toBeTruthy();
  expect(
    renderer!.root.findByProps({ children: "참여 중인 그룹이 없어요" })
  ).toBeTruthy();
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

  expect(
    renderer!.root.findByProps({ children: "관심사를 선택해주세요" })
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: "관심사 설정 건너뛰기" })
      .props.onPress();
  });

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

test("재시도 가능한 복원 오류에서는 인증 화면을 선택하지 않는다", async () => {
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

  expect(renderer!.toJSON()).toBeNull();
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

test("캘린더 헤더는 일정 추가 버튼과 그룹 전환만 표시한다", async () => {
  let createCalendarEventRequestId = 0;
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <App
        initialRootRoute="appShell"
        initialShellRoute="calendar"
        screens={{
          calendar: (props) => {
            createCalendarEventRequestId =
              props.createCalendarEventRequestId ?? 0;
            return null;
          },
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
  expect([...new Set(headerActionOrder)]).toEqual(["group", "add"]);
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: "오늘 일정 보기" })
  ).toHaveLength(0);

  await TestRenderer.act(() => {
    addButton.props.onPress();
  });

  expect(createCalendarEventRequestId).toBe(1);
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
      status: "ready",
    }),
    getReportDates: jest.fn().mockResolvedValue({
      latestReportDate: "2026-07-31",
      reportDates: ["2026-07-31"],
      yearMonth: "2026-07",
    }),
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
    getDailyReport: jest.fn().mockResolvedValue({
      calls: [],
      dailyReport: null,
      date: "2026-08-01",
      status: "noCalls",
    }),
    getReportDates: jest.fn().mockResolvedValue({
      latestReportDate: null,
      reportDates: [],
      yearMonth: "2026-08",
    }),
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
