import type {AxiosResponse} from "axios";

import {ApiError} from "../../../shared/api";
import {
  CalendarApiError,
  createCalendarHttpGateway,
  type CalendarHttpClient,
} from "./calendarApi";

function response(data: unknown, status = 200): AxiosResponse<unknown> {
  return {
    config: {},
    data,
    headers: {},
    status,
    statusText: "",
  } as AxiosResponse<unknown>;
}

function success(data: unknown, status = 200): AxiosResponse<unknown> {
  return response(
    {
      data,
      message: "일정 조회 성공",
      success: true,
    },
    status
  );
}

function createClient(): jest.Mocked<CalendarHttpClient> {
  return {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  } as unknown as jest.Mocked<CalendarHttpClient>;
}

test("조회 구간과 신호를 공통 API 클라이언트에 전달한다", async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      events: [
        {
          endAt: null,
          endDate: "2026-08-02",
          eventDate: "2026-07-31",
          id: 12,
          startAt: null,
          title: "여름 휴가",
        },
      ],
    })
  );
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com",
    client,
  });
  const controller = new AbortController();

  await expect(
    gateway.listEvents({
      endDate: "2026-08-08",
      groupId: "3",
      signal: controller.signal,
      startDate: "2026-06-28",
    })
  ).resolves.toEqual([
    {
      endAt: null,
      endDate: "2026-08-02",
      eventDate: "2026-07-31",
      id: "12",
      startAt: null,
      title: "여름 휴가",
    },
  ]);
  expect(client.get).toHaveBeenCalledWith(
    "/groups/3/events?startDate=2026-06-28&endDate=2026-08-08",
    {signal: controller.signal}
  );
});

test("상세와 구성원 API 응답을 화면 모델로 변환한다", async () => {
  const client = createClient();
  client.get
    .mockResolvedValueOnce(
      success({
        creatorDisplayName: "탈퇴한 사용자",
        creatorMemberId: 7,
        description: "병원 정기 검진",
        endAt: "2026-07-31T07:00:00Z",
        endDate: "2026-07-31",
        eventDate: "2026-07-31",
        groupId: 3,
        id: 12,
        participantMemberIds: [8],
        startAt: "2026-07-31T06:00:00Z",
        title: "정기 검진",
      })
    )
    .mockResolvedValueOnce(
      success({
        members: [
          {
            displayName: "홍유라",
            isManager: false,
            memberId: 8,
            role: "GUARDIAN",
            userId: 4,
          },
        ],
      })
    );
  const gateway = createCalendarHttpGateway({client});

  await expect(gateway.getEvent("12")).resolves.toMatchObject({
    creatorDisplayName: "탈퇴한 사용자",
    creatorMemberId: "7",
    id: "12",
    participantMemberIds: ["8"],
  });
  await expect(gateway.listMembers("3")).resolves.toEqual([
    {
      displayName: "홍유라",
      isManager: false,
      memberId: "8",
      profileImageUrl: null,
      role: "guardian",
      userId: "4",
    },
  ]);
});

test("종일 일정의 시작·종료 시각 필드 생략을 null로 변환한다", async () => {
  const allDaySummary = {
    endDate: "2026-08-02",
    eventDate: "2026-07-31",
    id: 12,
    title: "여름 휴가",
  };
  const client = createClient();
  client.get
    .mockResolvedValueOnce(success({events: [allDaySummary]}))
    .mockResolvedValueOnce(
      success({
        ...allDaySummary,
        creatorMemberId: 7,
        groupId: 3,
        participantMemberIds: [],
      })
    );
  const gateway = createCalendarHttpGateway({client});

  await expect(
    gateway.listEvents({
      endDate: "2026-08-08",
      groupId: "3",
      startDate: "2026-06-28",
    })
  ).resolves.toEqual([
    expect.objectContaining({endAt: null, id: "12", startAt: null}),
  ]);
  await expect(gateway.getEvent("12")).resolves.toEqual(
    expect.objectContaining({endAt: null, id: "12", startAt: null})
  );
});

test("일정 상세 조회는 API-002 경로와 200 상태를 검증한다", async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      creatorMemberId: 7,
      endAt: null,
      endDate: "2026-08-01",
      eventDate: "2026-08-01",
      groupId: 3,
      id: 12,
      participantMemberIds: [],
      startAt: null,
      title: "가족 모임",
    })
  );
  const gateway = createCalendarHttpGateway({client});

  await expect(gateway.getEvent("12")).resolves.toMatchObject({
    groupId: "3",
    id: "12",
    title: "가족 모임",
  });
  expect(client.get).toHaveBeenCalledWith("/events/12", undefined);
});

test("일정 삭제 API를 호출하고 204 응답을 성공으로 처리한다", async () => {
  const client = createClient();
  client.delete.mockResolvedValueOnce(response(null, 204));
  const gateway = createCalendarHttpGateway({client});

  await expect(gateway.deleteEvent("12")).resolves.toBeUndefined();
  expect(client.delete).toHaveBeenCalledWith("/events/12", undefined);
});

