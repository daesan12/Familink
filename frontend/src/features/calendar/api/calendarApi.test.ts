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
