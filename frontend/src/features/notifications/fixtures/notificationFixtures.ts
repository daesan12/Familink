import type {
  AppNotification,
  NotificationSetting,
  NotificationSettingGroup,
} from '../types';

export const DEVELOPMENT_NOTIFICATIONS: readonly AppNotification[] = [
  {
    actorName: '수호',
    avatarText: '수',
    body: '가족 그룹에 참여하고 싶어 해요.',
    createdAtLabel: '방금',
    groupId: 'development-guardian-group',
    id: 'group-request-suho',
    isRead: false,
    relatedJoinRequestId: 'join-request-suho',
    relatedJoinRequestStatus: 'PENDING_ADMIN',
    requestKind: 'groupJoin',
    title: '수호님의 그룹 승인 요청',
    type: 'GROUP_JOIN_REQUEST',
  },
  {
    avatarText: '경',
    body: '경호님, 다영님이 회원님의 게시글에 하트를 남겼습니다.',
    createdAtLabel: '1시간 전',
    groupId: 'development-guardian-group',
    id: 'post-reaction-love',
    isRead: false,
    postId: 'post-love',
    relatedJoinRequestStatus: null,
    title: '게시글에 새로운 반응이 있어요',
    type: 'POST_ACTIVITY',
  },
  {
    avatarText: '종',
    body: '종철님, 유라님 외 2명이 회원님의 게시글에 놀람을 남겼습니다.',
    createdAtLabel: '어제',
    groupId: 'development-guardian-group',
    id: 'post-reaction-surprise',
    isRead: true,
    postId: 'post-gyeongju',
    relatedJoinRequestStatus: null,
    title: '게시글에 새로운 반응이 있어요',
    type: 'POST_ACTIVITY',
  },
];

export const EMPTY_NOTIFICATIONS: readonly AppNotification[] = [];

// 스펙(NOTIFICATIONS): 7개 항목, 최초 기본값은 모두 true.
export const DEFAULT_NOTIFICATION_SETTINGS: readonly NotificationSetting[] = [
  {
    description: '가족의 새 게시글 알림',
    enabled: true,
    label: '새 게시글',
    type: 'NEW_POST',
  },
  {
    description: '댓글, 좋아요',
    enabled: true,
    label: '내 게시글 반응',
    type: 'POST_ACTIVITY',
  },
  {
    description: '일정 등록, 수정, 삭제',
    enabled: true,
    label: '일정 변경 알림',
    type: 'EVENT_CHANGED',
  },
  {
    description: '등록된 일정 시간이 되었을 때',
    enabled: true,
    label: '일정 시작 알림',
    type: 'EVENT_REMINDER',
  },
  {enabled: true, label: '건당 리포트', type: 'CALL_REPORT'},
  {enabled: true, label: '일일 리포트', type: 'DAILY_REPORT'},
  {
    description: '초대 요청, 가입 요청',
    enabled: true,
    label: '그룹 요청 알림',
    type: 'GROUP_JOIN_REQUEST',
  },
];

// I-6 알림 설정 화면의 섹션 구성. 가족 피드·캘린더·리포트·가족 그룹 순으로 묶는다.
export const NOTIFICATION_SETTING_GROUPS: readonly NotificationSettingGroup[] = [
  {title: '가족 피드', types: ['NEW_POST', 'POST_ACTIVITY']},
  {title: '캘린더', types: ['EVENT_CHANGED', 'EVENT_REMINDER']},
  {title: '리포트', types: ['CALL_REPORT', 'DAILY_REPORT']},
  {title: '가족 그룹', types: ['GROUP_JOIN_REQUEST']},
];
