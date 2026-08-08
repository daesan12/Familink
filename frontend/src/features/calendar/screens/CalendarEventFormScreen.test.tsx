import React from "react";
import TestRenderer from "react-test-renderer";

import type { CalendarGateway, CalendarMember } from "../types";
import { CalendarEventFormScreen } from "./CalendarEventFormScreen";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");
jest.mock("react-native-safe-area-context", () => {
  const {View} = jest.requireActual("react-native");

  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock("@react-native-community/datetimepicker", () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));

const members: readonly CalendarMember[] = [
  {
    displayName: "이종철",
    isManager: true,
    memberId: "7",
    profileImageUrl: null,
    role: "guardian",
    userId: "70",
  },
  {
    displayName: "홍유라",
    isManager: false,
    memberId: "8",
    profileImageUrl: null,
    role: "guardian",
    userId: "80",
  },
];

function createGateway(): jest.Mocked<CalendarGateway> {
  return {
    createEvent: jest.fn().mockResolvedValue("15"),
    deleteEvent: jest.fn().mockResolvedValue(undefined),
    getEvent: jest.fn(),
    listEvents: jest.fn(),
    listMembers: jest.fn(),
    updateEvent: jest.fn().mockResolvedValue(undefined),
  };
}

test("제목·시간·참여자를 입력해 실제 생성 API 폼으로 저장한다", async () => {
  const gateway = createGateway();
  const onSaved = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarEventFormScreen
        gateway={gateway}
        groupId="3"
        initialDate="2026-07-31"
        members={members}
        now={new Date("2026-07-30T20:42:00Z")}
        onCancel={jest.fn()}
        onSaved={onSaved}
      />
    );
  });

  expect(renderer!.root.findAllByProps({ children: "작성자" })).toHaveLength(0);

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "일정 제목" })
      .props.onChangeText("정기 검진");
    renderer!.root
      .findByProps({ accessibilityLabel: "일정 세부 내용" })
      .props.onChangeText("수호 할아버지 병원");
    renderer!.root
      .findByProps({ accessibilityLabel: "시간 설정" })
      .props.onValueChange(true);
    renderer!.root
      .findByProps({ accessibilityLabel: "참여자 추가" })
      .props.onPress();
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "홍유라 참여자 선택" })
      .props.onPress();
    renderer!.root
      .findByProps({ accessibilityLabel: "참여자 선택 완료" })
      .props.onPress();
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "일정 저장" })
      .props.onPress();
    await Promise.resolve();
  });

  expect(gateway.createEvent).toHaveBeenCalledWith("3", {
    description: "수호 할아버지 병원",
    endAt: "2026-07-30T21:00:00.000Z",
    endDate: "2026-07-31",
    eventDate: "2026-07-31",
    participantMemberIds: ["8"],
    startAt: "2026-07-30T20:00:00.000Z",
    title: "정기 검진",
  });
  expect(onSaved).toHaveBeenCalledWith("15");

  TestRenderer.act(() => renderer!.unmount());
});

test("모두 선택으로 구성원 전원을 참여자로 등록해 저장한다", async () => {
  const gateway = createGateway();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarEventFormScreen
        gateway={gateway}
        groupId="3"
        initialDate="2026-07-31"
        members={members}
        now={new Date("2026-07-30T20:42:00Z")}
        onCancel={jest.fn()}
        onSaved={jest.fn()}
      />
    );
  });

  expect(
    renderer!.root.findAllByProps({
      children: "참여자를 선택하지 않으면 알림이 가지 않아요.",
    }).length
  ).toBeGreaterThan(0);

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "일정 제목" })
      .props.onChangeText("가족 모임");
    renderer!.root
      .findByProps({ accessibilityLabel: "참여자 추가" })
      .props.onPress();
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "참여자 모두 선택" })
      .props.onPress();
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "참여자 선택 완료" })
      .props.onPress();
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "일정 저장" })
      .props.onPress();
    await Promise.resolve();
  });

  expect(gateway.createEvent).toHaveBeenCalledWith(
    "3",
    expect.objectContaining({ participantMemberIds: ["7", "8"] })
  );

  TestRenderer.act(() => renderer!.unmount());
});

