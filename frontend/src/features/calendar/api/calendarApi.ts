import type {
  CalendarEventDetail,
  CalendarEventSummary,
  CalendarGateway,
  CalendarMember,
  CalendarQuery,
} from "../types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface CalendarHttpGatewayOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
  getAccessToken: () => Promise<string | null> | string | null;
}

interface ApiEnvelope {
  data: unknown;
  message: string;
  success: boolean;
}

export class CalendarApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "CalendarApiError";
    this.status = status;
  }
}

export function createCalendarHttpGateway({
  baseUrl,
  fetchImpl = fetch,
  getAccessToken,
}: CalendarHttpGatewayOptions): CalendarGateway {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  const request = async (
    path: string,
    signal?: AbortSignal,
    method = "GET"
  ): Promise<unknown> => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new CalendarApiError(
        "로그인 연결이 필요해 일정을 불러오지 못했어요.",
        401
      );
    }
    if (!normalizedBaseUrl) {
      throw new CalendarApiError("일정 API 주소가 설정되지 않았어요.");
    }

    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      method,
      signal,
    });

    if (!response.ok) {
      throw new CalendarApiError(
        await readErrorMessage(response),
        response.status
      );
    }

    if (response.status === 204) {
      return null;
    }

    const envelope = readEnvelope(await response.json());
    if (!envelope.success) {
      throw new CalendarApiError(envelope.message, response.status);
    }
    return envelope.data;
  };

  return {
    async deleteEvent(eventId, signal) {
      await request(`/events/${encodeURIComponent(eventId)}`, signal, "DELETE");
    },
    async getEvent(eventId, signal) {
      const data = readObject(
        await request(`/events/${encodeURIComponent(eventId)}`, signal),
        "일정 상세 응답"
      );
      return readEventDetail(data);
    },
    async listEvents(query: CalendarQuery) {
      const searchParams = [
        `startDate=${encodeURIComponent(query.startDate)}`,
        `endDate=${encodeURIComponent(query.endDate)}`,
      ].join("&");
      const data = readObject(
        await request(
          `/groups/${encodeURIComponent(query.groupId)}/events?${searchParams}`,
          query.signal
        ),
        "일정 목록 응답"
      );
      return readArray(data.events, "일정 목록").map(readEventSummary);
    },
    async listMembers(groupId, signal) {
      const data = readObject(
        await request(`/groups/${encodeURIComponent(groupId)}/members`, signal),
        "구성원 목록 응답"
      );
      return readArray(data.members, "구성원 목록").map(readMember);
    },
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = readObject(await response.json(), "오류 응답");
    return typeof body.message === "string"
      ? body.message
      : "일정을 불러오지 못했어요.";
  } catch {
    return "일정을 불러오지 못했어요.";
  }
}

function readEnvelope(value: unknown): ApiEnvelope {
  const envelope = readObject(value, "API 응답");
  if (
    typeof envelope.success !== "boolean" ||
    typeof envelope.message !== "string" ||
    !("data" in envelope)
  ) {
    throw new CalendarApiError("일정 API 응답 형식이 올바르지 않아요.");
  }
  return {
    data: envelope.data,
    message: envelope.message,
    success: envelope.success,
  };
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
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return readString(value, label);
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
