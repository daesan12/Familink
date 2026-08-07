import React from "react";
import {
  NavigationContainer,
  useNavigation,
  type NavigationProp,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {Pressable} from "react-native";
import TestRenderer from "react-test-renderer";

import type { MainTabsParamList } from "../../../app-shell";
import type {
  CareReceiverReportTarget,
  DailyReportResult,
  ReportGateway,
} from "../types";
import { reportCache } from "../reportCache";
import * as reportTargetHooks from "../hooks/useCareReceiverReportTargets";
import { REPORT_PAGE_REQUEST_CONCURRENCY } from "../hooks/useReportPages";
import * as reportPageHooks from "../hooks/useReportPages";
import { ReportScreen } from "./ReportScreen";

jest.mock("@react-native-vector-icons/material-design-icons", () => "Icon");
jest.mock("lucide-react-native", () => ({Phone: "PhoneIcon"}));
jest.mock("react-native-safe-area-context", () => {
  const mockReact = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };

  return {
    // 라우트 컨텍스트용 native-stack의 SafeAreaProviderCompat이 이 컨텍스트를 구독한다.
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    initialWindowMetrics: null,
    useSafeAreaInsets: () => insets,
  };
});

const currentGroup = {
  id: "group-1",
  name: "우리 가족",
  role: "guardian" as const,
};

const target = {
  displayName: "김말순",
  memberId: "12",
};

// ReportScreen이 useRoute로 리포트 탭 route params를 읽으므로, 단독 렌더도
// 셸과 같은 'report' route 이름의 화면으로 감싼다.
type ReportTestParamList = Pick<MainTabsParamList, "report">;

const RouteStack = createNativeStackNavigator<ReportTestParamList>();

function ReportCalendarTrigger() {
  const navigation =
    useNavigation<NavigationProp<ReportTestParamList, "report">>();

  return (
    <Pressable
      accessibilityLabel="리포트 캘린더"
      onPress={() => navigation.setParams({openCalendar: true})}
    />
  );
}

function withReportRoute(
  element: React.ReactElement,
  params?: MainTabsParamList["report"]
) {
  return (
    <NavigationContainer>
      <RouteStack.Navigator screenOptions={{ headerShown: false }}>
        <RouteStack.Screen initialParams={params} name="report">
          {() => (
            <>
              <ReportCalendarTrigger />
              {element}
            </>
          )}
        </RouteStack.Screen>
      </RouteStack.Navigator>
    </NavigationContainer>
  );
}
const renderedScreens = new Set<TestRenderer.ReactTestRenderer>();

// 리포트 캐시는 로그인 세션 동안 유지되는 모듈 싱글턴이라, 각 테스트를 앱을
// 새로 켠 상태에서 시작시키려면 비워야 한다.
beforeEach(() => {
  reportCache.clear();
});

afterEach(() => {
  TestRenderer.act(() => {
    renderedScreens.forEach((renderer) => renderer.unmount());
  });
  renderedScreens.clear();
  jest.useRealTimers();
});

function createGateway(): jest.Mocked<ReportGateway> {
  return {
    getCallReport: jest.fn(),
    getCallReportStatus: jest.fn(),
    getDailyReport: jest.fn(),
    getReportDates: jest.fn().mockResolvedValue({
      latestReportDate: null,
      reportDates: [],
      yearMonth: "2026-07",
    }),
    requestDailyReportGeneration: jest.fn(),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function renderWithGateway(gateway: ReportGateway, targets = [target]) {
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withReportRoute(
        <ReportScreen
          careReceiverTargets={targets}
          currentGroup={currentGroup}
          reportDate="2026-07-31"
          reportGateway={gateway}
          role="guardian"
        />
      )
    );
  });

  renderedScreens.add(renderer!);
  return renderer!;
}

function mockDailyReportWithCall(
  gateway: jest.Mocked<ReportGateway>,
  reportAvailable = true
) {
  gateway.getDailyReport.mockResolvedValue({
    calls: [
      {
        callSessionId: "31",
        reportAvailable,
        startedAt: "2026-07-31T00:30:00Z",
      },
    ],
    dailyReport: null,
    date: "2026-07-31",
    generationStatus: reportAvailable ? "available" : "notReady",
  });
}