test("일정 생성 API에 전체 폼과 숫자 참여자 ID를 전송한다", async () => {
  const client = createClient();
  client.post.mockResolvedValueOnce(
    success({createdAt: "2026-07-31T06:00:00Z", eventId: 15}, 201)
  );
  const gateway = createCalendarHttpGateway({client});

  await expect(
    gateway.createEvent("3", {
      description: "정기 검진",
      endAt: "2026-07-31T07:00:00.000Z",
      endDate: "2026-07-31",
      eventDate: "2026-07-31",
      participantMemberIds: ["7", "8"],
      startAt: "2026-07-31T06:00:00.000Z",
      title: "병원",
    })
  ).resolves.toBe("15");
  expect(client.post).toHaveBeenCalledWith(
    "/groups/3/events",
    {
      description: "정기 검진",
      endAt: "2026-07-31T07:00:00.000Z",
      endDate: "2026-07-31",
      eventDate: "2026-07-31",
      participantMemberIds: [7, 8],
      startAt: "2026-07-31T06:00:00.000Z",
      title: "병원",
    },
    undefined
  );
});

test("일정 수정 API에 전체 폼을 PATCH로 전송한다", async () => {
  const client = createClient();
  client.patch.mockResolvedValueOnce(
    success({id: 15, lastEditorMemberId: 7, updatedAt: "2026-07-31T06:00:00Z"})
  );
  const gateway = createCalendarHttpGateway({client});

  await expect(
    gateway.updateEvent("15", {
      description: null,
      endAt: null,
      endDate: "2026-08-01",
      eventDate: "2026-07-31",
      participantMemberIds: [],
      startAt: null,
      title: "가족 여행",
    })
  ).resolves.toBeUndefined();
  expect(client.patch).toHaveBeenCalledWith(
    "/events/15",
    expect.objectContaining({title: "가족 여행"}),
    undefined
  );
});

test("공통 API 클라이언트가 반환한 인증 오류를 그대로 전달한다", async () => {
  const client = createClient();
  const error = new ApiError({
    code: "UNAUTHORIZED",
    kind: "server",
    message: "인증이 필요합니다.",
    status: 401,
  });
  client.get.mockRejectedValueOnce(error);
  const gateway = createCalendarHttpGateway({client});

  await expect(
    gateway.listEvents({
      endDate: "2026-07-31",
      groupId: "3",
      startDate: "2026-07-01",
    })
  ).rejects.toBe(error);
});

test("계약과 다른 응답은 조용히 목업으로 대체하지 않고 오류로 처리한다", async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(success({events: [{id: 1}]}));
  const gateway = createCalendarHttpGateway({client});

  await expect(
    gateway.listEvents({
      endDate: "2026-07-31",
      groupId: "3",
      startDate: "2026-07-01",
    })
  ).rejects.toBeInstanceOf(CalendarApiError);
});

test("작성자 이름이 없는 구버전 서버 응답을 null로 변환한다", async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      creatorMemberId: 7,
      endAt: null,
      endDate: "2026-07-31",
      eventDate: "2026-07-31",
      groupId: 3,
      id: 12,
      participantMemberIds: [],
      startAt: null,
      title: "가족 모임",
    })
  );
  const gateway = createCalendarHttpGateway({client});

  await expect(gateway.getEvent("12")).resolves.toMatchObject({
    creatorDisplayName: null,
  });
});

test("작성자 이름이 문자열이 아니면 거부한다", async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      creatorDisplayName: 7,
      creatorMemberId: 7,
      endAt: null,
      endDate: "2026-07-31",
      eventDate: "2026-07-31",
      groupId: 3,
      id: 12,
      participantMemberIds: [],
      startAt: null,
      title: "가족 모임",
    })
  );
  const gateway = createCalendarHttpGateway({client});

  await expect(gateway.getEvent("12")).rejects.toBeInstanceOf(
    CalendarApiError
  );
});

test("상세 응답의 잘못된 식별자를 거부한다", async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      creatorMemberId: "member-7",
      endAt: null,
      endDate: "2026-07-31",
      eventDate: "2026-07-31",
      groupId: 3,
      id: 12,
      participantMemberIds: [],
      startAt: null,
      title: "잘못된 응답",
    })
  );
  const gateway = createCalendarHttpGateway({client});

  await expect(gateway.getEvent("12")).rejects.toBeInstanceOf(
    CalendarApiError
  );
});

test("일정 수정 응답에 API-CALENDAR-004 필드가 없으면 거부한다", async () => {
  const client = createClient();
  client.patch.mockResolvedValueOnce(
    success({id: 15, updatedAt: "2026-07-31T06:00:00Z"})
  );
  const gateway = createCalendarHttpGateway({client});

  await expect(
    gateway.updateEvent("15", {
      description: null,
      endAt: null,
      endDate: "2026-08-01",
      eventDate: "2026-07-31",
      participantMemberIds: [],
      startAt: null,
      title: "가족 모임",
    })
  ).rejects.toBeInstanceOf(CalendarApiError);
});

test.each([null, undefined])(
  "normalizes an absent event description to an empty string",
  async description => {
    const data: Record<string, unknown> = {
      creatorMemberId: 7,
      endAt: null,
      endDate: "2026-07-31",
      eventDate: "2026-07-31",
      groupId: 3,
      id: 12,
      participantMemberIds: [],
      startAt: null,
      title: "Event without description",
    };
    if (description !== undefined) {
      data.description = description;
    }
    const client = createClient();
    client.get.mockResolvedValueOnce(success(data));
    const gateway = createCalendarHttpGateway({client});

    await expect(gateway.getEvent("12")).resolves.toMatchObject({
      description: "",
      id: "12",
    });
  }
);
