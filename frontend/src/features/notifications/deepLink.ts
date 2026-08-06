import type {AppNotification} from './types';

// 알림 탭 시 이동할 목적지. 인앱 알림 목록 탭과 OS 푸시 탭이 같은 해석기를 공유한다.
export type NotificationDeepLinkTarget =
  | {kind: 'post'; postId: string; groupId?: string}
  | {kind: 'calendarEvent'; eventId: string; groupId?: string}
  | {
      kind: 'callReport';
      callSessionId: string;
      memberId: string;
      reportDate: string;
      groupId?: string;
    }
  | {kind: 'dailyReport'; memberId: string; reportDate: string; groupId?: string}
  | {kind: 'groupInfo'; groupId?: string}
  | {kind: 'joinApproval'; groupId?: string}
  // 푸시 탭에서 알림을 특정하지 못했을 때의 폴백. 해석기는 만들지 않는다.
  | {kind: 'notifications'};

// 이동에 필요한 참조가 결손이면 null을 반환해 탭을 무동작으로 둔다.
export function resolveNotificationTarget(
  notification: AppNotification,
): NotificationDeepLinkTarget | null {
  const {groupId} = notification;
  switch (notification.type) {
    case 'NEW_POST':
    case 'POST_ACTIVITY':
      return notification.postId === undefined
        ? null
        : {kind: 'post', postId: notification.postId, groupId};
    case 'EVENT_CHANGED':
    case 'EVENT_REMINDER':
      return notification.relatedEventId === undefined
        ? null
        : {kind: 'calendarEvent', eventId: notification.relatedEventId, groupId};
    case 'CALL_REPORT':
      return notification.relatedCallSessionId === undefined ||
        notification.relatedCareReceiverMemberId === undefined ||
        notification.relatedReportDate === undefined
        ? null
        : {
            kind: 'callReport',
            callSessionId: notification.relatedCallSessionId,
            memberId: notification.relatedCareReceiverMemberId,
            reportDate: notification.relatedReportDate,
            groupId,
          };
    case 'DAILY_REPORT':
      return notification.relatedCareReceiverMemberId === undefined ||
        notification.relatedReportDate === undefined
        ? null
        : {
            kind: 'dailyReport',
            memberId: notification.relatedCareReceiverMemberId,
            reportDate: notification.relatedReportDate,
            groupId,
          };
    case 'GROUP_JOIN_REQUEST':
      return notification.relatedJoinRequestStatus === 'PENDING_ADMIN'
        ? {kind: 'joinApproval', groupId}
        : {kind: 'groupInfo', groupId};
  }
}
