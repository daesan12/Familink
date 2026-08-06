import type {AxiosInstance} from 'axios';

import {
  ApiError,
  apiClient,
  createApiClient,
  isApiSuccess,
  type ApiAuthSession,
  type ApiSuccess,
} from '../../../shared/api';
import {DEFAULT_NOTIFICATION_SETTINGS} from '../fixtures/notificationFixtures';
import type {
  AppNotification,
  DeviceTokenRegistration,
  NotificationGateway,
  NotificationJoinRequestStatus,
  NotificationPage,
  NotificationReadAllResult,
  NotificationReadResult,
  NotificationSetting,
  NotificationSettingsUpdateResult,
  NotificationType,
} from '../types';

export type NotificationHttpClient = Pick<
  AxiosInstance,
  'delete' | 'get' | 'patch' | 'post' | 'put'
>;

export interface NotificationGatewayOptions {
  authSession?: ApiAuthSession;
  baseUrl?: string;
  client?: NotificationHttpClient;
}

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'NEW_POST',
  'POST_ACTIVITY',
  'EVENT_CHANGED',
  'EVENT_REMINDER',
  'CALL_REPORT',
  'DAILY_REPORT',
  'GROUP_JOIN_REQUEST',
];

export function createNotificationGateway(
  options: NotificationGatewayOptions = {},
): NotificationGateway {
  const client =
    options.client ??
    (options.baseUrl === undefined && options.authSession === undefined
      ? apiClient
      : createApiClient(options.baseUrl, options.authSession));

  return {
    async deleteNotification(notificationId) {
      const response = await client.delete(
        `/notifications/${encodeURIComponent(notificationId)}`,
      );
      if (response.status !== 204) {
        throw invalidResponse(response.status);
      }
    },

    async deleteAllNotifications() {
      const response = await client.delete('/notifications');
      if (response.status !== 204) {
        throw invalidResponse(response.status);
      }
    },

    async loadPage(page, size = 20) {
      const response = await client.get<ApiSuccess<unknown>>(
        `/notifications?page=${encodeURIComponent(String(page))}&size=${encodeURIComponent(String(size))}`,
      );
      return parseEnvelope(response.data, response.status, parseNotificationPage);
    },

    async getUnreadCount() {
      const response = await client.get<ApiSuccess<unknown>>(
        '/notifications/unread-count',
      );
      return parseEnvelope(response.data, response.status, parseUnreadCount);
    },

    async markRead(notificationId) {
      const response = await client.patch<ApiSuccess<unknown>>(
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        undefined,
      );
      return parseEnvelope(response.data, response.status, parseReadResult);
    },

    async markAllRead() {
      const response = await client.patch<ApiSuccess<unknown>>(
        '/notifications/read-all',
        undefined,
      );
      return parseEnvelope(response.data, response.status, parseReadAllResult);
    },

    async loadSettings() {
      const response = await client.get<ApiSuccess<unknown>>(
        '/notification-settings',
      );
      return parseEnvelope(response.data, response.status, parseSettings);
    },

    async updateSettings(settings) {
      const response = await client.put<ApiSuccess<unknown>>(
        '/notification-settings',
        {
          settings: settings.map(setting => ({
            enabled: setting.enabled,
            notificationType: setting.type,
          })),
        },
      );
      return parseEnvelope(
        response.data,
        response.status,
        parseSettingsUpdateResult,
      );
    },

    async registerDeviceToken(token) {
      const response = await client.post<ApiSuccess<unknown>>('/device-tokens', {
        deviceType: 'ANDROID',
        token,
      });
      if (response.status !== 200 && response.status !== 201) {
        throw invalidResponse(response.status);
      }
      return parseEnvelope(
        response.data,
        response.status,
        parseDeviceTokenRegistration,
      );
    },

    async deactivateDeviceToken(token) {
      const response = await client.delete('/device-tokens', {
        data: {token},
      });
      if (response.status !== 204) {
        throw invalidResponse(response.status);
      }
    },
  };
}

export const notificationGateway = createNotificationGateway();

