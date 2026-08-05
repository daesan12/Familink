import React from "react";
import TestRenderer from "react-test-renderer";

import { CalendarTimePickerModal } from "./CalendarTimePickerModal";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");

test("휠에서 선택한 시간을 확인할 때 24시간 값으로 전달한다", async () => {
  const onConfirm = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarTimePickerModal
        label="시작"
        onCancel={jest.fn()}
        onConfirm={onConfirm}
        value="10:00"
        visible
      />
    );
  });

  await TestRenderer.act(async () => {
    scrollWheel(renderer!, "오전 오후 휠", 1);
    renderer!.root
      .findByProps({ accessibilityLabel: "11시 선택" })
      .props.onPress();
    scrollWheel(renderer!, "분 휠", 30);
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: "시간 선택 확인" })
      .props.onPress();
  });

  expect(onConfirm).toHaveBeenCalledWith("23:30");
  TestRenderer.act(() => renderer!.unmount());
});

test("취소하면 휠에서 바꾼 시간을 반영하지 않는다", async () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <CalendarTimePickerModal
        label="종료"
        onCancel={onCancel}
        onConfirm={onConfirm}
        value="18:00"
        visible
      />
    );
  });

  await TestRenderer.act(async () => {
    scrollWheel(renderer!, "분 휠", 45);
    pressByLabel(renderer!, "시간 선택 취소");
  });

  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
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

function pressByLabel(
  renderer: TestRenderer.ReactTestRenderer,
  accessibilityLabel: string
) {
  const button = renderer.root
    .findAllByProps({ accessibilityLabel })
    .find((node) => typeof node.props.onPress === "function");
  if (!button) {
    throw new Error(`${accessibilityLabel}을 찾을 수 없습니다.`);
  }
  button.props.onPress();
}
