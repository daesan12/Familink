import React from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Alert, Modal, Text } from "react-native";
import TestRenderer from "react-test-renderer";

import { mockHardwareBack } from "../../../shared/testing/hardwareBack";
import { CalendarEventDetailModal } from "../components/CalendarEventDetailModal";
import { CalendarEventsSheet } from "../components/CalendarEventsSheet";
import type { CalendarStackParamList } from "../navigationTypes";
import type { CalendarGateway } from "../types";
import { CalendarScreen } from "./CalendarScreen";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");
jest.mock("react-native-safe-area-context", () => {
  const mockReact = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };

  return {
    // CalendarStack(native-stack)의 SafeAreaProviderCompat이 이 컨텍스트를 구독한다.
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    initialWindowMetrics: null,
    useSafeAreaInsets: () => insets,
  };
});

// CalendarScreen이 내부에 CalendarStack 내비게이터를 렌더하므로 컨테이너가 필요하다.
function withNav(element: React.ReactElement) {
  return <NavigationContainer>{element}</NavigationContainer>;
}

// 셸의 캘린더 탭처럼 부모 route params(initial·params·screen)로 내부 스택을
// 콜드 마운트하는 하네스. 마운트 첫 커밋부터 params가 존재하는 경로를 재현한다.
const TabHarnessStack = createNativeStackNavigator();

function withCalendarTabRoute(
  element: React.ReactElement,
  initialParams: {
    initial: boolean;
    params: Record<string, unknown>;
    screen: string;
  }
) {
  return (
    <NavigationContainer>
      <TabHarnessStack.Navigator screenOptions={{ headerShown: false }}>
        <TabHarnessStack.Screen initialParams={initialParams} name="calendar">
          {() => element}
        </TabHarnessStack.Screen>
      </TabHarnessStack.Navigator>
    </NavigationContainer>
  );
}

jest.mock("@react-native-community/datetimepicker", () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.setTimeout(10_000);

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
  });
  jest.restoreAllMocks();
});

function createGateway(): jest.Mocked<CalendarGateway> {
  return {
    createEvent: jest.fn().mockResolvedValue("15"),
    deleteEvent: jest.fn().mockResolvedValue(undefined),
    getEvent: jest.fn().mockResolvedValue({
      creatorDisplayName: "이종철",
      creatorMemberId: "7",
      description: "수호 할아버지 데리고 예약한 정형외과 가야 함",
      endAt: "2026-07-17T07:00:00Z",
      endDate: "2026-07-17",
      eventDate: "2026-07-17",
      groupId: "3",
      id: "12",
      participantMemberIds: ["8"],
      startAt: "2026-07-17T06:00:00Z",
      title: "홍박사 정형외과",
    }),
    listEvents: jest.fn().mockResolvedValue([
      {
        endAt: "2026-07-17T07:00:00Z",
        endDate: "2026-07-17",
        eventDate: "2026-07-17",
        id: "12",
        startAt: "2026-07-17T06:00:00Z",
        title: "홍박사 정형외과",
      },
      {
        endAt: null,
        endDate: "2026-07-20",
        eventDate: "2026-07-15",
        id: "13",
        startAt: null,
        title: "가족 여행",
      },
    ]),
    listMembers: jest.fn().mockResolvedValue([
      {
        displayName: "이종철",
        isManager: true,
        memberId: "7",
        profileImageUrl: null,
        role: "careReceiver",
        userId: "70",
      },
      {
        displayName: "홍유라",
        isManager: false,
        memberId: "8",
        profileImageUrl: "https://example.com/yura.png",
        role: "guardian",
        userId: "80",
      },
    ]),
    updateEvent: jest.fn().mockResolvedValue(undefined),
  };
}

const baseProps = {
  currentGroup: { id: "3", name: "우리 가족", role: "guardian" } as const,
  currentUserId: 70,
  currentUserName: "이종철",
  initialDateKey: "2026-07-31",
  now: new Date("2026-07-31T03:00:00Z"),
  role: "guardian" as const,
};

async function renderCalendar(
  gateway = createGateway(),
  props: Partial<React.ComponentProps<typeof CalendarScreen>> = {}
) {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(<CalendarScreen {...baseProps} {...props} gateway={gateway} />)
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);
  return { gateway, renderer: renderer! };
}

async function openEventDetail(renderer: TestRenderer.ReactTestRenderer) {
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "2026년 7월 17일" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({
        accessibilityLabel: "홍박사 정형외과, 15:00 - 16:00",
      })
      .props.onPress();
    await Promise.resolve();
  });
}

