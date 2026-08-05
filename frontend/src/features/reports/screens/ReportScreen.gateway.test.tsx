import React from "react";
import TestRenderer from "react-test-renderer";

import type { ReportGateway } from "../types";
import { REPORT_PAGE_REQUEST_CONCURRENCY } from "../hooks/useReportPages";
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
const renderedScreens = new Set<TestRenderer.ReactTestRenderer>();

afterEach(() => {
  TestRenderer.act(() => {
    renderedScreens.forEach((renderer) => renderer.unmount());
  });
  renderedScreens.clear();
});

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

async function renderWithGateway(gateway: ReportGateway, targets = [target]) {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <ReportScreen
        careReceiverTargets={targets}
        currentGroup={currentGroup}
        reportDate="2026-07-31"
        reportGateway={gateway}
        role="guardian"
      />
    );
  });

  renderedScreens.add(renderer!);
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

  expect(JSON.stringify(renderer.toJSON())).toContain(
    "리포트 조회에 실패했어요"
  );

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "김말순 님 리포트 다시 시도" })
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

  expect(gateway.getReportDates).toHaveBeenCalledWith("group-1", "12", 2026, 7);
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

test("캘린더의 생성 날짜를 누르면 같은 화면을 해당 날짜 리포트로 갱신한다", async () => {
  const gateway = createGateway();
  gateway.getReportDates.mockResolvedValue({
    latestReportDate: "2026-07-31",
    reportDates: ["2026-07-17", "2026-07-31"],
    yearMonth: "2026-07",
  });
  gateway.getDailyReport.mockImplementation(
    async (_groupId, _memberId, date) => ({
      calls: [],
      dailyReport: {
        emotionCategory: "NEUTRAL",
        emotionSubcategory: "평온",
        guardianMessageSummary: null,
        id: date,
        summary:
          date === "2026-07-17"
            ? "선택한 날짜의 리포트입니다."
            : "오늘의 리포트입니다.",
      },
      date,
      status: "ready",
    })
  );
  const renderer = await renderWithGateway(gateway);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "리포트 캘린더" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({
        accessibilityLabel: "2026년 7월 17일 리포트 보기",
      })
      .props.onPress();
  });

  expect(gateway.getDailyReport).toHaveBeenCalledWith(
    "group-1",
    "12",
    "2026-07-17"
  );
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain("선택한 날짜의 리포트입니다.");
  expect(tree).toContain("2026년 7월 17일");
  expect(tree).toContain("선택한 날의 통화");
  expect(tree).not.toContain("리포트 날짜 선택");
});

test("캘린더 방향 버튼으로 월을 이동하면 이동한 월의 생성 날짜를 조회한다", async () => {
  const gateway = createGateway();
  gateway.getReportDates.mockResolvedValue({
    latestReportDate: "2026-07-31",
    reportDates: ["2026-07-31"],
    yearMonth: "2026-07",
  });
  gateway.getDailyReport.mockResolvedValue({
    calls: [],
    dailyReport: {
      emotionCategory: "NEUTRAL",
      emotionSubcategory: "평온",
      guardianMessageSummary: null,
      id: "daily-31",
      summary: "오늘의 리포트입니다.",
    },
    date: "2026-07-31",
    status: "ready",
  });
  const renderer = await renderWithGateway(gateway);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "리포트 캘린더" })
      .props.onPress();
  });

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "다음 달" })
      .props.onPress();
  });

  expect(gateway.getReportDates).toHaveBeenCalledWith("group-1", "12", 2026, 8);
  expect(JSON.stringify(renderer.toJSON())).toContain("2026년 8월");
});

