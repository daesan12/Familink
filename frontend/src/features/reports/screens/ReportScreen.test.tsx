import React from "react";
import {
  NavigationContainer,
  useNavigation,
  type NavigationProp,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {Dimensions, Pressable, StyleSheet} from "react-native";
import TestRenderer from "react-test-renderer";

import type {MainTabsParamList} from "../../../app-shell";
import {
  DAILY_PENDING_REPORT_PAGE,
  EMPTY_REPORT_PAGE,
} from "../fixtures/reportFixtures";
import type { CareReceiverReportPage } from "../types";
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

function withReportRoute(element: React.ReactElement) {
  return (
    <NavigationContainer>
      <RouteStack.Navigator screenOptions={{ headerShown: false }}>
        <RouteStack.Screen name="report">
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

function renderReportScreen(careReceivers: readonly CareReceiverReportPage[]) {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      withReportRoute(
        <ReportScreen
          careReceivers={careReceivers}
          currentGroup={currentGroup}
          role="guardian"
        />
      )
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
    selectedDateGenerationStatus: "notReady",
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

test("상태 API가 없는 fixture에서 생성 대상이 아닌 통화는 생성 불가로 표시한다", () => {
  const renderer = renderReportScreen([DAILY_PENDING_REPORT_PAGE]);

  TestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: "18:30 통화 리포트 상태 확인" })
      .props.onPress();
  });

  expect(JSON.stringify(renderer.toJSON())).toContain(
    "생성할 수 없는 리포트예요"
  );
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
  expect(tree).toContain("10시 32분 통화리포트");
  expect(tree).toContain("오늘 아침 식사와 날씨에 관해 이야기하셨어요.");
  expect(tree).not.toContain("전달하신 말씀");
});

// 통화 4건은 화면 너비를 넘겨 가로 스크롤이 필요한 대표 상황이다.
function createFourCallPage(): CareReceiverReportPage {
  return {
    ...createLatestOnlyPage(),
    todayCalls: [1, 2, 3, 4].map((index) => ({
      callSessionId: `call-${index}`,
      guardianMessage: null,
      reportAvailable: true,
      reportDateLabel: "2026.07.18",
      startedAtLabel: `1${index}:00`,
      summary: `${index}번째 통화 요약`,
    })),
  };
}

function callList(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({ testID: "call-report-list" });
}

// 가로 ScrollView를 가로 페이저 안에 두면 Android가 제스처를 페이저에 넘겨
// 목록이 스크롤되지 않는다. 가로 스크롤을 쓰지 않는다는 것을 고정한다.
test("통화 목록은 가로 스크롤 대신 줄바꿈으로 쌓는다", () => {
  const renderer = renderReportScreen([createFourCallPage()]);
  const list = callList(renderer);
  const style = StyleSheet.flatten(list.props.style);

  expect(list.props.horizontal).toBeUndefined();
  expect(style.flexWrap).toBe("wrap");
  expect(style.flexDirection).toBe("row");
});

test("통화가 4건이어도 모든 건별 리포트를 그린다", () => {
  const renderer = renderReportScreen([createFourCallPage()]);

  ["11:00", "12:00", "13:00", "14:00"].forEach((label) => {
    expect(
      renderer.root.findByProps({
        accessibilityLabel: `${label} 통화 리포트 열기`,
      })
    ).toBeTruthy();
  });
});

// 카드 좌우 끝이 일간 리포트 카드와 나란해야 한다. 페이지 여백 24를 뺀 폭에서
// 카드 사이 간격 14 두 칸을 빼고 3등분한 값이 카드 폭이다.
test("건별 카드 폭은 페이지 여백을 뺀 폭을 3등분한 값이다", () => {
  const {width} = Dimensions.get("window");
  const expected = Math.floor((width - 24 * 2 - 14 * 2) / 3);
  const renderer = renderReportScreen([createFourCallPage()]);

  ["11:00", "12:00", "13:00", "14:00"].forEach((label) => {
    const card = renderer.root.findByProps({
      accessibilityLabel: `${label} 통화 리포트 열기`,
    });
    const style = StyleSheet.flatten(card.props.style({ pressed: false }));

    expect(style.width).toBe(expected);
  });
});

// 통화가 3건 미만이어도 카드가 줄을 채우려고 늘어나면 안 된다.
test("통화가 한 건이면 카드 폭이 줄 전체로 늘어나지 않는다", () => {
  const {width} = Dimensions.get("window");
  const page: CareReceiverReportPage = {
    ...createLatestOnlyPage(),
    todayCalls: [
      {
        callSessionId: "call-1",
        guardianMessage: null,
        reportAvailable: true,
        reportDateLabel: "2026.07.18",
        startedAtLabel: "10:32",
        summary: "요약",
      },
    ],
  };
  const renderer = renderReportScreen([page]);
  const card = renderer.root.findByProps({
    accessibilityLabel: "10:32 통화 리포트 열기",
  });
  const style = StyleSheet.flatten(card.props.style({ pressed: false }));

  expect(style.width).toBe(Math.floor((width - 24 * 2 - 14 * 2) / 3));
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
      withReportRoute(
        <ReportScreen
          careReceivers={[firstPage]}
          currentGroup={currentGroup}
          role="guardian"
        />
      )
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
      withReportRoute(
        <ReportScreen
          currentGroup={{
            id: "development-empty-group",
            name: "빈 그룹",
            role: "guardian",
          }}
          role="guardian"
        />
      )
    );
  });

  const tree = JSON.stringify(renderer!.toJSON());
  expect(tree).toContain("리포트를 확인할 피보호자가 없어요");
  expect(tree).not.toContain("손수호");
  expect(tree).not.toContain("김말순");
});
