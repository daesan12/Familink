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

export interface CalendarGateway {
  deleteEvent(eventId: string, signal?: AbortSignal): Promise<void>;
  getEvent(eventId: string, signal?: AbortSignal): Promise<CalendarEventDetail>;
  listEvents(query: CalendarQuery): Promise<readonly CalendarEventSummary[]>;
  listMembers(
    groupId: string,
    signal?: AbortSignal
  ): Promise<readonly CalendarMember[]>;
}
