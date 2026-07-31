import type {JoinRequest} from '../types';

// 그룹별 초대 코드 목업(6자리 숫자). API 연동 시 API-GROUPS-007 응답으로 대체된다.
const DEVELOPMENT_INVITE_CODES: Record<string, string> = {
  'development-guardian-group': '176203',
  'development-care-receiver-group': '482915',
  'development-empty-group': '305774',
};

const DEFAULT_INVITE_CODE = '176203';

// 그룹별 대기 중 가입 요청 목업. 신청자는 아직 그룹에 없는 사람이다.
// pendingJoinCount(groupInfoFixtures)와 건수를 맞춘다. profileImageUrl은
// 연동 전이라 null이며, 화면은 이 값이 있으면 이미지, 없으면 이니셜로 그린다.
const DEVELOPMENT_JOIN_REQUESTS: Record<string, readonly JoinRequest[]> = {
  // H-5 목업: 손수호, 이종철 2건.
  'development-guardian-group': [
    {
      joinRequestId: 'jr-suho',
      applicantUserId: 'applicant-suho',
      applicantName: '손수호',
      profileImageUrl: null,
      status: 'PENDING_ADMIN',
      assignedRole: null,
      processedAt: null,
      createdAt: '2026-07-30T09:12:00Z',
    },
    {
      joinRequestId: 'jr-jongcheol',
      applicantUserId: 'applicant-jongcheol',
      applicantName: '이종철',
      profileImageUrl: null,
      status: 'PENDING_ADMIN',
      assignedRole: null,
      processedAt: null,
      createdAt: '2026-07-30T10:40:00Z',
    },
  ],
  'development-care-receiver-group': [],
  'development-empty-group': [
    {
      joinRequestId: 'jr-boknyeo',
      applicantUserId: 'applicant-boknyeo',
      applicantName: '한복녀',
      profileImageUrl: null,
      status: 'PENDING_ADMIN',
      assignedRole: null,
      processedAt: null,
      createdAt: '2026-07-29T21:05:00Z',
    },
  ],
};

export function getDevelopmentInviteCode(groupId: string): string {
  return DEVELOPMENT_INVITE_CODES[groupId] ?? DEFAULT_INVITE_CODE;
}

export function getDevelopmentJoinRequests(
  groupId: string,
): readonly JoinRequest[] {
  return DEVELOPMENT_JOIN_REQUESTS[groupId] ?? [];
}
