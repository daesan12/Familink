import type {AxiosResponse} from 'axios';

import {ApiError} from '../../../shared/api';
import {
  createNotificationGateway,
  type NotificationHttpClient,
} from './notificationApi';
import {DEFAULT_NOTIFICATION_SETTINGS} from '../fixtures/notificationFixtures';

function response(data: unknown, status = 200): AxiosResponse<unknown> {
  return {
    config: {},
    data,
    headers: {},
    status,
    statusText: '',
  } as AxiosResponse<unknown>;
}

function success(data: unknown, status = 200): AxiosResponse<unknown> {
  return response({data, message: '성공', success: true}, status);
}

function createClient(): jest.Mocked<NotificationHttpClient> {
  return {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  } as unknown as jest.Mocked<NotificationHttpClient>;
}

test('알림 목록 응답을 화면 모델로 변환하고 페이지 파라미터를 전송한다', async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      content: [
        {
          actor: {name: '홍유라', profileImageUrl: null, userId: 7},
          body: '새 게시글이 올라왔어요.',
          createdAt: '2026-08-01T00:00:00Z',
          groupId: 3,
          id: 12,
          readAt: null,
          relatedCallReportId: null,
          relatedDailyReportId: null,
          relatedEventId: null,
          relatedJoinRequestId: null,
          relatedPostId: 15,
          title: '새 게시글',
          type: 'NEW_POST',
        },
        {
          actor: null,
          body: '행위자가 삭제된 알림',
          createdAt: '2026-07-30T00:00:00Z',
          groupId: null,
          id: 13,
          readAt: '2026-07-30T01:00:00Z',
          relatedCallReportId: null,
          relatedDailyReportId: null,
          relatedEventId: null,
          relatedJoinRequestId: null,
          relatedPostId: null,
          title: '알림',
          type: 'DAILY_REPORT',
        },
        {
          actor: {name: '수호', profileImageUrl: null, userId: 8},
          body: '그룹 가입 요청이 도착했어요.',
          createdAt: '2026-07-31T00:00:00Z',
          groupId: 3,
          id: 14,
          readAt: null,
          relatedCallReportId: null,
          relatedDailyReportId: null,
          relatedEventId: null,
          relatedJoinRequestId: 21,
          relatedPostId: null,
          title: '그룹 가입 요청',
          type: 'GROUP_JOIN_REQUEST',
        },
      ],
      hasNext: true,
    }),
  );
  const gateway = createNotificationGateway({client});

  const page = await gateway.loadPage(2, 10);
  expect(page).toMatchObject({
    hasNext: true,
    notifications: [
      expect.objectContaining({
        actorName: '홍유라',
        avatarText: '홍유',
        groupId: '3',
        id: '12',
        isRead: false,
        postId: '15',
      }),
      expect.objectContaining({avatarText: '알', id: '13', isRead: true}),
      expect.objectContaining({
        actorName: '수호',
        groupId: '3',
        id: '14',
        relatedJoinRequestId: '21',
        requestKind: 'groupJoin',
      }),
    ],
  });
  // 행위자가 삭제된 알림에는 actorName을 만들지 않는다.
  expect(page.notifications[1].actorName).toBeUndefined();
  expect(client.get).toHaveBeenCalledWith('/notifications?page=2&size=10');
});

test('읽지 않은 개수와 읽음 API를 계약 경로로 호출한다', async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(success({unreadCount: 4}));
  client.patch
    .mockResolvedValueOnce(
      success({id: 12, readAt: '2026-08-01T00:00:00Z'}),
    )
    .mockResolvedValueOnce(
      success({readAt: '2026-08-01T00:00:01Z', updatedCount: 3}),
    );
  const gateway = createNotificationGateway({client});

  await expect(gateway.getUnreadCount()).resolves.toBe(4);
  await expect(gateway.markRead('12')).resolves.toEqual({
    id: '12',
    readAt: '2026-08-01T00:00:00Z',
  });
  await expect(gateway.markAllRead()).resolves.toEqual({
    readAt: '2026-08-01T00:00:01Z',
    updatedCount: 3,
  });
  expect(client.patch).toHaveBeenNthCalledWith(
    1,
    '/notifications/12/read',
    undefined,
  );
  expect(client.patch).toHaveBeenNthCalledWith(
    2,
    '/notifications/read-all',
    undefined,
  );
});

test('7개 설정을 서버 모델과 화면 모델 사이에서 변환한다', async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      settings: DEFAULT_NOTIFICATION_SETTINGS.map(setting => ({
        enabled: setting.type !== 'DAILY_REPORT',
        notificationType: setting.type,
      })),
    }),
  );
  client.put.mockResolvedValueOnce(
    success({updatedAt: '2026-08-01T00:00:00Z'}),
  );
  const gateway = createNotificationGateway({client});

  const settings = await gateway.loadSettings();
  expect(settings).toHaveLength(7);
  expect(settings.find(setting => setting.type === 'DAILY_REPORT')?.enabled).toBe(
    false,
  );
  await expect(gateway.updateSettings(settings)).resolves.toEqual({
    updatedAt: '2026-08-01T00:00:00Z',
  });
  expect(client.put).toHaveBeenCalledWith(
    '/notification-settings',
    {
      settings: settings.map(setting => ({
        enabled: setting.enabled,
        notificationType: setting.type,
      })),
    },
  );
});

test('기기 토큰 등록·해제를 계약 상태로 처리한다', async () => {
  const client = createClient();
  client.post.mockResolvedValueOnce(
    success({active: true, deviceType: 'ANDROID', id: 9}, 201),
  );
  client.delete.mockResolvedValueOnce(response(null, 204));
  const gateway = createNotificationGateway({client});

  await expect(gateway.registerDeviceToken('opaque-token')).resolves.toEqual({
    active: true,
    deviceType: 'ANDROID',
    id: '9',
  });
  await expect(gateway.deactivateDeviceToken('opaque-token')).resolves.toBeUndefined();
  expect(client.post).toHaveBeenCalledWith('/device-tokens', {
    deviceType: 'ANDROID',
    token: 'opaque-token',
  });
  expect(client.delete).toHaveBeenCalledWith('/device-tokens', {
    data: {token: 'opaque-token'},
  });
});

test('계약과 다른 응답은 fixture로 대체하지 않고 오류로 처리한다', async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(success({content: [], hasNext: 'false'}));
  const gateway = createNotificationGateway({client});

  await expect(gateway.loadPage(0)).rejects.toBeInstanceOf(ApiError);
});