test("실제 조회 구간으로 일정을 불러와 7개 요일과 기간 막대를 표시한다", async () => {
  const { gateway, renderer } = await renderCalendar();

  expect(gateway.listEvents).toHaveBeenCalledWith(
    expect.objectContaining({
      endDate: "2026-08-08",
      groupId: "3",
      startDate: "2026-06-28",
    })
  );
  expect(renderer.root.findByProps({ children: "2026년 7월" })).toBeTruthy();
  expect(
    renderer.root
      .findAllByType(Text)
      .filter((node) =>
        ["일", "월", "화", "수", "목", "금", "토"].includes(
          String(node.props.children)
        )
      )
  ).toHaveLength(7);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: "가족 여행 일정",
    }).length
  ).toBeGreaterThan(1);
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 7월 17일",
    }).props.accessibilityValue
  ).toEqual({ text: "일정 있음" });
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 7월 31일",
    }).props.accessibilityValue
  ).toEqual({ text: "일정 없음" });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "이전 달" })
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "다음 달" })
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: "오늘 일정 보기",
    })
  ).toHaveLength(0);
});

test("알림 딥링크로 이벤트 상세를 열고 닫으면 이벤트 날짜 시트를 표시한다", async () => {
  const navRef = createNavigationContainerRef<CalendarStackParamList>();
  const gateway = createGateway();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <CalendarScreen {...baseProps} gateway={gateway} />
      </NavigationContainer>
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  // 셸의 중첩 navigate가 도달하는 것과 같은 경로로 CalendarHome params를 전달한다.
  await TestRenderer.act(async () => {
    navRef.navigate("CalendarHome", { openEventId: "12" });
    await Promise.resolve();
  });

  expect(gateway.getEvent).toHaveBeenCalledWith("12", expect.anything());
  const detailModal = renderer!.root.findByType(CalendarEventDetailModal);
  expect(detailModal.props.visible).toBe(true);
  expect(detailModal.props.detail).toMatchObject({ id: "12" });

  // 상세를 닫으면 선택 날짜가 이벤트 날짜로 동기화된 시트가 열린다.
  await TestRenderer.act(async () => {
    detailModal.props.onClose();
  });
  const sheet = renderer!.root.findByType(CalendarEventsSheet);
  expect(sheet.props.visible).toBe(true);
  expect(sheet.props.dateKey).toBe("2026-07-17");

  // 소비 직후 params를 비워 두므로 같은 알림을 다시 탭해도 재발화한다.
  await TestRenderer.act(async () => {
    navRef.navigate("CalendarHome", { openEventId: "12" });
    await Promise.resolve();
  });
  expect(gateway.getEvent).toHaveBeenCalledTimes(2);
});

test("캘린더가 마운트되지 않았던 딥링크도 콜드 마운트 직후 상세를 연다", async () => {
  const gateway = createGateway();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withCalendarTabRoute(
        <CalendarScreen {...baseProps} gateway={gateway} />,
        {
          initial: false,
          params: { openEventId: "12" },
          screen: "CalendarHome",
        }
      )
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);
  await TestRenderer.act(async () => {});

  // 마운트 커밋의 그룹 리셋 effect가 딥링크 상세 로드를 abort하면 안 된다.
  expect(gateway.getEvent).toHaveBeenCalledWith("12", expect.anything());
  const detailModal = renderer!.root.findByType(CalendarEventDetailModal);
  expect(detailModal.props.visible).toBe(true);
  expect(detailModal.props.detail).toMatchObject({ id: "12" });
});

test("재수화로 초기값 스태시가 사라진 수정 폼은 홈으로 되돌린다", async () => {
  const gateway = createGateway();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withCalendarTabRoute(
        <CalendarScreen {...baseProps} gateway={gateway} />,
        {
          initial: false,
          params: { eventId: "12", mode: "edit" },
          screen: "CalendarEventForm",
        }
      )
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);
  await TestRenderer.act(async () => {});

  // 수정 폼이 신규 작성으로 둔갑해 저장되지 않도록 폼 대신 홈을 보여준다.
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: "일정 제목" })
  ).toHaveLength(0);
  expect(renderer!.root.findByProps({ children: "2026년 7월" })).toBeTruthy();
});

