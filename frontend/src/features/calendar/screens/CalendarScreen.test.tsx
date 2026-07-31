import React from "react";
import { Alert, Text } from "react-native";
import TestRenderer from "react-test-renderer";

import type { CalendarGateway } from "../types";
import { CalendarScreen } from "./CalendarScreen";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
  });
  jest.restoreAllMocks();
});

function createGateway(): jest.Mocked<CalendarGateway> {
  return {
    deleteEvent: jest.fn().mockResolvedValue(undefined),
    getEvent: jest.fn().mockResolvedValue({
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
  };
}

const baseProps = {
  currentGroup: { id: "3", name: "우리 가족", role: "guardian" } as const,
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
      <CalendarScreen {...baseProps} {...props} gateway={gateway} />
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

test("상세에서 수정을 요청하고 확인 후 일정을 삭제한다", async () => {
  const onEditCalendarEvent = jest.fn();
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const gateway = createGateway();
  const { renderer } = await renderCalendar(gateway, {
    onEditCalendarEvent,
  });

  await openEventDetail(renderer);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일정 수정" })
      .props.onPress();
  });
  expect(onEditCalendarEvent).toHaveBeenCalledWith("12");

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
  const cancelButton = buttons.find(button => button.style === "cancel");

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
  const deleteButton = buttons.find(button => button.style === "destructive");

  await TestRenderer.act(async () => {
    deleteButton?.onPress?.();
    await Promise.resolve();
  });

  expect(renderer.root.findByProps({ children: "삭제 요청 실패" })).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: "일정 삭제" }).props.disabled
  ).toBe(false);
});

test("그룹이 바뀌면 열린 상세를 닫고 새 그룹 일정과 구성원을 조회한다", async () => {
  const { gateway, renderer } = await renderCalendar();

  await TestRenderer.act(async () => {
    renderer.update(
      <CalendarScreen
        {...baseProps}
        currentGroup={{
          id: "4",
          name: "외갓집 식구들",
          role: "guardian",
        }}
        gateway={gateway}
      />
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
