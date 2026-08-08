export type DateKey = string;

export interface CalendarEventSummary {
  id: string;
  title: string;
  eventDate: DateKey;
  endDate: DateKey;
  startAt: string | null;
  endAt: string | null;
}

export interface CalendarEventDetail extends CalendarEventSummary {
  // 서버가 조회자 호칭까지 반영해 내려주는 작성자 이름이다. 그룹을 나간 작성자는 활성 구성원
  // 목록에 없어 화면에서 이름을 찾을 수 없으므로 이 값을 우선 사용한다. 값을 내려주지 않는
  // 구버전 서버에서는 null이다.
  creatorDisplayName: string | null;
  creatorMemberId: string;
  description: string;
  groupId: string;
  participantMemberIds: readonly string[];
}

export interface CalendarMember {
  displayName: string;
  isManager: boolean;
  memberId: string;
  profileImageUrl: string | null;
  role: "guardian" | "careReceiver";
  userId: string;
}

export interface CalendarQuery {
  endDate: DateKey;
  groupId: string;
  signal?: AbortSignal;
  startDate: DateKey;
}

export interface CalendarEventWriteInput {
  description: string | null;
  endAt: string | null;
  endDate: DateKey;
  eventDate: DateKey;
  participantMemberIds: readonly string[];
  startAt: string | null;
  title: string;
}

export interface CalendarGateway {
  createEvent(
    groupId: string,
    input: CalendarEventWriteInput,
    signal?: AbortSignal
  ): Promise<string>;
  deleteEvent(eventId: string, signal?: AbortSignal): Promise<void>;
  getEvent(eventId: string, signal?: AbortSignal): Promise<CalendarEventDetail>;
  listEvents(query: CalendarQuery): Promise<readonly CalendarEventSummary[]>;
  listMembers(
    groupId: string,
    signal?: AbortSignal
  ): Promise<readonly CalendarMember[]>;
  updateEvent(
    eventId: string,
    input: CalendarEventWriteInput,
    signal?: AbortSignal
  ): Promise<void>;
}