test("그룹이 바뀌면 열려 있던 편집 화면을 홈으로 되돌린다", async () => {
  const gateway = createGateway();
  const { renderer } = await renderCalendar(gateway);

  await openEventDetail(renderer);
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 수정" })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: "일정 제목" })
  ).toBeTruthy();

  await TestRenderer.act(async () => {
    renderer.update(
      withNav(
        <CalendarScreen
          {...baseProps}
          currentGroup={{
            id: "4",
            name: "외갓집 식구들",
            role: "guardian",
          }}
          gateway={gateway}
        />
      )
    );
    await Promise.resolve();
  });

  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "일정 제목" })
  ).toHaveLength(0);
  expect(renderer.root.findByProps({ children: "2026년 7월" })).toBeTruthy();
});

test("날짜 바텀시트에서 일정을 열고 작성자·참여자 상세를 표시한다", async () => {
  const { gateway, renderer } = await renderCalendar();

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "2026년 7월 17일" })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({
      children: "2026년 7월 17일 금요일",
    })
  ).toBeTruthy();
  const eventRow = renderer.root.findByProps({
    accessibilityLabel: "홍박사 정형외과, 15:00 - 16:00",
  });

  await TestRenderer.act(async () => {
    eventRow.props.onPress();
    await Promise.resolve();
  });

  expect(gateway.getEvent).toHaveBeenCalledWith("12", expect.anything());
  expect(
    renderer.root.findByProps({
      children: "수호 할아버지 데리고 예약한 정형외과 가야 함",
    })
  ).toBeTruthy();
  expect(renderer.root.findByProps({ children: "이종철" })).toBeTruthy();
  expect(renderer.root.findByProps({ children: "홍유라" })).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "이종철 프로필 사진",
    })
  ).toBeTruthy();
});

test("그룹을 나간 작성자도 서버가 준 이름으로 표시한다", async () => {
  const gateway = createGateway();
  gateway.getEvent.mockResolvedValueOnce({
    creatorDisplayName: "이종철",
    // 활성 구성원 목록에 없는 멤버십이다. 작성자가 그룹을 나간 상황을 재현한다.
    creatorMemberId: "36",
    description: "",
    endAt: "2026-07-17T07:00:00Z",
    endDate: "2026-07-17",
    eventDate: "2026-07-17",
    groupId: "3",
    id: "12",
    participantMemberIds: ["8"],
    startAt: "2026-07-17T06:00:00Z",
    title: "홍박사 정형외과",
  });
  const {renderer} = await renderCalendar(gateway);

  await openEventDetail(renderer);

  expect(renderer.root.findByProps({children: "이종철"})).toBeTruthy();
  expect(renderer.root.findAllByProps({children: "구성원 36"})).toHaveLength(0);
});

test("작성자 이름을 주지 않는 구버전 서버에서는 구성원 목록으로 이름을 채운다", async () => {
  const gateway = createGateway();
  gateway.getEvent.mockResolvedValueOnce({
    creatorDisplayName: null,
    creatorMemberId: "7",
    description: "",
    endAt: "2026-07-17T07:00:00Z",
    endDate: "2026-07-17",
    eventDate: "2026-07-17",
    groupId: "3",
    id: "12",
    participantMemberIds: ["8"],
    startAt: "2026-07-17T06:00:00Z",
    title: "홍박사 정형외과",
  });
  const {renderer} = await renderCalendar(gateway);

  await openEventDetail(renderer);

  expect(renderer.root.findByProps({children: "이종철"})).toBeTruthy();
  expect(renderer.root.findAllByProps({children: "구성원 7"})).toHaveLength(0);
});

test("활성 구성원에서 사라진 참여자 태그와 편집 선택값을 제거한다", async () => {
  const gateway = createGateway();
  gateway.getEvent.mockResolvedValueOnce({
    creatorDisplayName: "이종철",
    creatorMemberId: "7",
    description: "",
    endAt: "2026-07-17T07:00:00Z",
    endDate: "2026-07-17",
    eventDate: "2026-07-17",
    groupId: "3",
    id: "12",
    participantMemberIds: ["8", "36"],
    startAt: "2026-07-17T06:00:00Z",
    title: "홍박사 정형외과",
  });
  const { renderer } = await renderCalendar(gateway);

  await openEventDetail(renderer);

  expect(renderer.root.findByProps({ children: "홍유라" })).toBeTruthy();
  expect(renderer.root.findAllByProps({ children: "구성원 36" })).toHaveLength(
    0
  );

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 수정" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 저장" })
      .props.onPress();
    await Promise.resolve();
  });

  expect(gateway.updateEvent).toHaveBeenCalledWith(
    "12",
    expect.objectContaining({ participantMemberIds: ["8"] })
  );
});