test("월을 이동하면 API 응답 전에도 날짜표를 즉시 표시하고 인접 월 결과를 캐시한다", async () => {
  const gateway = createGateway();
  let resolveAugust:
    | ((value: {
        latestReportDate: string;
        reportDates: string[];
        yearMonth: string;
      }) => void)
    | undefined;
  gateway.getDailyReport.mockResolvedValue({
    calls: [],
    dailyReport: {
      emotionCategory: "NEUTRAL",
      emotionSubcategory: "평온",
      guardianMessageSummary: null,
      id: "daily-31",
      summary: "오늘의 리포트입니다.",
    },
    date: "2026-07-31",
    status: "ready",
  });
  gateway.getReportDates.mockImplementation(
    async (_groupId, _memberId, year, month) => {
      if (month === 8) {
        return new Promise((resolve) => {
          resolveAugust = resolve;
        });
      }
      return {
        latestReportDate: "2026-07-31",
        reportDates: month === 7 ? ["2026-07-31"] : [],
        yearMonth: `${year}-${String(month).padStart(2, "0")}`,
      };
    }
  );
  const renderer = await renderWithGateway(gateway);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "리포트 캘린더" })
      .props.onPress();
  });
  const julyRequestCountAfterOpen = gateway.getReportDates.mock.calls.filter(
    ([, , year, month]) => year === 2026 && month === 7
  ).length;

  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "다음 달" })
      .props.onPress();
  });

  expect(JSON.stringify(renderer.toJSON())).toContain("2026년 8월");
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 8월 1일 리포트 없음",
    })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: "리포트 날짜 확인 중" })
  ).toBeTruthy();

  await TestRenderer.act(async () => {
    resolveAugust?.({
      latestReportDate: "2026-08-17",
      reportDates: ["2026-08-17"],
      yearMonth: "2026-08",
    });
  });

  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 8월 17일 리포트 보기",
    })
  ).toBeTruthy();

  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "이전 달" })
      .props.onPress();
    renderer.root
      .findByProps({ accessibilityLabel: "다음 달" })
      .props.onPress();
  });

  const julyRequestCountAfterNavigation =
    gateway.getReportDates.mock.calls.filter(
      ([, , year, month]) => year === 2026 && month === 7
    ).length;
  const augustRequests = gateway.getReportDates.mock.calls.filter(
    ([, , year, month]) => year === 2026 && month === 8
  );
  expect(julyRequestCountAfterNavigation).toBe(julyRequestCountAfterOpen);
  expect(augustRequests).toHaveLength(1);
});

test("어르신별 캘린더 날짜를 분리하고 화면 로딩 때 받은 현재 월을 재사용한다", async () => {
  const gateway = createGateway();
  const targets = [
    { displayName: "김수호", memberId: "11" },
    { displayName: "이말순", memberId: "12" },
  ];
  gateway.getDailyReport.mockImplementation(
    async (_groupId, memberId, date) => ({
      calls: [],
      dailyReport: {
        emotionCategory: "NEUTRAL",
        emotionSubcategory: "평온",
        guardianMessageSummary: null,
        id: `daily-${memberId}`,
        summary: `${memberId}번 어르신 리포트`,
      },
      date,
      status: "ready",
    })
  );
  gateway.getReportDates.mockImplementation(
    async (_groupId, memberId, year, month) => ({
      latestReportDate: memberId === "11" ? "2026-07-10" : "2026-07-20",
      reportDates:
        month !== 7 ? [] : memberId === "11" ? ["2026-07-10"] : ["2026-07-20"],
      yearMonth: `${year}-${String(month).padStart(2, "0")}`,
    })
  );
  const renderer = await renderWithGateway(gateway, targets);
  const currentMonthRequestCount = () =>
    gateway.getReportDates.mock.calls.filter(
      ([, , year, month]) => year === 2026 && month === 7
    ).length;

  expect(currentMonthRequestCount()).toBe(2);
  const calendarButtons = renderer.root
    .findAllByProps({ accessibilityLabel: "리포트 캘린더" })
    .filter((button) => typeof button.props.onPress === "function");

  await TestRenderer.act(async () => {
    calendarButtons[0].props.onPress();
  });
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 7월 10일 리포트 보기",
    })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 7월 20일 리포트 없음",
    })
  ).toBeTruthy();

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "리포트 캘린더 닫기" })
      .props.onPress();
    calendarButtons[1].props.onPress();
  });
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 7월 20일 리포트 보기",
    })
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: "2026년 7월 10일 리포트 없음",
    })
  ).toBeTruthy();
  expect(currentMonthRequestCount()).toBe(2);
});

