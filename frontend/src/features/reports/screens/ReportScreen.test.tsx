import React from "react";
import TestRenderer from "react-test-renderer";

import {
  DAILY_PENDING_REPORT_PAGE,
  EMPTY_REPORT_PAGE,
} from "../fixtures/reportFixtures";
import type { CareReceiverReportPage } from "../types";
import { ReportScreen } from "./ReportScreen";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");

const currentGroup = {
  id: "group-1",
  name: "우리 가족",
  role: "guardian" as const,
};

function renderReportScreen(careReceivers: readonly CareReceiverReportPage[]) {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ReportScreen
        careReceivers={careReceivers}
        currentGroup={currentGroup}
        role="guardian"
      />
    );
  });

  return renderer!;
}

function createLatestOnlyPage(): CareReceiverReportPage {
  return {
    displayName: "김말순",
    latestDailyReport: {
      emotion: { icon: "emoticon-neutral-outline", label: "평온" },
      guardianMessageSummary: null,
      id: "daily-latest",
      reportDate: "2026-07-16",
      reportDateLabel: "2026년 7월 16일",
      summary: "가족들의 안부를 궁금해하며 편안하게 하루를 보내셨어요.",
    },
    memberId: "care-receiver-latest-only",
    todayCalls: [],
  };
}

test("캘린더 아이콘을 누르면 생성된 날짜를 선택하는 팝업을 연다", () => {
  const renderer = renderReportScreen([createLatestOnlyPage()]);
  const calendar = renderer.root.findByProps({
    accessibilityLabel: "리포트 캘린더",
  });

  TestRenderer.act(() => {
    calendar.props.onPress();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: "리포트 날짜 선택" })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 7월 16일 리포트 보기",
    })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 7월 15일 리포트 없음",
    }).props.disabled
  ).toBe(true);
});

test("당일 통화가 없어도 가장 최신 일간 리포트와 날짜를 표시한다", () => {
  const renderer = renderReportScreen([createLatestOnlyPage()]);
  const tree = JSON.stringify(renderer.toJSON());

  expect(tree).toContain("2026년 7월 16일");
  expect(tree).toContain(
    "가족들의 안부를 궁금해하며 편안하게 하루를 보내셨어요."
  );
  expect(tree).toContain("오늘 생성된 통화 리포트가 없어요.");
  expect(tree).not.toContain("AI 전화를 사용하시지 않으셨어요");
  expect(tree).not.toContain("전달할 말씀");
});

test("건별 리포트만 있으면 일간 리포트 준비 상태와 건별 목록을 표시한다", () => {
  const renderer = renderReportScreen([DAILY_PENDING_REPORT_PAGE]);
  const tree = JSON.stringify(renderer.toJSON());

  expect(tree).toContain("아직 일간 리포트가 생성되지 않았어요");
  expect(tree).toContain("10:32");
  expect(tree).toContain("18:30");
  expect(tree).toContain("리포트 준비 중");
});

test("리포트가 한 건도 없으면 전체 빈 상태를 표시한다", () => {
  const renderer = renderReportScreen([EMPTY_REPORT_PAGE]);

  expect(JSON.stringify(renderer.toJSON())).toContain(
    "AI 전화를 사용하시지 않으셨어요"
  );
});

test("건별 리포트를 누르면 텍스트 상세를 열고 null 메시지 영역은 숨긴다", () => {
  const page: CareReceiverReportPage = {
    ...createLatestOnlyPage(),
    todayCalls: [
      {
        callSessionId: "call-1",
        guardianMessage: null,
        reportAvailable: true,
        reportDateLabel: "2026.07.18",
        startedAtLabel: "10:32",
        summary: "오늘 아침 식사와 날씨에 관해 이야기하셨어요.",
      },
    ],
  };
  const renderer = renderReportScreen([page]);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({
        accessibilityLabel: "10:32 통화 리포트 열기",
      })
      .props.onPress();
  });

  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain("2026.07.18");
  expect(tree).toContain("오늘 아침 식사와 날씨에 관해 이야기하셨어요.");
  expect(tree).not.toContain("전달하신 말씀");
});

test("좌우 넘김 결과에 맞춰 현재 피보호자 인디케이터를 변경한다", () => {
  const firstPage = createLatestOnlyPage();
  const secondPage: CareReceiverReportPage = {
    ...EMPTY_REPORT_PAGE,
    displayName: "박영수",
    memberId: "care-receiver-second",
  };
  const renderer = renderReportScreen([firstPage, secondPage]);
  const pager = renderer.root.findByProps({
    testID: "care-receiver-report-pager",
  });

  expect(
    renderer.root.findByProps({
      accessibilityLabel: "김말순 리포트, 현재 화면",
    })
  ).toBeTruthy();

  TestRenderer.act(() => {
    pager.props.onMomentumScrollEnd({
      nativeEvent: { contentOffset: { x: 1000, y: 0 } },
    });
  });

  expect(
    renderer.root.findByProps({
      accessibilityLabel: "박영수 리포트, 현재 화면",
    })
  ).toBeTruthy();
});

test("피보호자 구성이 바뀌면 첫 페이지로 안전하게 돌아간다", () => {
  const firstPage = createLatestOnlyPage();
  const secondPage: CareReceiverReportPage = {
    ...EMPTY_REPORT_PAGE,
    displayName: "박영수",
    memberId: "care-receiver-second",
  };
  const renderer = renderReportScreen([firstPage, secondPage]);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: "care-receiver-report-pager" })
      .props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: 1000, y: 0 } },
      });
  });
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "박영수 리포트, 현재 화면",
    })
  ).toBeTruthy();

  TestRenderer.act(() => {
    renderer.update(
      <ReportScreen
        careReceivers={[firstPage]}
        currentGroup={currentGroup}
        role="guardian"
      />
    );
  });

  expect(
    renderer.root.findByProps({
      accessibilityLabel: "김말순 리포트, 현재 화면",
    })
  ).toBeTruthy();
});

test("기본 개발 fixture는 지정된 보호자 그룹에만 노출한다", () => {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ReportScreen
        currentGroup={{
          id: "development-empty-group",
          name: "빈 그룹",
          role: "guardian",
        }}
        role="guardian"
      />
    );
  });

  const tree = JSON.stringify(renderer!.toJSON());
  expect(tree).toContain("리포트를 확인할 피보호자가 없어요");
  expect(tree).not.toContain("손수호");
  expect(tree).not.toContain("김말순");
});