test("상세에서 기존 값으로 수정한 뒤 확인 후 일정을 삭제한다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const gateway = createGateway();
  const { renderer } = await renderCalendar(gateway);

  await openEventDetail(renderer);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 수정" })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: "일정 제목" }).props.value
  ).toBe("홍박사 정형외과");

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 저장" })
      .props.onPress();
    await Promise.resolve();
  });
  expect(gateway.updateEvent).toHaveBeenCalledWith(
    "12",
    expect.objectContaining({ title: "홍박사 정형외과" })
  );

  await openEventDetail(renderer);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 삭제" })
      .props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    "일정을 삭제할까요?",
    "삭제한 일정은 다시 복구할 수 없어요.",
    expect.any(Array)
  );
  const buttons = alertSpy.mock.calls[0]?.[2] ?? [];
  const deleteButton = buttons.find((button) => button.style === "destructive");

  await TestRenderer.act(async () => {
    deleteButton?.onPress?.();
    await Promise.resolve();
  });

  expect(gateway.deleteEvent).toHaveBeenCalledWith("12", expect.anything());
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: "홍박사 정형외과, 15:00 - 16:00",
    })
  ).toHaveLength(0);
  // 삭제 성공 시 상세만 닫고 선택 날짜 목록으로 복귀한다(UI 스펙 규칙 9).
  expect(detailVisible(renderer)).toBe(false);
  expect(sheetVisible(renderer)).toBe(true);
});

function sheetVisible(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByType(CalendarEventsSheet).props.visible;
}

function detailVisible(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByType(CalendarEventDetailModal).props.visible;
}

test("상세를 여닫는 동안 팝업은 한 번에 하나만 표시된다", async () => {
  const gateway = createGateway();
  const { renderer } = await renderCalendar(gateway);

  await openEventDetail(renderer);

  // 상세가 열리면 시트는 닫혀 native 팝업이 겹겹이 쌓이지 않는다(F-16).
  expect(detailVisible(renderer)).toBe(true);
  expect(sheetVisible(renderer)).toBe(false);

  await TestRenderer.act(async () => {
    renderer.root.findByType(CalendarEventDetailModal).props.onClose();
  });

  // 상세를 닫으면 선택 날짜 목록으로 복귀한다.
  expect(detailVisible(renderer)).toBe(false);
  expect(sheetVisible(renderer)).toBe(true);
});

test("일정 수정 저장 후에는 상세 팝업 없이 시트만 열린다", async () => {
  const gateway = createGateway();
  const { renderer } = await renderCalendar(gateway);

  await openEventDetail(renderer);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 수정" })
      .props.onPress();
  });

  // 편집 화면이 열리는 동안 시트·상세 팝업은 마운트를 유지한 채 모두 닫힌다.
  expect(
    renderer.root.findByProps({ accessibilityLabel: "일정 제목" })
  ).toBeTruthy();
  const modals = renderer.root.findAllByType(Modal);
  expect(modals.length).toBeGreaterThanOrEqual(2);
  expect(modals.every((modal) => modal.props.visible === false)).toBe(true);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 저장" })
      .props.onPress();
    await Promise.resolve();
  });

  // 저장 직후 상세는 닫힌 채 시트만 열린다(F-16 재현 시점).
  expect(detailVisible(renderer)).toBe(false);
  expect(sheetVisible(renderer)).toBe(true);
  const visibleModals = renderer.root
    .findAllByType(Modal)
    .filter((modal) => modal.props.visible === true);
  expect(visibleModals).toHaveLength(1);
});

test("편집 화면의 취소는 스택을 되돌려 캘린더 홈으로 복귀한다", async () => {
  const gateway = createGateway();
  const { renderer } = await renderCalendar(gateway);

  await openEventDetail(renderer);
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 수정" })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: "일정 제목" })
  ).toBeTruthy();

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 작성 취소" })
      .props.onPress();
    await Promise.resolve();
  });

  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "일정 제목" })
  ).toHaveLength(0);
  expect(renderer.root.findByProps({ children: "2026년 7월" })).toBeTruthy();
});