async function openCallReport(renderer: TestRenderer.ReactTestRenderer) {
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "09:30 통화 리포트 열기" })
      .props.onPress();
  });
}

function readyCallReport() {
  return {
    callSessionId: "31",
    createdAt: "2026-07-31T00:35:00Z",
    guardianMessage: null,
    status: "ready" as const,
    summary: "아침 식사와 가족 이야기를 나누셨어요.",
  };
}

test("원격 리포트 초기 조회가 끝날 때까지 잘못된 빈 화면을 노출하지 않는다", async () => {
  const gateway = createGateway();
  const targetRequest =
    createDeferred<readonly CareReceiverReportTarget[]>();
  const dailyReportRequest = createDeferred<DailyReportResult>();
  const loadTargets = jest.fn(() => targetRequest.promise);
  gateway.getDailyReport.mockReturnValue(dailyReportRequest.promise);
  let renderer!: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      withReportRoute(
        <ReportScreen
          careReceiverTargetsLoader={loadTargets}
          currentGroup={currentGroup}
          reportDate="2026-07-31"
          reportGateway={gateway}
          role="guardian"
        />
      )
    );
  });
  renderedScreens.add(renderer);

  const initialTree = JSON.stringify(renderer.toJSON());
  expect(initialTree).toContain("피보호자 목록을 불러오고 있어요");
  expect(initialTree).not.toContain("리포트를 확인할 피보호자가 없어요");

  await TestRenderer.act(async () => {
    targetRequest.resolve([target]);
    await targetRequest.promise;
  });

  const reportLoadingTree = JSON.stringify(renderer.toJSON());
  expect(reportLoadingTree).toContain("리포트를 불러오고 있어요");
  expect(reportLoadingTree).not.toContain("리포트를 확인할 피보호자가 없어요");

  await TestRenderer.act(async () => {
    dailyReportRequest.resolve({
      calls: [],
      dailyReport: {
        emotionCategory: "JOY",
        emotionSubcategory: "즐거움",
        guardianMessageSummary: null,
        id: "daily-31",
        summary: "오늘의 안정적인 리포트입니다.",
      },
      date: "2026-07-31",
      generationStatus: "ready",
    });
    await dailyReportRequest.promise;
  });

  const readyTree = JSON.stringify(renderer.toJSON());
  expect(readyTree).toContain("오늘의 안정적인 리포트입니다.");
  expect(readyTree).not.toContain("리포트를 불러오고 있어요");
});

test("피보호자 조회가 idle인 첫 렌더를 로딩 화면으로 표시한다", async () => {
  const targetStateSpy = jest
    .spyOn(reportTargetHooks, "useCareReceiverReportTargets")
    .mockReturnValue({ retry: jest.fn(), status: "idle" });
  const gateway = createGateway();
  let renderer!: TestRenderer.ReactTestRenderer;

  try {
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        withReportRoute(
          <ReportScreen
            careReceiverTargetsLoader={jest.fn()}
            currentGroup={currentGroup}
            reportDate="2026-07-31"
            reportGateway={gateway}
            role="guardian"
          />
        )
      );
    });
    renderedScreens.add(renderer);

    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain("피보호자 목록을 불러오고 있어요");
    expect(tree).not.toContain("리포트를 확인할 피보호자가 없어요");
  } finally {
    targetStateSpy.mockRestore();
  }
});

test("리포트 조회가 idle인 첫 렌더를 로딩 화면으로 표시한다", async () => {
  const reportPagesSpy = jest
    .spyOn(reportPageHooks, "useReportPages")
    .mockReturnValue({ retry: jest.fn(), status: "idle" });
  const gateway = createGateway();
  let renderer!: TestRenderer.ReactTestRenderer;

  try {
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        withReportRoute(
          <ReportScreen
            careReceiverTargets={[target]}
            currentGroup={currentGroup}
            reportDate="2026-07-31"
            reportGateway={gateway}
            role="guardian"
          />
        )
      );
    });
    renderedScreens.add(renderer);

    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain("리포트를 불러오고 있어요");
    expect(tree).not.toContain("리포트를 확인할 피보호자가 없어요");
  } finally {
    reportPagesSpy.mockRestore();
  }
});

