import {resolveNotificationTarget} from './deepLink';
import type {AppNotification} from './types';

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    avatarText: '알',
    body: '내용',
    createdAtLabel: '방금',
    id: '1',
    isRead: false,
    relatedJoinRequestStatus: null,
    title: '제목',
    type: 'NEW_POST',
    ...overrides,
  };
}

test('게시글 알림은 게시글 목적지로 해석한다', () => {
  expect(
    resolveNotificationTarget(
      notification({groupId: '3', postId: '15', type: 'NEW_POST'}),
    ),
  ).toEqual({kind: 'post', postId: '15', groupId: '3'});
  expect(
    resolveNotificationTarget(
      notification({postId: '16', type: 'POST_ACTIVITY'}),
    ),
  ).toEqual({kind: 'post', postId: '16', groupId: undefined});
});

test('일정 알림은 이벤트 상세 목적지로 해석한다', () => {
  expect(
    resolveNotificationTarget(
      notification({groupId: '3', relatedEventId: '7', type: 'EVENT_CHANGED'}),
    ),
  ).toEqual({kind: 'calendarEvent', eventId: '7', groupId: '3'});
  expect(
    resolveNotificationTarget(
      notification({relatedEventId: '8', type: 'EVENT_REMINDER'}),
    ),
  ).toEqual({kind: 'calendarEvent', eventId: '8', groupId: undefined});
});

test('건당 리포트 알림은 통화 상세 목적지로 해석한다', () => {
  expect(
    resolveNotificationTarget(
      notification({
        groupId: '3',
        relatedCallSessionId: '21',
        relatedCareReceiverMemberId: '11',
        relatedReportDate: '2026-08-03',
        type: 'CALL_REPORT',
      }),
    ),
  ).toEqual({
    kind: 'callReport',
    callSessionId: '21',
    memberId: '11',
    reportDate: '2026-08-03',
    groupId: '3',
  });
});

test('일일 리포트 알림은 날짜·멤버 리포트 목적지로 해석한다', () => {
  expect(
    resolveNotificationTarget(
      notification({
        groupId: '3',
        relatedCareReceiverMemberId: '11',
        relatedReportDate: '2026-08-03',
        type: 'DAILY_REPORT',
      }),
    ),
  ).toEqual({
    kind: 'dailyReport',
    memberId: '11',
    reportDate: '2026-08-03',
    groupId: '3',
  });
});

test('가입 요청 알림은 가입 승인 목적지로 해석한다', () => {
  expect(
    resolveNotificationTarget(
      notification({
        groupId: '3',
        relatedJoinRequestStatus: 'PENDING_ADMIN',
        type: 'GROUP_JOIN_REQUEST',
      }),
    ),
  ).toEqual({kind: 'joinApproval', groupId: '3'});
});

test('처리된 가입 요청 알림은 그룹 정보 목적지로 해석한다', () => {
  expect(
    resolveNotificationTarget(
      notification({
        groupId: '3',
        relatedJoinRequestStatus: 'APPROVED',
        type: 'GROUP_JOIN_REQUEST',
      }),
    ),
  ).toEqual({kind: 'groupInfo', groupId: '3'});
});

test('이동에 필요한 참조가 결손이면 null을 반환한다', () => {
  expect(resolveNotificationTarget(notification({type: 'NEW_POST'}))).toBeNull();
  expect(
    resolveNotificationTarget(notification({type: 'EVENT_CHANGED'})),
  ).toBeNull();
  expect(
    resolveNotificationTarget(
      // callSessionId 결손
      notification({
        relatedCareReceiverMemberId: '11',
        relatedReportDate: '2026-08-03',
        type: 'CALL_REPORT',
      }),
    ),
  ).toBeNull();
  expect(
    resolveNotificationTarget(
      // reportDate 결손
      notification({relatedCareReceiverMemberId: '11', type: 'DAILY_REPORT'}),
    ),
  ).toBeNull();
});
