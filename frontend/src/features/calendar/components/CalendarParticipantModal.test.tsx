import React from "react";
import TestRenderer from "react-test-renderer";

import type { CalendarMember } from "../types";
import { CalendarParticipantModal } from "./CalendarParticipantModal";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");

  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
  };
});

const MEMBERS: readonly CalendarMember[] = [
  {
    displayName: "홍유라",
    isManager: true,
    memberId: "7",
    profileImageUrl: null,
    role: "guardian",
    userId: "70",
  },
  {
    displayName: "홍길동",
    isManager: false,
    memberId: "8",
    profileImageUrl: null,
    role: "careReceiver",
    userId: "80",
  },
];

async function renderModal(
  members: readonly CalendarMember[],
  selectedMemberIds: readonly string[],
  onChange: jest.Mock
) {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarParticipantModal
        members={members}
        onChange={onChange}
        onClose={jest.fn()}
        selectedMemberIds={selectedMemberIds}
        visible
      />
    );
  });
  return renderer!;
}

test("모두 선택을 누르면 모든 구성원 ID를 전달한다", async () => {
  const onChange = jest.fn();
  const renderer = await renderModal(MEMBERS, [], onChange);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "참여자 모두 선택" })
      .props.onPress();
  });

  expect(onChange).toHaveBeenCalledWith(["7", "8"]);
  TestRenderer.act(() => renderer.unmount());
});

test("전원이 선택된 상태에서는 모두 해제로 바뀌어 선택을 비운다", async () => {
  const onChange = jest.fn();
  const renderer = await renderModal(MEMBERS, ["7", "8"], onChange);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "참여자 모두 해제" })
      .props.onPress();
  });

  expect(onChange).toHaveBeenCalledWith([]);
  TestRenderer.act(() => renderer.unmount());
});

test("일부만 선택된 상태에서는 모두 선택을 유지한다", async () => {
  const onChange = jest.fn();
  const renderer = await renderModal(MEMBERS, ["7"], onChange);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "참여자 모두 선택" })
      .props.onPress();
  });

  expect(onChange).toHaveBeenCalledWith(["7", "8"]);
  TestRenderer.act(() => renderer.unmount());
});

test("선택할 구성원이 없으면 모두 선택 버튼을 표시하지 않는다", async () => {
  const renderer = await renderModal([], [], jest.fn());

  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "참여자 모두 선택" })
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "참여자 모두 해제" })
  ).toHaveLength(0);
  TestRenderer.act(() => renderer.unmount());
});