function isCallReportDetailVisible(renderer: TestRenderer.ReactTestRenderer) {
  const detailModal = renderer.root
    .findAllByProps({ statusBarTranslucent: true })
    .find(
      (modal) =>
        modal.findAllByProps({
          accessibilityLabel: "건별 통화 리포트 상세",
        }).length > 0
    );
  return Boolean(detailModal?.props.visible);
}

test("일간 조회 실패를 통화 없음과 구분하고 다시 시도할 수 있다", async () => {
  const gateway = createGateway();
  gateway.getDailyReport
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({
      calls: [],
      dailyReport: null,
      date: "2026-07-31",
      generationStatus: "notReady",
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
    "아직 일간 리포트가 생성되지 않았어요"
  );
}, 10_000);

test("생성 완료되지 않은 통화는 건별 리포트 카드로 표시하지 않는다", async () => {
  const gateway = createGateway();
  gateway.getDailyReport.mockResolvedValue({
    calls: [
      {
        callSessionId: "31",
        reportAvailable: true,
        startedAt: "2026-07-31T00:30:00Z",
      },
      {
        callSessionId: "32",
        reportAvailable: false,
        startedAt: "2026-07-31T01:30:00Z",
      },
    ],
    dailyReport: null,
    date: "2026-07-31",
    generationStatus: "available",
  });

  const renderer = await renderWithGateway(gateway);

  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: "09:30 통화 리포트 열기",
    }).length
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: "10:30 통화 리포트 상태 확인",
    })
  ).toHaveLength(0);
});

test("이전 최신 리포트 아래에서 오늘 수동 생성 버튼을 누를 수 있다", async () => {
  const gateway = createGateway();
  gateway.getReportDates.mockResolvedValue({
    latestReportDate: "2026-07-30",
    reportDates: ["2026-07-30"],
    yearMonth: "2026-07",
  });
  gateway.getDailyReport
    .mockResolvedValueOnce({
      calls: [
        {
          callSessionId: "31",
          reportAvailable: true,
          startedAt: "2026-07-31T00:30:00Z",
        },
      ],
      dailyReport: null,
      date: "2026-07-31",
      generationStatus: "available",
    })
    .mockResolvedValueOnce({
      calls: [],
      dailyReport: {
        emotionCategory: "NEUTRAL",
        emotionSubcategory: "평온",
        guardianMessageSummary: null,
        id: "daily-30",
        summary: "어제의 일간 리포트입니다.",
      },
      date: "2026-07-30",
      generationStatus: "ready",
    });
  gateway.requestDailyReportGeneration.mockResolvedValue({
    generationStatus: "generating",
    reportDate: "2026-07-31",
  });
  const renderer = await renderWithGateway(gateway);

  expect(JSON.stringify(renderer.toJSON())).toContain(
    "어제의 일간 리포트입니다."
  );
  const button = renderer.root.findByProps({
    accessibilityLabel: "일간 리포트 생성",
  });
  expect(button.props.accessibilityState).toEqual({ disabled: false });

  await TestRenderer.act(async () => {
    button.props.onPress();
  });

  expect(gateway.requestDailyReportGeneration).toHaveBeenCalledWith(
    "group-1",
    "12"
  );
  expect(
    renderer.root.findByProps({ accessibilityLabel: "일간 리포트 생성 중…" })
      .props.accessibilityState
  ).toEqual({ disabled: true });
});

