import React from "react";
import TestRenderer from "react-test-renderer";

import type { ReportGateway } from "../types";
import { ReportScreen } from "./ReportScreen";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");

const currentGroup = {
  id: "group-1",
  name: "우리 가족",
  role: "guardian" as const,
};

const target = {
  displayName: "김말순",
  memberId: "12",
};

function createGateway(): jest.Mocked<ReportGateway> {
  return {
    getCallReport: jest.fn(),
    getDailyReport: jest.fn(),
    getReportDates: jest.fn().mockResolvedValue({
      latestReportDate: null,
      reportDates: [],
      yearMonth: "2026-07",
    }),
  };
}

async function renderWithGateway(gateway: ReportGateway) {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <ReportScreen
        careReceiverTargets={[target]}
        currentGroup={currentGroup}
        reportDate="2026-07-31"
        reportGateway={gateway}
        role="guardian"
      />
    );
  });

  return renderer!;
}

test("일간 조회 실패를 통화 없음과 구분하고 다시 시도할 수 있다", async () => {
  const gateway = createGateway();
  gateway.getDailyReport
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({
      calls: [],
      dailyReport: null,
      date: "2026-07-31",
      status: "noCalls",
    });
  const renderer = await renderWithGateway(gateway);

  expect(JSON.stringify(renderer.toJSON())).toContain("리포트 조회에 실패했어요");

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityRole: "button" })
      .props.onPress();
  });

  expect(gateway.getDailyReport).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "AI 전화를 사용하시지 않으셨어요"
  );
}, 10_000);

test("건별 행을 누르면 API-REPORTS-003을 조회해 상세를 표시한다", async () => {
  const gateway = createGateway();
  gateway.getDailyReport.mockResolvedValue({
    calls: [
      {
        callSessionId: "31",
        reportAvailable: true,
        startedAt: "2026-07-31T00:30:00Z",
      },
    ],
    dailyReport: {
      emotionCategory: "JOY",
      emotionSubcategory: "즐거움",
      guardianMessageSummary: null,
      id: "7",
      summary: "즐거운 하루를 보내셨어요.",
    },
    date: "2026-07-31",
    status: "ready",
  });
  gateway.getCallReport.mockResolvedValue({
    callSessionId: "31",
    createdAt: "2026-07-31T00:35:00Z",
    guardianMessage: null,
    status: "ready",
    summary: "아침 식사와 가족 이야기를 나누셨어요.",
  });
  const renderer = await renderWithGateway(gateway);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "09:30 통화 리포트 열기" })
      .props.onPress();
  });

  expect(gateway.getCallReport).toHaveBeenCalledWith("31");
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain("아침 식사와 가족 이야기를 나누셨어요.");
  expect(tree).not.toContain("전달하신 말씀");
});

test("건별 404 준비 전 결과는 오류 대신 준비 중으로 표시한다", async () => {
  const gateway = createGateway();
  gateway.getDailyReport.mockResolvedValue({
    calls: [
      {
        callSessionId: "31",
        reportAvailable: true,
        startedAt: "2026-07-31T00:30:00Z",
      },
    ],
    dailyReport: null,
    date: "2026-07-31",
    status: "generating",
  });
  gateway.getCallReport.mockResolvedValue({
    callSessionId: "31",
    status: "generating",
  });
  const renderer = await renderWithGateway(gateway);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "09:30 통화 리포트 열기" })
      .props.onPress();
  });

  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain("리포트를 준비하고 있어요");
  expect(tree).not.toContain("리포트를 불러오지 못했어요");
});

test("당일 리포트가 없으면 이전 달을 포함한 최신 일간 리포트를 유지한다", async () => {
  const gateway = createGateway();
  gateway.getReportDates.mockResolvedValue({
    latestReportDate: "2026-06-30",
    reportDates: [],
    yearMonth: "2026-07",
  });
  gateway.getDailyReport
    .mockResolvedValueOnce({
      calls: [],
      dailyReport: null,
      date: "2026-07-31",
      status: "noCalls",
    })
    .mockResolvedValueOnce({
      calls: [],
      dailyReport: {
        emotionCategory: "NEUTRAL",
        emotionSubcategory: "평온",
        guardianMessageSummary: null,
        id: "5",
        summary: "차분하게 하루를 보내셨어요.",
      },
      date: "2026-06-30",
      status: "ready",
    });

  const renderer = await renderWithGateway(gateway);

  expect(gateway.getReportDates).toHaveBeenCalledWith(
    "group-1",
    "12",
    2026,
    7
  );
  expect(gateway.getDailyReport).toHaveBeenNthCalledWith(
    2,
    "group-1",
    "12",
    "2026-06-30"
  );
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain("2026년 6월 30일");
  expect(tree).toContain("차분하게 하루를 보내셨어요.");
  expect(tree).toContain("오늘 생성된 통화 리포트가 없어요.");
});
