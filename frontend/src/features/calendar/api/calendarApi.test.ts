import { CalendarApiError, createCalendarHttpGateway } from "./calendarApi";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

test("조회 구간과 Bearer 토큰으로 일정 목록 API를 호출한다", async () => {
  const fetchImpl = jest.fn(async () =>
    jsonResponse({
      data: {
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
      },
      message: "일정 목록 조회 성공",
      success: true,
    })
  );
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com/",
    fetchImpl,
    getAccessToken: () => "access-token",
  });

  await expect(
    gateway.listEvents({
      endDate: "2026-08-08",
      groupId: "3",
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
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://api.example.com/groups/3/events?startDate=2026-06-28&endDate=2026-08-08",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer access-token",
      }),
    })
  );
});

test("상세와 구성원 API 응답을 화면 모델로 변환한다", async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(
      jsonResponse({
        data: {
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
        },
        message: "일정 상세 조회 성공",
        success: true,
      })
    )
    .mockResolvedValueOnce(
      jsonResponse({
        data: {
          members: [
            {
              displayName: "홍유라",
              isManager: false,
              memberId: 8,
              role: "GUARDIAN",
              userId: 4,
            },
          ],
        },
        message: "구성원 목록 조회 성공",
        success: true,
      })
    );
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com",
    fetchImpl,
    getAccessToken: () => "token",
  });

  await expect(gateway.getEvent("12")).resolves.toMatchObject({
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
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(
      jsonResponse({
        data: { events: [allDaySummary] },
        message: "일정 목록 조회 성공",
        success: true,
      })
    )
    .mockResolvedValueOnce(
      jsonResponse({
        data: {
          ...allDaySummary,
          creatorMemberId: 7,
          groupId: 3,
          participantMemberIds: [],
        },
        message: "일정 상세 조회 성공",
        success: true,
      })
    );
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com",
    fetchImpl,
    getAccessToken: () => "token",
  });

  await expect(
    gateway.listEvents({
      endDate: "2026-08-08",
      groupId: "3",
      startDate: "2026-06-28",
    })
  ).resolves.toEqual([
    expect.objectContaining({ endAt: null, id: "12", startAt: null }),
  ]);
  await expect(gateway.getEvent("12")).resolves.toEqual(
    expect.objectContaining({ endAt: null, id: "12", startAt: null })
  );
});

test("일정 삭제 API를 호출하고 204 응답을 성공으로 처리한다", async () => {
  const fetchImpl = jest.fn(async () => jsonResponse(null, 204));
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com",
    fetchImpl,
    getAccessToken: () => "token",
  });

  await expect(gateway.deleteEvent("12")).resolves.toBeUndefined();
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://api.example.com/events/12",
    expect.objectContaining({ method: "DELETE" })
  );
});

test("일정 생성 API에 전체 폼과 숫자 참여자 ID를 전송한다", async () => {
  const fetchImpl = jest.fn(async () =>
    jsonResponse(
      {
        data: { createdAt: "2026-07-31T06:00:00Z", eventId: 15 },
        message: "일정 생성 성공",
        success: true,
      },
      201
    )
  );
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com",
    fetchImpl,
    getAccessToken: () => "token",
  });

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
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://api.example.com/groups/3/events",
    expect.objectContaining({
      body: JSON.stringify({
        description: "정기 검진",
        endAt: "2026-07-31T07:00:00.000Z",
        endDate: "2026-07-31",
        eventDate: "2026-07-31",
        participantMemberIds: [7, 8],
        startAt: "2026-07-31T06:00:00.000Z",
        title: "병원",
      }),
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
      method: "POST",
    })
  );
});

test("일정 수정 API에 전체 폼을 PATCH로 전송한다", async () => {
  const fetchImpl = jest.fn(async () =>
    jsonResponse({
      data: {
        id: 15,
        lastEditorMemberId: 7,
        updatedAt: "2026-07-31T06:00:00Z",
      },
      message: "일정 수정 성공",
      success: true,
    })
  );
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com",
    fetchImpl,
    getAccessToken: () => "token",
  });

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
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://api.example.com/events/15",
    expect.objectContaining({ method: "PATCH" })
  );
});

test("토큰이 없으면 서버 요청 전에 인증 연결 오류를 반환한다", async () => {
  const fetchImpl = jest.fn();
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com",
    fetchImpl,
    getAccessToken: () => null,
  });

  await expect(
    gateway.listEvents({
      endDate: "2026-07-31",
      groupId: "3",
      startDate: "2026-07-01",
    })
  ).rejects.toEqual(
    expect.objectContaining<Partial<CalendarApiError>>({
      status: 401,
    })
  );
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("계약과 다른 응답은 조용히 목업으로 대체하지 않고 오류로 처리한다", async () => {
  const gateway = createCalendarHttpGateway({
    baseUrl: "https://api.example.com",
    fetchImpl: async () =>
      jsonResponse({
        data: { events: [{ id: 1 }] },
        message: "성공",
        success: true,
      }),
    getAccessToken: () => "token",
  });

  await expect(
    gateway.listEvents({
      endDate: "2026-07-31",
      groupId: "3",
      startDate: "2026-07-01",
    })
  ).rejects.toBeInstanceOf(CalendarApiError);
});

test.each([null, undefined])(
  "normalizes an absent event description to an empty string",
  async (description) => {
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
    const gateway = createCalendarHttpGateway({
      baseUrl: "https://api.example.com",
      fetchImpl: async () =>
        jsonResponse({
          data,
          message: "Event detail loaded",
          success: true,
        }),
      getAccessToken: () => "token",
    });

    await expect(gateway.getEvent("12")).resolves.toMatchObject({
      description: "",
      id: "12",
    });
  }
);