test("생성 요청 뒤 5초 간격으로 상태를 확인하고 완료 리포트를 갱신한다", async () => {
  jest.useFakeTimers();
  const gateway = createGateway();
  const availableResult = {
    calls: [
      {
        callSessionId: "31",
        reportAvailable: true,
        startedAt: "2026-07-31T00:30:00Z",
      },
    ],
    dailyReport: null,
    date: "2026-07-31",
    generationStatus: "available" as const,
  };
  const readyResult = {
    calls: availableResult.calls,
    dailyReport: {
      emotionCategory: "JOY" as const,
      emotionSubcategory: "즐거움",
      guardianMessageSummary: null,
      id: "daily-31",
      summary: "방금 생성한 오늘의 리포트입니다.",
    },
    date: "2026-07-31",
    generationStatus: "ready" as const,
  };
  gateway.getDailyReport
    .mockResolvedValueOnce(availableResult)
    .mockResolvedValue(readyResult);
  gateway.requestDailyReportGeneration.mockResolvedValue({
    generationStatus: "generating",
    reportDate: "2026-07-31",
  });
  const renderer = await renderWithGateway(gateway);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "일간 리포트 생성" })
      .props.onPress();
  });
  expect(gateway.getDailyReport).toHaveBeenCalledTimes(1);

  await TestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(5_000);
  });

  expect(gateway.getDailyReport).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "방금 생성한 오늘의 리포트입니다."
  );
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: "일간 리포트 생성" })
  ).toHaveLength(0);
});

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
    generationStatus: "ready",
  });
  gateway.getCallReport.mockResolvedValue({
    callSessionId: "31",
    createdAt: "2026-07-31T00:35:00Z",
    guardianMessage: null,
    status: "ready",
    summary: "아침 식사와 가족 이야기를 나누셨어요.",
  });
  gateway.getCallReportStatus.mockResolvedValue({
    callSessionId: "31",
    status: "ready",
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
    generationStatus: "available",
  });
  gateway.getCallReportStatus.mockResolvedValue({
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
      generationStatus: "notReady",
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
      generationStatus: "ready",
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
      generationStatus: "ready",
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
    generationStatus: "ready",
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
    generationStatus: "ready",
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
      generationStatus: "ready",
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
  const calendarButton = renderer.root
    .findAllByProps({ accessibilityLabel: "리포트 캘린더" })
    .find((button) => typeof button.props.onPress === "function");

  if (!calendarButton) {
    throw new Error("리포트 캘린더 버튼을 찾지 못했습니다.");
  }

  await TestRenderer.act(async () => {
    calendarButton.props.onPress();
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
    renderer.root
      .findByProps({testID: "care-receiver-report-pager"})
      .props.onMomentumScrollEnd({
        nativeEvent: {contentOffset: {x: 750, y: 0}},
      });
  });
  await TestRenderer.act(async () => {
    calendarButton.props.onPress();
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
      generationStatus: "ready",
    })
  );
  gateway.getCallReport.mockResolvedValue({
    callSessionId: "31",
    createdAt: "2026-07-17T00:35:00Z",
    guardianMessage: null,
    status: "ready",
    summary: "딥링크로 연 통화 리포트입니다.",
  });
  gateway.getCallReportStatus.mockResolvedValue({
    callSessionId: "31",
    status: "ready",
  });

  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withReportRoute(
        <ReportScreen
          careReceiverTargets={targets}
          currentGroup={currentGroup}
          reportDate="2026-07-31"
          reportGateway={gateway}
          role="guardian"
        />,
        {
          openReport: {
            callSessionId: "31",
            memberId: "12",
            reportDate: "2026-07-17",
          },
        }
      )
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
        generationStatus: "ready",
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
      generationStatus: "notReady" as const,
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

test("생성 중 상태를 5초 뒤 다시 확인해 완료 리포트를 자동으로 표시한다", async () => {
  jest.useFakeTimers();
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  gateway.getCallReportStatus
    .mockResolvedValueOnce({ callSessionId: "31", status: "generating" })
    .mockResolvedValueOnce({ callSessionId: "31", status: "ready" });
  gateway.getCallReport.mockResolvedValue(readyCallReport());
  const renderer = await renderWithGateway(gateway);

  await openCallReport(renderer);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "리포트를 준비하고 있어요"
  );

  await TestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(5_000);
  });

  expect(gateway.getCallReportStatus).toHaveBeenCalledTimes(2);
  expect(gateway.getCallReport).toHaveBeenCalledWith("31");
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "아침 식사와 가족 이야기를 나누셨어요."
  );
});

test("생성 완료되지 않은 통화만 있으면 기존 리포트 빈 상태를 표시한다", async () => {
  const gateway = createGateway();
  mockDailyReportWithCall(gateway, false);
  const renderer = await renderWithGateway(gateway);

  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: "09:30 통화 리포트 상태 확인",
    })
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: "오늘 통화 리포트 없음",
    }).length
  ).toBeGreaterThan(0);
  expect(gateway.getCallReportStatus).not.toHaveBeenCalled();
});