function parseEnvelope<T>(
  envelope: unknown,
  status: number,
  parseData: (value: unknown) => T | null,
): T {
  const data = isApiSuccess(envelope) ? parseData(envelope.data) : null;
  if (data !== null) {
    return data;
  }
  throw invalidResponse(status);
}

function parseNotificationPage(value: unknown): NotificationPage | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.content) ||
    typeof value.hasNext !== 'boolean'
  ) {
    return null;
  }

  const notifications = value.content.map(parseNotification);
  return notifications.every(isNotNull)
    ? {hasNext: value.hasNext, notifications}
    : null;
}

function parseNotification(value: unknown): AppNotification | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readPositiveId(value.id);
  const type = readNotificationType(value.type);
  const title = readNonEmptyString(value.title);
  const body = readNonEmptyString(value.body);
  const createdAt = readInstant(value.createdAt);
  const readAt = readNullableInstant(value.readAt);
  const groupId = readNullablePositiveId(value.groupId);
  const actor = parseActor(value.actor);
  const postId = readNullablePositiveId(value.relatedPostId);
  const callReportId = readNullablePositiveId(value.relatedCallReportId);
  const callSessionId = readNullablePositiveId(value.relatedCallSessionId);
  const careReceiverMemberId = readNullablePositiveId(
    value.relatedCareReceiverMemberId,
  );
  const reportDate = readNullableDateKey(value.relatedReportDate);
  const dailyReportId = readNullablePositiveId(value.relatedDailyReportId);
  const eventId = readNullablePositiveId(value.relatedEventId);
  const joinRequestId = readNullablePositiveId(value.relatedJoinRequestId);
  const joinRequestStatus = readNullableJoinRequestStatus(
    value.relatedJoinRequestStatus,
  );
  if (
    id === null ||
    type === null ||
    title === null ||
    body === null ||
    createdAt === null ||
    readAt === undefined ||
    groupId === undefined ||
    actor === undefined ||
    postId === undefined ||
    callReportId === undefined ||
    callSessionId === undefined ||
    careReceiverMemberId === undefined ||
    reportDate === undefined ||
    dailyReportId === undefined ||
    eventId === undefined ||
    joinRequestId === undefined ||
    joinRequestStatus === undefined
  ) {
    return null;
  }

  return {
    ...(actor === null || actor.name === null ? {} : {actorName: actor.name}),
    avatarText: actor === null ? '알' : avatarText(actor.name),
    body,
    createdAt,
    createdAtLabel: formatCreatedAt(createdAt),
    ...(groupId === null ? {} : {groupId}),
    id,
    isRead: readAt !== null,
    ...(postId === null ? {} : {postId}),
    ...(callReportId === null ? {} : {relatedCallReportId: callReportId}),
    ...(callSessionId === null ? {} : {relatedCallSessionId: callSessionId}),
    ...(careReceiverMemberId === null
      ? {}
      : {relatedCareReceiverMemberId: careReceiverMemberId}),
    ...(dailyReportId === null ? {} : {relatedDailyReportId: dailyReportId}),
    ...(eventId === null ? {} : {relatedEventId: eventId}),
    ...(joinRequestId === null ? {} : {relatedJoinRequestId: joinRequestId}),
    relatedJoinRequestStatus: joinRequestStatus,
    ...(reportDate === null ? {} : {relatedReportDate: reportDate}),
    ...(type === 'GROUP_JOIN_REQUEST' && joinRequestStatus === 'PENDING_ADMIN'
      ? {requestKind: 'groupJoin' as const}
      : {}),
    title,
    type,
  };
}

function parseActor(
  value: unknown,
): {name: string | null; userId: string} | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const userId = readPositiveId(value.userId);
  const name = value.name === null ? null : readOptionalText(value.name);
  const profileImageUrl = value.profileImageUrl;
  if (
    userId === null ||
    name === undefined ||
    (profileImageUrl !== null &&
      profileImageUrl !== undefined &&
      typeof profileImageUrl !== 'string')
  ) {
    return undefined;
  }
  return {name, userId};
}

function parseUnreadCount(value: unknown): number | null {
  return isRecord(value) && isNonNegativeInteger(value.unreadCount)
    ? value.unreadCount
    : null;
}