test("제목이 비어 있으면 API를 호출하지 않고 입력 오류를 표시한다", async () => {
  const gateway = createGateway();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarEventFormScreen
        gateway={gateway}
        groupId="3"
        initialDate="2026-07-31"
        members={members}
        onCancel={jest.fn()}
        onSaved={jest.fn()}
      />
    );
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "일정 저장" })
      .props.onPress();
  });

  expect(gateway.createEvent).not.toHaveBeenCalled();
  expect(
    renderer!.root.findByProps({ children: "일정 제목을 입력해 주세요." })
  ).toBeTruthy();

  TestRenderer.act(() => renderer!.unmount());
});

test("시간 버튼은 서비스 팝업을 열고 확인한 시간만 폼에 반영한다", async () => {
  const gateway = createGateway();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarEventFormScreen
        gateway={gateway}
        groupId="3"
        initialDate="2026-07-31"
        members={members}
        now={new Date("2026-07-30T20:42:00Z")}
        onCancel={jest.fn()}
        onSaved={jest.fn()}
      />
    );
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "시간 설정" })
      .props.onValueChange(true);
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "시작 시간 05:00" })
      .props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({ children: "시간 설정" }).length
  ).toBeGreaterThan(1);

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "05시 선택" })
      .props.onPress();
    scrollWheel(renderer!, "분 휠", 30);
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "시간 선택 확인" })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({ accessibilityLabel: "시작 시간 05:30" })
  ).toBeTruthy();
  TestRenderer.act(() => renderer!.unmount());
});

test("종료 시간이 시작 시간보다 빠르면 팝업에서 확인을 막는다", async () => {
  const gateway = createGateway();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarEventFormScreen
        gateway={gateway}
        groupId="3"
        initialDate="2026-07-31"
        members={members}
        now={new Date("2026-07-30T20:42:00Z")}
        onCancel={jest.fn()}
        onSaved={jest.fn()}
      />
    );
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "시간 설정" })
      .props.onValueChange(true);
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "종료 시간 06:00" })
      .props.onPress();
  });

  await TestRenderer.act(async () => {
    scrollWheel(renderer!, "시 휠", 3);
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "시간 선택 확인" })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({
      children: "종료 시간은 시작 시간보다 빠를 수 없어요.",
    })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityLabel: "종료 시간 06:00" })
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({ accessibilityLabel: "시간 선택 확인" })
  ).toBeTruthy();

  TestRenderer.act(() => renderer!.unmount());
});

test("수정 화면은 작성자를 표시하지 않고 기존 일정으로 저장한다", async () => {
  const gateway = createGateway();
  const onSaved = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarEventFormScreen
        gateway={gateway}
        groupId="3"
        initialDate="2026-07-31"
        initialDetail={{
          creatorDisplayName: "홍유라",
          creatorMemberId: "8",
          description: "수호 할아버지 병원",
          endAt: null,
          endDate: "2026-07-31",
          eventDate: "2026-07-31",
          groupId: "3",
          id: "12",
          participantMemberIds: [],
          startAt: null,
          title: "정기 검진",
        }}
        members={members}
        onCancel={jest.fn()}
        onSaved={onSaved}
      />
    );
  });

  expect(renderer!.root.findByProps({ children: "일정 수정" })).toBeTruthy();
  expect(renderer!.root.findAllByProps({ children: "작성자" })).toHaveLength(0);
  expect(renderer!.root.findByProps({ children: "참여자" })).toBeTruthy();

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "일정 저장" })
      .props.onPress();
    await Promise.resolve();
  });

  expect(gateway.updateEvent).toHaveBeenCalledWith("12", {
    description: "수호 할아버지 병원",
    endAt: null,
    endDate: "2026-07-31",
    eventDate: "2026-07-31",
    participantMemberIds: [],
    startAt: null,
    title: "정기 검진",
  });
  expect(onSaved).toHaveBeenCalledWith("12");

  TestRenderer.act(() => renderer!.unmount());
});

function scrollWheel(
  renderer: TestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
  index: number
) {
  const wheel = renderer.root
    .findAllByProps({ accessibilityLabel })
    .find((node) => typeof node.props.onMomentumScrollEnd === "function");
  if (!wheel) {
    throw new Error(`${accessibilityLabel}을 찾을 수 없습니다.`);
  }
  wheel.props.onMomentumScrollEnd({
    nativeEvent: { contentOffset: { x: 0, y: index * 52 } },
  });
}
