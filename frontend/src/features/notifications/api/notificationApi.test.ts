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
          relatedJoinRequestStatus: null,
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
          relatedJoinRequestStatus: null,
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
          relatedJoinRequestStatus: 'PENDING_ADMIN',
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
        relatedJoinRequestStatus: null,
      }),
      expect.objectContaining({
        avatarText: '알',
        id: '13',
        isRead: true,
        relatedJoinRequestStatus: null,
      }),
      expect.objectContaining({
        actorName: '수호',
        groupId: '3',
        id: '14',
        relatedJoinRequestId: '21',
        relatedJoinRequestStatus: 'PENDING_ADMIN',
        requestKind: 'groupJoin',
      }),
    ],
  });
  // 행위자가 삭제된 알림에는 actorName을 만들지 않는다.
  expect(page.notifications[1].actorName).toBeUndefined();
  expect(client.get).toHaveBeenCalledWith('/notifications?page=2&size=10');
});

// 계약(API-NOTIFICATIONS-003)의 actor.profileImageUrl은 검증만 하고 버려져
// 알림 목록이 항상 이니셜만 보여줬다.
test('행위자 프로필 사진 URL을 알림 항목으로 넘긴다', async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      content: [
        {
          actor: {
            name: '홍유라',
            profileImageUrl: 'https://cdn.example.com/u7.jpg?sig=abc',
            userId: 7,
          },
          body: '본문',
          createdAt: '2026-08-08T01:02:03Z',
          groupId: 3,
          id: 12,
          readAt: null,
          title: '제목',
          type: 'NEW_POST',
        },
      ],
      hasNext: false,
    }),
  );
  const gateway = createNotificationGateway({client});

  const page = await gateway.loadPage(0, 10);

  expect(page.notifications[0].actorProfileImageUrl).toBe(
    'https://cdn.example.com/u7.jpg?sig=abc',
  );
});

test.each([
  ['null', null],
  ['빈 문자열', ''],
])('프로필 사진이 %s이면 이니셜을 쓰도록 값을 비운다', async (_label, url) => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      content: [
        {
          actor: {name: '홍유라', profileImageUrl: url, userId: 7},
          body: '본문',
          createdAt: '2026-08-08T01:02:03Z',
          groupId: 3,
          id: 12,
          readAt: null,
          title: '제목',
          type: 'NEW_POST',
        },
      ],
      hasNext: false,
    }),
  );
  const gateway = createNotificationGateway({client});

  const page = await gateway.loadPage(0, 10);

  expect(page.notifications[0].actorProfileImageUrl).toBeUndefined();
  expect(page.notifications[0].avatarText).toBe('홍유');
});

test('리포트 알림의 이동용 조회 키를 파싱하고 부재나 잘못된 형식도 허용한다', async () => {
  const client = createClient();
  client.get.mockResolvedValueOnce(
    success({
      content: [
        {
          actor: null,
          body: '통화 리포트가 준비됐어요.',
          createdAt: '2026-08-03T14:00:00Z',
          groupId: 3,
          id: 31,
          readAt: null,
          relatedCallReportId: 41,
          relatedCallSessionId: 51,
          relatedCareReceiverMemberId: 61,
          relatedDailyReportId: null,
          relatedEventId: null,
          relatedJoinRequestId: null,
          relatedJoinRequestStatus: null,
          relatedPostId: null,
          relatedReportDate: '2026-08-04',
          title: '통화 리포트',
          type: 'CALL_REPORT',
        },
        {
          actor: null,
          body: '이동 키가 없는 구버전 응답',
          createdAt: '2026-08-02T14:00:00Z',
          groupId: 3,
          id: 32,
          readAt: null,
          relatedCallReportId: null,
          relatedDailyReportId: 42,
          relatedEventId: null,
          relatedJoinRequestId: null,
          relatedJoinRequestStatus: null,
          relatedPostId: null,
          title: '일일 리포트',
          type: 'DAILY_REPORT',
        },
      ],
      hasNext: false,
    }),
  );

  const page = await createNotificationGateway({client}).loadPage(0);
  expect(page.notifications[0]).toMatchObject({
    relatedCallReportId: '41',
    relatedCallSessionId: '51',
    relatedCareReceiverMemberId: '61',
    relatedReportDate: '2026-08-04',
  });
  expect(page.notifications[1].relatedCallSessionId).toBeUndefined();
  expect(page.notifications[1].relatedCareReceiverMemberId).toBeUndefined();
  expect(page.notifications[1].relatedReportDate).toBeUndefined();

  const invalidClient = createClient();
  invalidClient.get.mockResolvedValueOnce(
    success({
      content: [
        {
          actor: null,
          body: '형식이 잘못된 날짜',
          createdAt: '2026-08-02T14:00:00Z',
          groupId: 3,
          id: 33,
          readAt: null,
          relatedCallReportId: null,
          relatedDailyReportId: 42,
          relatedEventId: null,
          relatedJoinRequestId: null,
          relatedJoinRequestStatus: null,
          relatedPostId: null,
          relatedReportDate: '08/04/2026',
          title: '일일 리포트',
          type: 'DAILY_REPORT',
        },
      ],
      hasNext: false,
    }),
  );
  await expect(
    createNotificationGateway({client: invalidClient}).loadPage(0),
  ).rejects.toBeInstanceOf(ApiError);
});

test('누락되거나 알 수 없는 가입 요청 상태는 null로 읽고 처리 동작을 숨긴다', async () => {
  const baseNotification = {
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
  };
  const missingClient = createClient();
  missingClient.get.mockResolvedValueOnce(
    success({content: [baseNotification], hasNext: false}),
  );

  await expect(
    createNotificationGateway({client: missingClient}).loadPage(0),
  ).resolves.toMatchObject({
    notifications: [
      expect.objectContaining({
        relatedJoinRequestStatus: null,
      }),
    ],
  });

  const unknownClient = createClient();
  unknownClient.get.mockResolvedValueOnce(
    success({
      content: [
        {...baseNotification, relatedJoinRequestStatus: 'UNKNOWN_STATUS'},
      ],
      hasNext: false,
    }),
  );

  const unknownPage = await createNotificationGateway({
    client: unknownClient,
  }).loadPage(0);
  expect(unknownPage.notifications[0]).toMatchObject({
    relatedJoinRequestStatus: null,
  });
  expect(unknownPage.notifications[0]).not.toHaveProperty('requestKind');
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

test('알림 단건·전체 삭제 API를 204 계약으로 호출한다', async () => {
  const client = createClient();
  client.delete
    .mockResolvedValueOnce(response(null, 204))
    .mockResolvedValueOnce(response(null, 204));
  const gateway = createNotificationGateway({client});

  await expect(gateway.deleteNotification('12')).resolves.toBeUndefined();
  await expect(gateway.deleteAllNotifications()).resolves.toBeUndefined();
  expect(client.delete).toHaveBeenNthCalledWith(1, '/notifications/12');
  expect(client.delete).toHaveBeenNthCalledWith(2, '/notifications');
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