function parseReadResult(value: unknown): NotificationReadResult | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = readPositiveId(value.id);
  const readAt = readInstant(value.readAt);
  return id !== null && readAt !== null ? {id, readAt} : null;
}

function parseReadAllResult(value: unknown): NotificationReadAllResult | null {
  if (!isRecord(value)) {
    return null;
  }
  const updatedCount = value.updatedCount;
  const readAt = readInstant(value.readAt);
  return isNonNegativeInteger(updatedCount) && readAt !== null
    ? {readAt, updatedCount}
    : null;
}

function parseSettings(value: unknown): readonly NotificationSetting[] | null {
  if (!isRecord(value) || !Array.isArray(value.settings)) {
    return null;
  }
  const parsed = value.settings.map(parseSetting);
  if (!parsed.every(isNotNull) || parsed.length !== NOTIFICATION_TYPES.length) {
    return null;
  }
  const byType = new Map(parsed.map(setting => [setting.type, setting]));
  if (byType.size !== NOTIFICATION_TYPES.length) {
    return null;
  }
  const ordered = DEFAULT_NOTIFICATION_SETTINGS.map(defaultSetting => {
    const remote = byType.get(defaultSetting.type);
    return remote === undefined
      ? null
      : {...defaultSetting, enabled: remote.enabled};
  });
  return ordered.every(isNotNull) ? ordered : null;
}

function parseSetting(value: unknown): NotificationSetting | null {
  if (!isRecord(value) || typeof value.enabled !== 'boolean') {
    return null;
  }
  const type = readNotificationType(value.notificationType);
  return type === null ? null : {enabled: value.enabled, label: type, type};
}

function parseSettingsUpdateResult(
  value: unknown,
): NotificationSettingsUpdateResult | null {
  if (!isRecord(value)) {
    return null;
  }
  const updatedAt = readInstant(value.updatedAt);
  return updatedAt === null ? null : {updatedAt};
}

function parseDeviceTokenRegistration(
  value: unknown,
): DeviceTokenRegistration | null {
  if (
    !isRecord(value) ||
    value.deviceType !== 'ANDROID' ||
    value.active !== true
  ) {
    return null;
  }
  const id = readPositiveId(value.id);
  return id === null ? null : {active: true, deviceType: 'ANDROID', id};
}

function readNotificationType(value: unknown): NotificationType | null {
  return typeof value === 'string' &&
    NOTIFICATION_TYPES.includes(value as NotificationType)
    ? (value as NotificationType)
    : null;
}

function readPositiveId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? value : null;
  }
  return null;
}

function readNullablePositiveId(value: unknown): string | null | undefined {
  return value === null || value === undefined
    ? null
    : readPositiveId(value) ?? undefined;
}

function readNullableDateKey(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined;
}

function readNullableJoinRequestStatus(
  value: unknown,
): NotificationJoinRequestStatus | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value === 'PENDING_ADMIN' ||
    value === 'APPROVED' ||
    value === 'REJECTED'
    ? value
    : null;
}

function readInstant(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function readNullableInstant(value: unknown): string | null | undefined {
  return value === null || value === undefined
    ? null
    : readInstant(value) ?? undefined;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readOptionalText(value: unknown): string | null | undefined {
  return value === undefined ? undefined : readNonEmptyString(value);
}

function avatarText(name: string | null): string {
  return name === null ? '알' : [...name].slice(0, 2).join('') || '알';
}

function formatCreatedAt(createdAt: string): string {
  const elapsed = Date.now() - Date.parse(createdAt);
  if (elapsed < 60_000) return '방금';
  if (elapsed < 3_600_000) {
    return `${Math.max(1, Math.floor(elapsed / 60_000))}분 전`;
  }
  if (elapsed < 86_400_000) {
    return `${Math.floor(elapsed / 3_600_000)}시간 전`;
  }
  if (elapsed < 172_800_000) return '어제';
  const date = new Date(createdAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function invalidResponse(status?: number): ApiError {
  return new ApiError({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    message: '서버가 예상하지 못한 응답을 반환했습니다.',
    status,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