test("알림 딥링크로 진입하면 해당 날짜·멤버 리포트로 이동해 통화 상세까지 연다", async () => {
  const gateway = createGateway();
  const targets = [
    { displayName: "김수호", memberId: "11" },
    { displayName: "이말순", memberId: "12" },
  ];
  gateway.getDailyReport.mockImplementation(
    async (_groupId, memberId, date) => ({
      calls:
        memberId === "12" && date === "2026-07-17"
          ? [
              {
                callSessionId: "31",
                reportAvailable: true,
                startedAt: "2026-07-17T00:30:00Z",
              },
            ]
          : [],
      dailyReport: {
        emotionCategory: "NEUTRAL",
        emotionSubcategory: "평온",
        guardianMessageSummary: null,
        id: `daily-${memberId}`,
        summary: `${memberId}번 ${date} 리포트`,
      },
      date,
      status: "ready",
    })
  );
  gateway.getCallReport.mockResolvedValue({
    callSessionId: "31",
    createdAt: "2026-07-17T00:35:00Z",
    guardianMessage: null,
    status: "ready",
    summary: "딥링크로 연 통화 리포트입니다.",
  });

  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <ReportScreen
        careReceiverTargets={targets}
        currentGroup={currentGroup}
        openReportRequestId={1}
        openReportTarget={{
          callSessionId: "31",
          memberId: "12",
          reportDate: "2026-07-17",
        }}
        reportDate="2026-07-31"
        reportGateway={gateway}
        role="guardian"
      />
    );
  });
  renderedScreens.add(renderer!);
  await TestRenderer.act(async () => {});

  expect(gateway.getDailyReport).toHaveBeenCalledWith(
    "group-1",
    "12",
    "2026-07-17"
  );
  expect(gateway.getCallReport).toHaveBeenCalledWith("31");
  const tree = JSON.stringify(renderer!.toJSON());
  expect(tree).toContain("딥링크로 연 통화 리포트입니다.");
  expect(tree).toContain("12번 2026-07-17 리포트");
});

test("한 피보호자 조회 실패에도 성공한 페이지를 유지하고 실패한 대상만 다시 시도한다", async () => {
  const gateway = createGateway();
  const targets = [
    { displayName: "김수호", memberId: "11" },
    { displayName: "이말순", memberId: "12" },
    { displayName: "박정자", memberId: "13" },
    { displayName: "최복희", memberId: "14" },
  ];
  let failedTargetAttempts = 0;
  gateway.getDailyReport.mockImplementation(
    async (_groupId, memberId, date) => {
      if (memberId === "14" && failedTargetAttempts++ === 0) {
        throw new Error("network");
      }

      return {
        calls: [],
        dailyReport: {
          emotionCategory: "NEUTRAL",
          emotionSubcategory: "평온",
          guardianMessageSummary: null,
          id: `daily-${memberId}`,
          summary: `${memberId}번 피보호자 리포트`,
        },
        date,
        status: "ready",
      };
    }
  );
  const renderer = await renderWithGateway(gateway, targets);

  const failedTree = JSON.stringify(renderer.toJSON());
  expect(failedTree).toContain("11번 피보호자 리포트");
  expect(failedTree).toContain("12번 피보호자 리포트");
  expect(failedTree).toContain("13번 피보호자 리포트");
  expect(failedTree).toContain("최복희 님의 리포트 조회에 실패했어요");

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "최복희 님 리포트 다시 시도" })
      .props.onPress();
  });

  targets.forEach(({ memberId }) => {
    expect(
      gateway.getDailyReport.mock.calls.filter(
        ([, requestedMemberId]) => requestedMemberId === memberId
      )
    ).toHaveLength(memberId === "14" ? 2 : 1);
  });
  const recoveredTree = JSON.stringify(renderer.toJSON());
  expect(recoveredTree).toContain("11번 피보호자 리포트");
  expect(recoveredTree).toContain("12번 피보호자 리포트");
  expect(recoveredTree).toContain("13번 피보호자 리포트");
  expect(recoveredTree).toContain("14번 피보호자 리포트");
});

test("리포트 초기 조회의 동시 요청 수를 chunk 상한으로 제한한다", async () => {
  const gateway = createGateway();
  const targets = Array.from({ length: 7 }, (_, index) => ({
    displayName: `피보호자 ${index + 1}`,
    memberId: String(index + 1),
  }));
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const trackRequest = async <T,>(value: T): Promise<T> => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
    activeRequests -= 1;
    return value;
  };
  gateway.getDailyReport.mockImplementation(async (_groupId, _memberId, date) =>
    trackRequest({
      calls: [],
      dailyReport: null,
      date,
      status: "noCalls" as const,
    })
  );
  gateway.getReportDates.mockImplementation(
    async (_groupId, _memberId, year, month) =>
      trackRequest({
        latestReportDate: null,
        reportDates: [],
        yearMonth: `${year}-${String(month).padStart(2, "0")}`,
      })
  );

  await renderWithGateway(gateway, targets);
  for (
    let attempt = 0;
    attempt < 100 && gateway.getReportDates.mock.calls.length < targets.length;
    attempt += 1
  ) {
    await TestRenderer.act(async () => {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
    });
  }

  expect(gateway.getDailyReport).toHaveBeenCalledTimes(targets.length);
  expect(gateway.getReportDates).toHaveBeenCalledTimes(targets.length);
  expect(maxActiveRequests).toBeGreaterThan(1);
  expect(maxActiveRequests).toBeLessThanOrEqual(
    REPORT_PAGE_REQUEST_CONCURRENCY
  );
});
