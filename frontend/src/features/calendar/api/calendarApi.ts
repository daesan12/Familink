import type {AxiosInstance, AxiosRequestConfig} from "axios";

import {
  ApiError,
  apiClient,
  createApiClient,
  type ApiAuthSession,
  type ApiSuccess,
} from "../../../shared/api";
import {parseApiEnvelope} from "../../group-info/api/groupApi";
import type {
  CalendarEventDetail,
  CalendarEventSummary,
  CalendarEventWriteInput,
  CalendarGateway,
  CalendarMember,
  CalendarQuery,
} from "../types";

export type CalendarHttpClient = Pick<
  AxiosInstance,
  "delete" | "get" | "patch" | "post"
>;

interface CalendarHttpGatewayOptions {
  authSession?: ApiAuthSession;
  baseUrl?: string;
  client?: CalendarHttpClient;
}

/** 일정 도메인의 입력 검증 오류를 화면에서 구분할 수 있도록 유지하는 호환 오류다. */
export class CalendarApiError extends ApiError {
  constructor(message: string, status?: number) {
    super({
      code: "INVALID_API_RESPONSE",
      kind: "invalidResponse",
      message,
      status,
    });
  }
}

export function createCalendarHttpGateway({
  authSession,
  baseUrl,
  client,
}: CalendarHttpGatewayOptions): CalendarGateway {
  const httpClient =
    client ?? (baseUrl ? createApiClient(baseUrl, authSession) : apiClient);

  return {
    async createEvent(groupId, input, signal) {
      const response = await httpClient.post<ApiSuccess<unknown>>(
        `/groups/${encodeURIComponent(groupId)}/events`,
        toWriteBody(input),
        requestConfig(signal)
      );
      assertStatus(response.status, 201);
      return parseApiEnvelope(response.data, response.status, value =>
        readId(readObject(value, "일정 생성 응답").eventId, "일정 ID")
      );
    },
    async deleteEvent(eventId, signal) {
      const response = await httpClient.delete(
        `/events/${encodeURIComponent(eventId)}`,
        requestConfig(signal)
      );
      assertStatus(response.status, 204);
    },
    async getEvent(eventId, signal) {
      const response = await httpClient.get<ApiSuccess<unknown>>(
        `/events/${encodeURIComponent(eventId)}`,
        requestConfig(signal)
      );
      assertStatus(response.status, 200);
      return parseApiEnvelope(response.data, response.status, value =>
        readEventDetail(value)
      );
    },
    async listEvents(query: CalendarQuery) {
      const searchParams = [
        `startDate=${encodeURIComponent(query.startDate)}`,
        `endDate=${encodeURIComponent(query.endDate)}`,
      ].join("&");
      const response = await httpClient.get<ApiSuccess<unknown>>(
        `/groups/${encodeURIComponent(query.groupId)}/events?${searchParams}`,
        requestConfig(query.signal)
      );
      assertStatus(response.status, 200);
      return parseApiEnvelope(response.data, response.status, value => {
        const data = readObject(value, "일정 목록 응답");
        return readArray(data.events, "일정 목록").map(readEventSummary);
      });
    },
    async listMembers(groupId, signal) {
      const response = await httpClient.get<ApiSuccess<unknown>>(
        `/groups/${encodeURIComponent(groupId)}/members`,
        requestConfig(signal)
      );
      assertStatus(response.status, 200);
      return parseApiEnvelope(response.data, response.status, value => {
        const data = readObject(value, "구성원 목록 응답");
        return readArray(data.members, "구성원 목록").map(readMember);
      });
    },
    async updateEvent(eventId, input, signal) {
      const response = await httpClient.patch<ApiSuccess<unknown>>(
        `/events/${encodeURIComponent(eventId)}`,
        toWriteBody(input),
        requestConfig(signal)
      );
      assertStatus(response.status, 200);
      parseApiEnvelope(response.data, response.status, value =>
        readEventUpdateResponse(value)
      );
    },
  };
}

