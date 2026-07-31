import { createContext, type ReactNode, useContext } from "react";

import { CalendarApiError } from "./api/calendarApi";
import type { CalendarGateway } from "./types";

const unavailableGateway: CalendarGateway = {
  async createEvent() {
    throw new CalendarApiError("일정 API가 연결되지 않았어요.");
  },
  async deleteEvent() {
    throw new CalendarApiError("일정 API가 연결되지 않았어요.");
  },
  async getEvent() {
    throw new CalendarApiError("일정 API가 연결되지 않았어요.");
  },
  async listEvents() {
    throw new CalendarApiError("일정 API가 연결되지 않았어요.");
  },
  async listMembers() {
    throw new CalendarApiError("일정 API가 연결되지 않았어요.");
  },
  async updateEvent() {
    throw new CalendarApiError("일정 API가 연결되지 않았어요.");
  },
};

const CalendarGatewayContext =
  createContext<CalendarGateway>(unavailableGateway);

export function CalendarGatewayProvider({
  children,
  gateway,
}: {
  children: ReactNode;
  gateway: CalendarGateway;
}) {
  return (
    <CalendarGatewayContext.Provider value={gateway}>
      {children}
    </CalendarGatewayContext.Provider>
  );
}

export function useCalendarGateway(): CalendarGateway {
  return useContext(CalendarGatewayContext);
}
