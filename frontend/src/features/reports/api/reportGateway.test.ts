import {
  createReportGateway,
  ReportGatewayError,
  type ReportHttpClient,
} from "./reportGateway";
import { ApiError } from "../../../shared/api";

function createClient(payload: unknown): jest.Mocked<ReportHttpClient> {
  return {
    get: jest.fn().mockResolvedValue({ data: payload, status: 200 }),
  };
}

function createServerError(
  status: number,
  code: string,
  message: string
): ApiError {
  return new ApiError({ code, kind: "server", message, status });
}

function success(data: unknown) {
  return {
    data,
    message: "조회 성공",
    success: true,
  };
}

test("리포트 캘린더 경로를 공통 API 클라이언트에 계약대로 전달한다", async () => {
  const client = createClient(
    success({
      latestReportDate: "2026-06-30",
      reportDates: ["2026-07-01", "2026-07-17"],
      yearMonth: "2026-07",
    })
  );
  const gateway = createReportGateway({
    client,
  });

  await expect(
    gateway.getReportDates("group 1", "member/2", 2026, 7)
  ).resolves.toEqual({
    latestReportDate: "2026-06-30",
    reportDates: ["2026-07-01", "2026-07-17"],
    yearMonth: "2026-07",
  });
  expect(client.get).toHaveBeenCalledWith(
    "/groups/group%201/care-receivers/member%2F2/reports/calendar?year=2026&month=7"
  );
});

test("일간 DTO의 null과 숫자 ID를 도메인 결과로 정확히 변환한다", async () => {
  const client = createClient(
    success({
        calls: [
          {
            callSessionId: 31,
            reportAvailable: true,
            startedAt: "2026-07-31T00:30:00Z",
          },
        ],
        dailyReport: {
          emotionCategory: "JOY",
          emotionSubcategory: "즐거움",
          guardianMessageSummary: null,
          id: 7,
          summary: "가족 이야기를 나누셨어요.",
        },
        date: "2026-07-31",
      })
  );
  const gateway = createReportGateway({ client });

  await expect(
    gateway.getDailyReport("1", "2", "2026-07-31")
  ).resolves.toEqual({
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
      summary: "가족 이야기를 나누셨어요.",
    },
    date: "2026-07-31",
    status: "ready",
  });
});

test("통화만 있고 일간 리포트가 null이면 생성 중으로 변환한다", async () => {
  const client = createClient(
    success({
        calls: [
          {
            callSessionId: 31,
            reportAvailable: false,
            startedAt: "2026-07-31T00:30:00Z",
          },
        ],
        dailyReport: null,
        date: "2026-07-31",
      })
  );
  const gateway = createReportGateway({ client });

  await expect(
    gateway.getDailyReport("1", "2", "2026-07-31")
  ).resolves.toMatchObject({
    dailyReport: null,
    status: "generating",
  });
});

test("통화와 일간 리포트가 모두 없으면 통화 없음으로 변환한다", async () => {
  const client = createClient(
    success({
        calls: [],
        dailyReport: null,
        date: "2026-07-31",
      })
  );
  const gateway = createReportGateway({ client });

  await expect(
    gateway.getDailyReport("1", "2", "2026-07-31")
  ).resolves.toEqual({
    calls: [],
    dailyReport: null,
    date: "2026-07-31",
    status: "noCalls",
  });
});

test("CALL_REPORT_NOT_READY 404는 일반 오류가 아닌 생성 중으로 변환한다", async () => {
  const client: jest.Mocked<ReportHttpClient> = {
    get: jest.fn().mockRejectedValue(
      createServerError(
        404,
        "CALL_REPORT_NOT_READY",
        "아직 리포트가 준비되지 않았습니다."
      )
    ),
  };
  const gateway = createReportGateway({ client });

  await expect(gateway.getCallReport("31")).resolves.toEqual({
    callSessionId: "31",
    status: "generating",
  });
});

test("그 밖의 조회 실패는 상태와 오류 코드를 보존해 거부한다", async () => {
  const client: jest.Mocked<ReportHttpClient> = {
    get: jest
      .fn()
      .mockRejectedValue(
        createServerError(403, "FORBIDDEN", "조회 권한이 없습니다.")
      ),
  };
  const gateway = createReportGateway({ client });

  const request = gateway.getCallReport("31");
  await expect(request).rejects.toBeInstanceOf(ReportGatewayError);
  await expect(request).rejects.toMatchObject({
    code: "FORBIDDEN",
    status: 403,
  });
});

test("성공 응답 필드가 계약과 다르면 렌더링 전에 차단한다", async () => {
  const client = createClient(
    success({
        calls: "not-an-array",
        dailyReport: null,
        date: "2026-07-31",
      })
  );
  const gateway = createReportGateway({ client });

  await expect(
    gateway.getDailyReport("1", "2", "2026-07-31")
  ).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});

test("건별 리포트 상태를 도메인 상태로 변환한다", async () => {
  const client = createClient(
    success({
      callSessionId: 31,
      status: "GENERATING",
    })
  );
  const gateway = createReportGateway({ client });

  await expect(gateway.getCallReportStatus("31")).resolves.toEqual({
    callSessionId: "31",
    status: "generating",
  });
  expect(client.get).toHaveBeenCalledWith(
    "/call-sessions/31/report/status"
  );
});

test("알 수 없는 건별 리포트 상태는 렌더링 전에 거부한다", async () => {
  const client = createClient(
    success({
      callSessionId: 31,
      status: "RETRYING",
    })
  );
  const gateway = createReportGateway({ client });

  await expect(gateway.getCallReportStatus("31")).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});
