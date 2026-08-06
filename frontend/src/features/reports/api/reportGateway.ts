import {
  apiClient,
  createApiClient,
  normalizeApiError,
} from "../../../shared/api";
import type { ApiAuthSession } from "../../../shared/api";
import type {
  ApiSuccessResponseDto,
  CallReportResponseDto,
  CallReportStatusResponseDto,
  DailyReportGenerationResponseDto,
  DailyReportGenerationStatusDto,
  DailyReportResponseDto,
  ReportCalendarResponseDto,
} from "./reportDtos";
import type {
  CallReport,
  CallReportStatus,
  DailyReportGenerationResult,
  DailyReportGenerationStatus,
  DailyReportResult,
  ReportCalendar,
  ReportEmotionCategory,
  ReportGateway,
} from "../types";

export interface ReportHttpClient {
  get(path: string): Promise<{
    data: unknown;
    status: number;
  }>;
  post(path: string): Promise<{
    data: unknown;
    status: number;
  }>;
}

export interface ReportGatewayOptions {
  authSession?: ApiAuthSession;
  baseUrl?: string;
  client?: ReportHttpClient;
}

interface ReportHttpResponse {
  data: unknown;
  status: number;
}

const EMOTION_CATEGORIES: readonly ReportEmotionCategory[] = [
  "ANGER",
  "SADNESS",
  "ANXIETY",
  "HURT",
  "EMBARRASSMENT",
  "JOY",
  "NEUTRAL",
];

export class ReportGatewayError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ReportGatewayError";
    this.status = status;
    this.code = code;
  }
}

export function createReportGateway(
  options: ReportGatewayOptions = {}
): ReportGateway {
  const client =
    options.client ??
    (options.baseUrl === undefined && options.authSession === undefined
      ? apiClient
      : createApiClient(options.baseUrl, options.authSession));

  async function request(path: string): Promise<ReportHttpResponse> {
    return client.get(path);
  }

  async function requestData<T>(
    path: string,
    parseData: (value: unknown) => T
  ): Promise<T> {
    try {
      const response = await request(path);
      return parseSuccessEnvelope(response.data, parseData);
    } catch (error) {
      throw toGatewayError(error);
    }
  }

  async function postData<T>(
    path: string,
    parseData: (value: unknown) => T
  ): Promise<T> {
    try {
      const response = await client.post(path);
      return parseSuccessEnvelope(response.data, parseData);
    } catch (error) {
      throw toGatewayError(error);
    }
  }

  return {
    async getReportDates(groupId, memberId, year, month) {
      const query = `year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(
        String(month)
      )}`;
      return requestData(
        `/groups/${encodeURIComponent(
          groupId
        )}/care-receivers/${encodeURIComponent(
          memberId
        )}/reports/calendar?${query}`,
        parseReportCalendar
      );
    },

    async getDailyReport(groupId, memberId, reportDate) {
      return requestData(
        `/groups/${encodeURIComponent(
          groupId
        )}/members/${encodeURIComponent(
          memberId
        )}/reports/daily/${encodeURIComponent(reportDate)}`,
        parseDailyReport
      );
    },

    async requestDailyReportGeneration(groupId, memberId) {
      return postData(
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
          memberId
        )}/reports/daily/generation-requests`,
        parseDailyReportGeneration
      );
    },

    async getCallReport(callSessionId) {
      try {
        return await requestData(
          `/call-sessions/${encodeURIComponent(callSessionId)}/report`,
          parseCallReport
        );
      } catch (error) {
        const gatewayError = toGatewayError(error);
        if (
          gatewayError.status === 404 &&
          gatewayError.code === "CALL_REPORT_NOT_READY"
        ) {
          return {
            callSessionId,
            status: "generating",
          };
        }

        throw gatewayError;
      }
    },

    async getCallReportStatus(callSessionId) {
      return requestData(
        `/call-sessions/${encodeURIComponent(callSessionId)}/report/status`,
        parseCallReportStatus
      );
    },
  };
}

function parseSuccessEnvelope<T>(
  value: unknown,
  parseData: (data: unknown) => T
): T {
  const envelope = expectRecord(value, "성공 응답");
  if (envelope.success !== true) {
    throw invalidResponse("성공 응답의 success가 true가 아닙니다.");
  }
  const message = expectString(envelope.message, "성공 응답 message");

  const typedEnvelope: ApiSuccessResponseDto<unknown> = {
    data: envelope.data,
    message,
    success: true,
  };
  return parseData(typedEnvelope.data);
}

function parseReportCalendar(value: unknown): ReportCalendar {
  const dto = expectRecord(value, "리포트 캘린더");
  const reportDates = expectArray(dto.reportDates, "reportDates").map(
    (date, index) => expectString(date, `reportDates[${index}]`)
  );
  const responseDto: ReportCalendarResponseDto = {
    latestReportDate: expectNullableString(
      dto.latestReportDate,
      "latestReportDate"
    ),
    reportDates,
    yearMonth: expectString(dto.yearMonth, "yearMonth"),
  };

  return responseDto;
}

function parseDailyReport(value: unknown): DailyReportResult {
  const dto = expectRecord(value, "일간 리포트");
  const calls = expectArray(dto.calls, "calls").map((call, index) => {
    const item = expectRecord(call, `calls[${index}]`);
    return {
      callSessionId: expectNumber(
        item.callSessionId,
        `calls[${index}].callSessionId`
      ),
      reportAvailable: expectBoolean(
        item.reportAvailable,
        `calls[${index}].reportAvailable`
      ),
      startedAt: expectString(item.startedAt, `calls[${index}].startedAt`),
    };
  });

  let dailyReport: DailyReportResponseDto["dailyReport"] = null;
  if (dto.dailyReport !== null) {
    const report = expectRecord(dto.dailyReport, "dailyReport");
    dailyReport = {
      emotionCategory: expectEmotionCategory(report.emotionCategory),
      emotionSubcategory: expectString(
        report.emotionSubcategory,
        "dailyReport.emotionSubcategory"
      ),
      guardianMessageSummary: expectNullableString(
        report.guardianMessageSummary,
        "dailyReport.guardianMessageSummary"
      ),
      id: expectNumber(report.id, "dailyReport.id"),
      summary: expectString(report.summary, "dailyReport.summary"),
    };
  }

  const responseDto: DailyReportResponseDto = {
    calls,
    dailyReport,
    date: expectString(dto.date, "date"),
    generationStatus: expectDailyReportGenerationStatus(dto.generationStatus),
  };
  const mappedCalls = responseDto.calls.map((call) => ({
    ...call,
    callSessionId: String(call.callSessionId),
  }));

  return {
    calls: mappedCalls,
    dailyReport: responseDto.dailyReport
      ? {
          ...responseDto.dailyReport,
          id: String(responseDto.dailyReport.id),
        }
      : null,
    date: responseDto.date,
    generationStatus: toDailyReportGenerationStatus(
      responseDto.generationStatus
    ),
  };
}

function parseDailyReportGeneration(value: unknown): DailyReportGenerationResult {
  const dto = expectRecord(value, "일간 리포트 생성 요청");
  const responseDto: DailyReportGenerationResponseDto = {
    generationStatus: expectReadyOrGeneratingStatus(dto.generationStatus),
    reportDate: expectString(dto.reportDate, "reportDate"),
  };
  return {
    generationStatus:
      responseDto.generationStatus === "READY" ? "ready" : "generating",
    reportDate: responseDto.reportDate,
  };
}

function parseCallReport(value: unknown): CallReport {
  const dto = expectRecord(value, "건별 리포트");
  const responseDto: CallReportResponseDto = {
    callSessionId: expectNumber(dto.callSessionId, "callSessionId"),
    createdAt: expectString(dto.createdAt, "createdAt"),
    guardianMessage: expectNullableString(
      dto.guardianMessage,
      "guardianMessage"
    ),
    summary: expectString(dto.summary, "summary"),
  };

  return {
    ...responseDto,
    callSessionId: String(responseDto.callSessionId),
    status: "ready",
  };
}

function parseCallReportStatus(value: unknown): CallReportStatus {
  const dto = expectRecord(value, "건별 리포트 상태");
  const status = expectString(dto.status, "status");
  if (
    status !== "READY" &&
    status !== "GENERATING" &&
    status !== "FAILED" &&
    status !== "UNAVAILABLE"
  ) {
    throw invalidResponse(`지원하지 않는 건별 리포트 상태입니다: ${status}`);
  }

  const responseDto: CallReportStatusResponseDto = {
    callSessionId: expectNumber(dto.callSessionId, "callSessionId"),
    status,
  };
  return {
    callSessionId: String(responseDto.callSessionId),
    status: responseDto.status.toLowerCase() as CallReportStatus["status"],
  };
}

function toGatewayError(error: unknown): ReportGatewayError {
  if (error instanceof ReportGatewayError) {
    return error;
  }

  const apiError = normalizeApiError(error);
  return new ReportGatewayError(
    apiError.status ?? 0,
    apiError.code,
    apiError.message
  );
}

function expectRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidResponse(`${field}가 객체가 아닙니다.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw invalidResponse(`${field}가 배열이 아닙니다.`);
  }
  return value;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw invalidResponse(`${field}가 문자열이 아닙니다.`);
  }
  return value;
}

function expectNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  return expectString(value, field);
}

function expectNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidResponse(`${field}가 숫자가 아닙니다.`);
  }
  return value;
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw invalidResponse(`${field}가 boolean이 아닙니다.`);
  }
  return value;
}

function expectEmotionCategory(value: unknown): ReportEmotionCategory {
  if (
    typeof value !== "string" ||
    !EMOTION_CATEGORIES.includes(value as ReportEmotionCategory)
  ) {
    throw invalidResponse("dailyReport.emotionCategory가 유효하지 않습니다.");
  }
  return value as ReportEmotionCategory;
}

function expectDailyReportGenerationStatus(
  value: unknown
): DailyReportGenerationStatusDto {
  if (
    value !== "NOT_READY" &&
    value !== "AVAILABLE" &&
    value !== "GENERATING" &&
    value !== "READY"
  ) {
    throw invalidResponse(`지원하지 않는 일간 리포트 상태입니다: ${String(value)}`);
  }
  return value;
}

function expectReadyOrGeneratingStatus(
  value: unknown
): "GENERATING" | "READY" {
  const status = expectDailyReportGenerationStatus(value);
  if (status !== "GENERATING" && status !== "READY") {
    throw invalidResponse(`지원하지 않는 생성 요청 상태입니다: ${status}`);
  }
  return status;
}

function toDailyReportGenerationStatus(
  status: DailyReportGenerationStatusDto
): DailyReportGenerationStatus {
  switch (status) {
    case "NOT_READY":
      return "notReady";
    case "AVAILABLE":
      return "available";
    case "GENERATING":
      return "generating";
    case "READY":
      return "ready";
  }
}

function invalidResponse(message: string): ReportGatewayError {
  return new ReportGatewayError(200, "INVALID_RESPONSE", message);
}
