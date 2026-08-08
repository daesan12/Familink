import {
  createCalendarEventDraft,
  createCalendarEventDraftFromDetail,
  enableCalendarEventTime,
  toCalendarEventWriteInput,
  validateCalendarEventDraft,
} from "./calendarFormModel";

test("새 일정은 선택 날짜의 시간 설정이 꺼진 상태로 시작한다", () => {
  expect(createCalendarEventDraft("2026-07-31")).toMatchObject({
    endDate: "2026-07-31",
    startDate: "2026-07-31",
    timeEnabled: false,
  });
});

test("시간 설정을 켜면 KST 현재 정시부터 한 시간 뒤를 기본값으로 사용한다", () => {
  const draft = createCalendarEventDraft("2026-07-31");

  expect(
    enableCalendarEventTime(draft, new Date("2026-07-30T20:42:18Z"))
  ).toMatchObject({
    endTime: "06:00",
    startTime: "05:00",
    timeEnabled: true,
  });
});

test("23시에는 종료 기본값을 같은 날 23:59로 제한한다", () => {
  const draft = createCalendarEventDraft("2026-07-31");

  expect(
    enableCalendarEventTime(draft, new Date("2026-07-31T14:42:18Z"))
  ).toMatchObject({
    endDate: "2026-07-31",
    endTime: "23:59",
    startTime: "23:00",
  });
});

test("수정 일정은 KST 시간과 참여자를 기존 값으로 채운다", () => {
  expect(
    createCalendarEventDraftFromDetail({
      creatorDisplayName: "이종철",
      creatorMemberId: "7",
      description: "정기 검진",
      endAt: "2026-07-31T07:30:00Z",
      endDate: "2026-07-31",
      eventDate: "2026-07-31",
      groupId: "3",
      id: "12",
      participantMemberIds: ["8"],
      startAt: "2026-07-31T06:00:00Z",
      title: "병원",
    })
  ).toMatchObject({
    endTime: "16:30",
    participantMemberIds: ["8"],
    startTime: "15:00",
    timeEnabled: true,
    title: "병원",
  });
});

test("날짜 일정은 API에 시각을 null로 전송한다", () => {
  expect(
    toCalendarEventWriteInput({
      ...createCalendarEventDraft("2026-07-31"),
      description: "  가족 식사  ",
      participantMemberIds: ["7"],
      title: "  저녁 약속  ",
    })
  ).toEqual({
    description: "가족 식사",
    endAt: null,
    endDate: "2026-07-31",
    eventDate: "2026-07-31",
    participantMemberIds: ["7"],
    startAt: null,
    title: "저녁 약속",
  });
});

test("시간 일정은 KST 입력을 UTC ISO 문자열로 변환한다", () => {
  expect(
    toCalendarEventWriteInput({
      ...createCalendarEventDraft("2026-07-31"),
      endTime: "16:00",
      startTime: "15:00",
      timeEnabled: true,
      title: "검진",
    })
  ).toMatchObject({
    endAt: "2026-07-31T07:00:00.000Z",
    startAt: "2026-07-31T06:00:00.000Z",
  });
});

test("필수값과 길이, 날짜·시간 순서를 검증한다", () => {
  expect(
    validateCalendarEventDraft({
      ...createCalendarEventDraft("2026-07-31"),
      description: "가".repeat(51),
      endDate: "2026-07-30",
      endTime: "08:00",
      startTime: "09:00",
      timeEnabled: true,
      title: " ",
    })
  ).toEqual({
    date: "종료 날짜는 시작 날짜보다 빠를 수 없어요.",
    description: "세부 내용은 50자까지 입력할 수 있어요.",
    time: "종료 시간은 시작 시간보다 빠를 수 없어요.",
    title: "일정 제목을 입력해 주세요.",
  });
});