test("저장 중 하드웨어 뒤로가기는 편집 화면을 유지한다", async () => {
  // 컨테이너의 useBackButton이 mock에 등록되도록 렌더 전에 설치한다.
  const back = mockHardwareBack();
  try {
    const gateway = createGateway();
    let resolveUpdate: () => void = () => {};
    gateway.updateEvent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = () => resolve(undefined);
        })
    );
    const { renderer } = await renderCalendar(gateway);

    await openEventDetail(renderer);
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: "일정 수정" })
        .props.onPress();
    });
    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: "일정 저장" })
        .props.onPress();
    });

    await TestRenderer.act(async () => {
      back.press();
      await Promise.resolve();
    });
    // 저장 중에는 beforeRemove가 pop을 막아 편집 화면이 유지된다.
    expect(
      renderer.root.findByProps({ accessibilityLabel: "일정 제목" })
    ).toBeTruthy();

    await TestRenderer.act(async () => {
      resolveUpdate();
      await Promise.resolve();
    });
    // 저장이 끝나면 홈으로 복귀하고 시트가 열린다.
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: "일정 제목" })
    ).toHaveLength(0);
    expect(sheetVisible(renderer)).toBe(true);
  } finally {
    back.restore();
  }
});

test("상단 추가 요청은 선택 날짜의 시간 설정이 꺼진 새 폼을 연다", async () => {
  const navRef = createNavigationContainerRef<CalendarStackParamList>();
  const gateway = createGateway();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <CalendarScreen {...baseProps} gateway={gateway} />
      </NavigationContainer>
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  // 셸 헤더 FAB의 중첩 navigate가 도달하는 것과 같은 경로로 폼을 연다.
  await TestRenderer.act(async () => {
    navRef.navigate("CalendarEventForm", { mode: "create" });
    await Promise.resolve();
  });

  expect(renderer!.root.findByProps({ children: "새 일정" })).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityLabel: "시간 설정" }).props.value
  ).toBe(false);
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: "시작 날짜 2026년 7월 31일",
    })
  ).toBeTruthy();
});

test("일반 활성 구성원은 상세에서 수정할 수 있지만 삭제할 수 없다", async () => {
  const { renderer } = await renderCalendar(createGateway(), {
    currentUserId: 80,
  });

  await openEventDetail(renderer);

  expect(
    renderer.root.findByProps({ accessibilityLabel: "일정 수정" })
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "일정 삭제" })
  ).toHaveLength(0);
});

test("삭제 확인을 취소하면 요청하지 않고 상세를 유지한다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const gateway = createGateway();
  const { renderer } = await renderCalendar(gateway);

  await openEventDetail(renderer);
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 삭제" })
      .props.onPress();
  });
  const buttons = alertSpy.mock.calls[0]?.[2] ?? [];
  const cancelButton = buttons.find((button) => button.style === "cancel");

  await TestRenderer.act(async () => {
    cancelButton?.onPress?.();
  });

  expect(gateway.deleteEvent).not.toHaveBeenCalled();
  expect(
    renderer.root.findByProps({ accessibilityLabel: "일정 삭제" })
  ).toBeTruthy();
});

test("삭제 실패 시 상세와 일정을 유지하고 오류를 표시한다", async () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const gateway = createGateway();
  gateway.deleteEvent.mockRejectedValueOnce(new Error("삭제 요청 실패"));
  const { renderer } = await renderCalendar(gateway);

  await openEventDetail(renderer);
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 삭제" })
      .props.onPress();
  });
  const buttons = alertSpy.mock.calls[0]?.[2] ?? [];
  const deleteButton = buttons.find((button) => button.style === "destructive");

  await TestRenderer.act(async () => {
    deleteButton?.onPress?.();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({ children: "삭제 요청 실패" })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: "일정 삭제" }).props
      .disabled
  ).toBe(false);
});

test("그룹이 바뀌면 열린 상세를 닫고 새 그룹 일정과 구성원을 조회한다", async () => {
  const { gateway, renderer } = await renderCalendar();

  await TestRenderer.act(async () => {
    renderer.update(
      withNav(
        <CalendarScreen
          {...baseProps}
          currentGroup={{
            id: "4",
            name: "외갓집 식구들",
            role: "guardian",
          }}
          gateway={gateway}
        />
      )
    );
    await Promise.resolve();
  });

  expect(gateway.listEvents).toHaveBeenLastCalledWith(
    expect.objectContaining({ groupId: "4" })
  );
  expect(gateway.listMembers).toHaveBeenLastCalledWith("4", expect.anything());
});

test("조회 실패 시 가짜 일정 대신 오류와 재시도 동작을 표시한다", async () => {
  const gateway = createGateway();
  gateway.listEvents.mockRejectedValueOnce(new Error("서버 연결 실패"));
  const { renderer } = await renderCalendar(gateway);

  expect(
    renderer.root.findByProps({ children: "일정을 불러오지 못했어요" })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ children: "서버 연결 실패" })
  ).toBeTruthy();

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 다시 시도" })
      .props.onPress();
    await Promise.resolve();
  });

  expect(gateway.listEvents).toHaveBeenCalledTimes(2);
});