function toWriteBody(input: CalendarEventWriteInput): Record<string, unknown> {
  return {
    description: input.description,
    endAt: input.endAt,
    endDate: input.endDate,
    eventDate: input.eventDate,
    participantMemberIds: input.participantMemberIds.map(readMemberIdForWrite),
    startAt: input.startAt,
    title: input.title,
  };
}

function readMemberIdForWrite(value: string): number {
  const memberId = Number(value);
  if (!Number.isSafeInteger(memberId) || memberId <= 0) {
    throw new CalendarApiError("참여자 구성원 ID 형식이 올바르지 않아요.");
  }
  return memberId;
}

function readEventSummary(value: unknown): CalendarEventSummary {
  const item = readObject(value, "일정");
  return {
    endAt: readOptionalNullableString(item.endAt, "일정 종료 시각"),
    endDate: readString(item.endDate, "일정 종료 날짜"),
    eventDate: readString(item.eventDate, "일정 시작 날짜"),
    id: readId(item.id, "일정 ID"),
    startAt: readOptionalNullableString(item.startAt, "일정 시작 시각"),
    title: readString(item.title, "일정 제목"),
  };
}

function readEventDetail(value: unknown): CalendarEventDetail {
  const item = readObject(value, "일정 상세");
  return {
    ...readEventSummary(item),
    creatorMemberId: readId(item.creatorMemberId, "작성자 구성원 ID"),
    description:
      readOptionalNullableString(item.description, "일정 세부 내용") ?? "",
    groupId: readId(item.groupId, "그룹 ID"),
    participantMemberIds: readArray(
      item.participantMemberIds,
      "참여자 ID 목록"
    ).map((participantId) => readId(participantId, "참여자 구성원 ID")),
  };
}

function readEventUpdateResponse(value: unknown): {
  id: string;
  lastEditorMemberId: string;
  updatedAt: string;
} {
  const item = readObject(value, "일정 수정 응답");
  return {
    id: readId(item.id, "일정 ID"),
    lastEditorMemberId: readId(
      item.lastEditorMemberId,
      "최종 수정자 구성원 ID"
    ),
    updatedAt: readString(item.updatedAt, "일정 수정 시각"),
  };
}

function readMember(value: unknown): CalendarMember {
  const item = readObject(value, "구성원");
  return {
    displayName: readString(item.displayName, "구성원 이름"),
    isManager: readBoolean(item.isManager, "관리자 여부"),
    memberId: readId(item.memberId, "구성원 ID"),
    profileImageUrl: readOptionalNullableString(
      item.profileImageUrl,
      "프로필 이미지"
    ),
    role: readRole(item.role),
    userId: readId(item.userId, "사용자 ID"),
  };
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CalendarApiError(`${label} 형식이 올바르지 않아요.`);
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new CalendarApiError(`${label} 형식이 올바르지 않아요.`);
  }
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new CalendarApiError(`${label} 형식이 올바르지 않아요.`);
  }
  return value;
}

function readOptionalNullableString(
  value: unknown,
  label: string
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return readString(value, label);
}

function readId(value: unknown, label: string): string {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return value;
    }
  }
  throw new CalendarApiError(`${label} 형식이 올바르지 않아요.`);
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new CalendarApiError(`${label} 형식이 올바르지 않아요.`);
  }
  return value;
}

function readRole(value: unknown): CalendarMember["role"] {
  if (value === "guardian" || value === "GUARDIAN") {
    return "guardian";
  }
  if (value === "careReceiver" || value === "CARE_RECEIVER") {
    return "careReceiver";
  }
  throw new CalendarApiError("구성원 역할 형식이 올바르지 않아요.");
}

function requestConfig(signal?: AbortSignal): AxiosRequestConfig | undefined {
  return signal === undefined ? undefined : {signal};
}

function assertStatus(status: number, expectedStatus: number): void {
  if (status !== expectedStatus) {
    throw new CalendarApiError("일정 API 응답 상태가 올바르지 않아요.", status);
  }
}
