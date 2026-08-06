import type { ReportEmotionCategory } from "../types";

export interface ApiSuccessResponseDto<T> {
  data: T;
  message: string;
  success: true;
}

export interface ApiErrorResponseDto {
  code: string;
  errors: readonly {
    field: string;
    message: string;
  }[];
  message: string;
  success: false;
}

export interface ReportCalendarResponseDto {
  latestReportDate: string | null;
  reportDates: string[];
  yearMonth: string;
}

export interface DailyReportResponseDto {
  calls: {
    callSessionId: number;
    reportAvailable: boolean;
    startedAt: string;
  }[];
  dailyReport: {
    emotionCategory: ReportEmotionCategory;
    emotionSubcategory: string;
    guardianMessageSummary: string | null;
    id: number;
    summary: string;
  } | null;
  date: string;
  generationStatus: DailyReportGenerationStatusDto;
}

export type DailyReportGenerationStatusDto =
  | "NOT_READY"
  | "AVAILABLE"
  | "GENERATING"
  | "READY";

export interface DailyReportGenerationResponseDto {
  generationStatus: "GENERATING" | "READY";
  reportDate: string;
}

export interface CallReportResponseDto {
  callSessionId: number;
  createdAt: string;
  guardianMessage: string | null;
  summary: string;
}

export interface CallReportStatusResponseDto {
  callSessionId: number;
  status: "READY" | "GENERATING" | "FAILED" | "UNAVAILABLE";
}
