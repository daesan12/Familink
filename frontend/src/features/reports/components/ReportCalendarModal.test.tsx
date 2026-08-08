import React from "react";
import { Text } from "react-native";
import TestRenderer from "react-test-renderer";

import { ReportCalendarModal } from "./ReportCalendarModal";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function render(overrides: Record<string, unknown> = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ReportCalendarModal
        month={7}
        onClose={jest.fn()}
        onNextMonth={jest.fn()}
        onPreviousMonth={jest.fn()}
        onRetry={jest.fn()}
        onSelectDate={jest.fn()}
        reportDates={["2026-07-01"]}
        selectedDate="2026-07-01"
        status="ready"
        visible
        year={2026}
        {...overrides}
      />
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function dayNumbers(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(Text)
    .filter((node) => typeof node.props.children === "number");
}

test("달력은 월과 무관하게 항상 6주 42칸을 그린다", () => {
  // 42칸이 고정이라야 월을 넘겨도 팝업 높이가 변하지 않는다.
  expect(dayNumbers(render())).toHaveLength(42);
  expect(dayNumbers(render({ month: 2 }))).toHaveLength(42);
});

test("인접 달 날짜는 기준 달에 같은 일자 리포트가 있어도 버튼이 되지 않는다", () => {
  // 2026년 7월 격자는 8월 1~8일까지 포함한다. 각 칸의 날짜를 표시 중인 달로
  // 계산하면 8월 1일 칸이 '2026-07-01'을 훔쳐 중복 버튼이 된다.
  const renderer = render();

  // 라벨은 표시 중인 달로 만들므로 8월 1일 칸이 새면 '8월 1일'이 아니라
  // '7월 1일' 버튼이 하나 더 생긴다. 개수로만 잡을 수 있다.
  // deep:false로 중첩 노드를 제외해야 버튼 개수를 그대로 센다.
  expect(
    renderer.root.findAllByProps(
      { accessibilityLabel: "2026년 7월 1일 리포트 보기" },
      { deep: false }
    )
  ).toHaveLength(1);
});

test("선택 가능한 날짜를 누르면 그 날짜를 그대로 알린다", () => {
  const onSelectDate = jest.fn();
  const renderer = render({ onSelectDate });

  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "2026년 7월 1일 리포트 보기" })
      .props.onPress();
  });

  expect(onSelectDate).toHaveBeenCalledWith("2026-07-01");
});
