import type {AppNotification, NotificationSetting} from '../types';

export const DEVELOPMENT_NOTIFICATIONS: readonly AppNotification[] = [
  {
    avatarText: '수',
    body: '가족 그룹에 참여하고 싶어 해요.',
    createdAtLabel: '방금',
    id: 'group-request-suho',
    isRead: false,
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
    title: '게시글에 새로운 반응이 있어요',
    type: 'POST_ACTIVITY',
  },
];

export const EMPTY_NOTIFICATIONS: readonly AppNotification[] = [];

export const DEFAULT_NOTIFICATION_SETTINGS: readonly NotificationSetting[] = [
  {enabled: true, label: '새 게시글', type: 'NEW_POST'},
  {enabled: true, label: '게시글 반응', type: 'POST_ACTIVITY'},
  {enabled: true, label: '일정 변경', type: 'EVENT_CHANGED'},
  {enabled: true, label: '일정 시작', type: 'EVENT_REMINDER'},
  {enabled: true, label: '건별 리포트', type: 'CALL_REPORT'},
  {enabled: true, label: '일일 리포트', type: 'DAILY_REPORT'},
  {enabled: true, label: '그룹 요청', type: 'GROUP_JOIN_REQUEST'},
];