test("90초 동안 생성 중이면 자동 확인을 멈추고 수동 상태 확인으로 복구한다", async () => {
  jest.useFakeTimers();
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  gateway.getCallReportStatus.mockResolvedValue({
    callSessionId: "31",
    status: "generating",
  });
  gateway.getCallReport.mockResolvedValue(readyCallReport());
  const renderer = await renderWithGateway(gateway);

  await openCallReport(renderer);
  await TestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(90_000);
  });

  expect(JSON.stringify(renderer.toJSON())).toContain(
    "처리가 예상보다 오래 걸리고 있어요"
  );
  expect(gateway.getCallReportStatus).toHaveBeenCalledTimes(18);

  gateway.getCallReportStatus.mockResolvedValueOnce({
    callSessionId: "31",
    status: "ready",
  });
  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "상태 다시 확인" })
      .props.onPress();
  });

  expect(JSON.stringify(renderer.toJSON())).toContain(
    "아침 식사와 가족 이야기를 나누셨어요."
  );
});

test("상태 조회 응답이 멈춰도 90초 뒤 지연 상태를 표시한다", async () => {
  jest.useFakeTimers();
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  gateway.getCallReportStatus.mockImplementation(
    () => new Promise<never>(() => undefined)
  );
  const renderer = await renderWithGateway(gateway);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "09:30 통화 리포트 열기" })
      .props.onPress();
    await Promise.resolve();
  });
  await TestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(90_000);
  });

  expect(JSON.stringify(renderer.toJSON())).toContain(
    "처리가 예상보다 오래 걸리고 있어요"
  );
  expect(gateway.getCallReportStatus).toHaveBeenCalledTimes(1);
});

test.each([
  ["failed" as const, "리포트 생성에 실패했어요"],
  ["unavailable" as const, "생성할 수 없는 리포트예요"],
])("%s 상태를 고유한 안내로 표시한다", async (status, message) => {
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  gateway.getCallReportStatus.mockResolvedValue({
    callSessionId: "31",
    status,
  });
  const renderer = await renderWithGateway(gateway);

  await openCallReport(renderer);

  expect(JSON.stringify(renderer.toJSON())).toContain(message);
  expect(gateway.getCallReport).not.toHaveBeenCalled();
});

test("상태 조회 네트워크 오류를 별도 안내하고 다시 확인할 수 있다", async () => {
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  gateway.getCallReportStatus
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ callSessionId: "31", status: "ready" });
  gateway.getCallReport.mockResolvedValue(readyCallReport());
  const renderer = await renderWithGateway(gateway);

  await openCallReport(renderer);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "리포트 상태를 확인하지 못했어요"
  );

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "상태 다시 확인" })
      .props.onPress();
  });

  expect(JSON.stringify(renderer.toJSON())).toContain(
    "아침 식사와 가족 이야기를 나누셨어요."
  );
});

test("상세를 닫은 뒤 도착한 상태 응답은 화면을 다시 열지 않는다", async () => {
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  let resolveStatus:
    | ((value: { callSessionId: string; status: "ready" }) => void)
    | undefined;
  gateway.getCallReportStatus.mockImplementation(
    () =>
      new Promise<{ callSessionId: string; status: "ready" }>((resolve) => {
        resolveStatus = resolve;
      })
  );
  gateway.getCallReport.mockResolvedValue(readyCallReport());
  const renderer = await renderWithGateway(gateway);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "09:30 통화 리포트 열기" })
      .props.onPress();
    await Promise.resolve();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "통화 리포트 상세 닫기" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    resolveStatus?.({ callSessionId: "31", status: "ready" });
  });

  expect(isCallReportDetailVisible(renderer)).toBe(false);
  expect(gateway.getCallReport).not.toHaveBeenCalled();
});

test("한 번 조회한 건별 리포트를 다시 열면 로딩 없이 재조회 없이 표시한다", async () => {
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  gateway.getCallReportStatus.mockResolvedValue({
    callSessionId: "31",
    status: "ready",
  });
  gateway.getCallReport.mockResolvedValue(readyCallReport());
  const renderer = await renderWithGateway(gateway);

  await openCallReport(renderer);
  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "통화 리포트 상세 닫기" })
      .props.onPress();
  });
  await openCallReport(renderer);

  expect(gateway.getCallReportStatus).toHaveBeenCalledTimes(1);
  expect(gateway.getCallReport).toHaveBeenCalledTimes(1);
  expect(isCallReportDetailVisible(renderer)).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "아침 식사와 가족 이야기를 나누셨어요."
  );
});

