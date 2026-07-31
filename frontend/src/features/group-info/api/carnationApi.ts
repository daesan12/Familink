import type {AxiosInstance} from 'axios';

import {
  ApiError,
  apiClient,
  createApiClient,
  type ApiAuthSession,
  type ApiSuccess,
} from '../../../shared/api';
import {parseApiEnvelope} from './groupApi';
import type {WeeklyRankingSnapshot} from '../types';

export interface CarnationCalendar {
  earnedDates: readonly string[];
  endDate: string;
  memberId: string;
  startDate: string;
}

export type MemberCarnationLoader = (
  groupId: string,
  memberId: string,
  startDate: string,
  endDate: string,
) => Promise<CarnationCalendar>;

export interface CarnationGateway {
  loadMemberCarnations: MemberCarnationLoader;
  loadWeeklyRanking: (
    groupId: string,
    startDate?: string,
    endDate?: string,
  ) => Promise<WeeklyRankingSnapshot>;
}

export type CarnationHttpClient = Pick<AxiosInstance, 'get'>;

export interface CarnationGatewayOptions {
  authSession?: ApiAuthSession;
  baseUrl?: string;
  client?: CarnationHttpClient;
}

export function createCarnationGateway(
  options: CarnationGatewayOptions = {},
): CarnationGateway {
  const client =
    options.client ??
    (options.baseUrl === undefined && options.authSession === undefined
      ? apiClient
      : createApiClient(options.baseUrl, options.authSession));

  return {
    async loadWeeklyRanking(groupId, startDate, endDate) {
      const path = withOptionalWeekQuery(
        `/groups/${encodeURIComponent(groupId)}/grass`,
        startDate,
        endDate,
      );
      const response = await client.get<ApiSuccess<unknown>>(path);
      return parseApiEnvelope(response.data, response.status, parseGrassResponse);
    },

    async loadMemberCarnations(groupId, memberId, startDate, endDate) {
      assertIsoDate(startDate, 'startDate');
      assertIsoDate(endDate, 'endDate');
      if (startDate > endDate) {
        throw invalidResponse('startDate must not be after endDate.');
      }

      const response = await client.get<ApiSuccess<unknown>>(
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
          memberId,
        )}/carnations?startDate=${encodeURIComponent(
          startDate,
        )}&endDate=${encodeURIComponent(endDate)}`,
      );
      const result = parseApiEnvelope(
        response.data,
        response.status,
        parseCarnationCalendar,
      );
      if (
        result.memberId !== memberId ||
        result.startDate !== startDate ||
        result.endDate !== endDate
      ) {
        throw invalidResponse('Carnation response does not match the request.');
      }
      return result;
    },
  };
}

function withOptionalWeekQuery(
  path: string,
  startDate?: string,
  endDate?: string,
): string {
  if ((startDate === undefined) !== (endDate === undefined)) {
    throw invalidResponse('startDate and endDate must be provided together.');
  }
  if (startDate === undefined || endDate === undefined) {
    return path;
  }

  assertIsoDate(startDate, 'startDate');
  assertIsoDate(endDate, 'endDate');
  if (startDate > endDate) {
    throw invalidResponse('startDate must not be after endDate.');
  }
  if (new Date(`${startDate}T00:00:00Z`).getUTCDay() !== 1) {
    throw invalidResponse('startDate must be a Monday.');
  }
  if (addDays(startDate, 6) !== endDate) {
    throw invalidResponse('endDate must be six days after startDate.');
  }

  return `${path}?startDate=${encodeURIComponent(
    startDate,
  )}&endDate=${encodeURIComponent(endDate)}`;
}

function parseGrassResponse(value: unknown): WeeklyRankingSnapshot {
  const data = readObject(value, 'grass response');
  const weekStart = readIsoDate(data.weekStart, 'weekStart');
  const weekEnd = readIsoDate(data.weekEnd, 'weekEnd');
  if (addDays(weekStart, 6) !== weekEnd) {
    throw invalidResponse('weekEnd must be six days after weekStart.');
  }

  const rankings = readArray(data.rankings, 'rankings').map(readRankingEntry);
  return {rankings, weekEnd, weekStart};
}

function parseCarnationCalendar(value: unknown): CarnationCalendar {
  const data = readObject(value, 'carnation calendar response');
  const memberId = readId(data.memberId, 'memberId');
  const startDate = readIsoDate(data.startDate, 'startDate');
  const endDate = readIsoDate(data.endDate, 'endDate');
  if (startDate > endDate) {
    throw invalidResponse('startDate must not be after endDate.');
  }

  return {
    earnedDates: readArray(data.earnedDates, 'earnedDates').map((date, index) =>
      readIsoDate(date, `earnedDates[${index}]`),
    ),
    endDate,
    memberId,
    startDate,
  };
}

function readRankingEntry(value: unknown): WeeklyRankingSnapshot['rankings'][number] {
  const data = readObject(value, 'ranking');
  return {
    carnationCount: readNonNegativeInteger(
      data.carnationCount,
      'carnationCount',
    ),
    displayName: readNonEmptyString(data.displayName, 'displayName'),
    memberId: readId(data.memberId, 'memberId'),
    previousWeekWinner: readBoolean(
      data.previousWeekWinner,
      'previousWeekWinner',
    ),
  };
}

function readObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidResponse(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw invalidResponse(`${field} must be an array.`);
  }
  return value;
}

function readId(value: unknown, field: string): string {
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return value;
    }
  }
  throw invalidResponse(`${field} must be a positive ID.`);
}

function readIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw invalidResponse(`${field} must be an ISO-8601 date.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw invalidResponse(`${field} must be an ISO-8601 date.`);
  }
  return value;
}

function assertIsoDate(value: string, field: string): void {
  readIsoDate(value, field);
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidResponse(`${field} must be a non-empty string.`);
  }
  return value;
}

function readNonNegativeInteger(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw invalidResponse(`${field} must be a non-negative integer.`);
  }
  return value;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw invalidResponse(`${field} must be a boolean.`);
  }
  return value;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function invalidResponse(message: string): CarnationApiError {
  return new CarnationApiError(message);
}

export class CarnationApiError extends ApiError {
  constructor(message: string, status?: number) {
    super({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
      message,
      status,
    });
  }
}