test("생성 중 상태는 캐시하지 않아 다시 열면 상태를 새로 확인한다", async () => {
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  gateway.getCallReportStatus.mockResolvedValue({
    callSessionId: "31",
    status: "generating",
  });
  const renderer = await renderWithGateway(gateway);

  await openCallReport(renderer);
  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "통화 리포트 상세 닫기" })
      .props.onPress();
  });
  await openCallReport(renderer);

  expect(gateway.getCallReportStatus).toHaveBeenCalledTimes(2);
});

test("캐시는 통화별로 분리되어 다른 통화는 그대로 조회한다", async () => {
  const gateway = createGateway();
  gateway.getDailyReport.mockResolvedValue({
    calls: [
      {
        callSessionId: "31",
        reportAvailable: true,
        startedAt: "2026-07-31T00:30:00Z",
      },
      {
        callSessionId: "32",
        reportAvailable: true,
        startedAt: "2026-07-31T02:10:00Z",
      },
    ],
    dailyReport: null,
    date: "2026-07-31",
    generationStatus: "available",
  });
  gateway.getCallReportStatus.mockImplementation(async (callSessionId) => ({
    callSessionId,
    status: "ready",
  }));
  gateway.getCallReport.mockImplementation(async (callSessionId) => ({
    ...readyCallReport(),
    callSessionId,
  }));
  const renderer = await renderWithGateway(gateway);

  await openCallReport(renderer);
  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "통화 리포트 상세 닫기" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: "11:10 통화 리포트 열기" })
      .props.onPress();
  });

  expect(gateway.getCallReport).toHaveBeenCalledTimes(2);
  expect(gateway.getCallReport).toHaveBeenLastCalledWith("32");
});

test("상세를 닫으면 예약된 상태 확인 타이머를 취소한다", async () => {
  jest.useFakeTimers();
  const gateway = createGateway();
  mockDailyReportWithCall(gateway);
  gateway.getCallReportStatus.mockResolvedValue({
    callSessionId: "31",
    status: "generating",
  });
  const renderer = await renderWithGateway(gateway);

  await openCallReport(renderer);
  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "통화 리포트 상세 닫기" })
      .props.onPress();
  });
  await TestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(10_000);
  });

  expect(gateway.getCallReportStatus).toHaveBeenCalledTimes(1);
  expect(isCallReportDetailVisible(renderer)).toBe(false);
});

test("피보호자를 바꾼 뒤 이전 통화의 늦은 응답을 무시한다", async () => {
  const gateway = createGateway();
  const targets = [
    { displayName: "김말순", memberId: "12" },
    { displayName: "이정희", memberId: "13" },
  ];
  gateway.getDailyReport.mockImplementation(async (_groupId, memberId) => ({
    calls: [
      {
        callSessionId: memberId === "12" ? "31" : "32",
        reportAvailable: true,
        startedAt: "2026-07-31T00:30:00Z",
      },
    ],
    dailyReport: null,
    date: "2026-07-31",
    generationStatus: "available",
  }));
  let resolveStatus:
    | ((value: { callSessionId: string; status: "ready" }) => void)
    | undefined;
  gateway.getCallReportStatus.mockImplementation(
    () =>
      new Promise<{ callSessionId: string; status: "ready" }>((resolve) => {
        resolveStatus = resolve;
      })
  );
  gateway.getCallReport.mockResolvedValue(readyCallReport());
  const renderer = await renderWithGateway(gateway, targets);

  await TestRenderer.act(async () => {
    renderer.root
      .findAllByProps({ accessibilityLabel: "09:30 통화 리포트 열기" })[0]
      .props.onPress();
    await Promise.resolve();
  });
  TestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: "care-receiver-report-pager" })
      .props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: 1_000_000 } },
      });
  });
  await TestRenderer.act(async () => {
    resolveStatus?.({ callSessionId: "31", status: "ready" });
  });

  expect(isCallReportDetailVisible(renderer)).toBe(false);
  expect(gateway.getCallReport).not.toHaveBeenCalled();
});
