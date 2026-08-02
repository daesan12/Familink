import type {GroupRole} from '../../app-shell';

export type MemberGender = 'male' | 'female';

// 축소 프로필 팝업(H-1p)에 쓰는 일주일 도장 칸 수.
export const WEEKLY_STAMP_DAYS = 7;

// 그룹 구성원 한 명의 정보.
// FE 화면 구현 단계라 목업으로 채우지만, 필드명은 API 계약
// (API-GROUPS-005: members[{memberId,userId,displayName,role,isManager}],
//  API-GROUPS-015: age·gender, API-ALIASES-001: alias)과 맞춘다.
export interface GroupMember {
  // 그룹 멤버십 식별자.
  memberId: string;
  userId?: string;
  // 대상자의 실제 이름. 호칭 미설정 시 이 이름을 표시한다.
  name: string;
  // 조회자가 설정한 개인화 호칭. 없으면 null이며 실제 이름을 표시한다.
  // 변경 호칭은 설정자 본인 화면에만 적용한다.
  alias: string | null;
  // 그룹 내 역할. 관리자(방장) 여부와는 별개다.
  role: GroupRole;
  // 그룹 관리자(방장) 여부. 역할과 독립적으로 한 명만 true다.
  isManager: boolean;
  // 아바타 이미지 연동 전 자리표시자 텍스트.
  avatarText: string;
  // 만 나이. 축소 프로필 팝업에 "만 N세"로 표시한다.
  age: number | null;
  // 성별.
  gender: MemberGender | null;
  // 이번 주 카네이션 랭킹 순위. 1위는 왕관을 함께 표시한다.
  weeklyRank?: number;
  // 최근 7일 카네이션(도장) 적립 여부. 길이는 WEEKLY_STAMP_DAYS다.
  weeklyStamps?: readonly boolean[];
  previousWeekWinner?: boolean;
  // 그룹 가입일(ISO). 어떤 조회 API도 내려주지 않아(계약 밖) H-7 구성원 내보내기에서만
  // 목업으로 표시한다. DB group_members.joined_at에는 존재하며, 연동 시 서버 값으로 대체한다.
  joinedAt?: string;
}

// H-3 주간 효자 랭킹의 한 줄. 필드명은 API-CARNATION-001
// (GET /groups/{groupId}/grass) 응답의 rankings[] 항목과 맞춘다.
// 카네이션은 보호자만 적립하므로 서버도 보호자만 내려준다.
export interface WeeklyRankingEntry {
  memberId: string;
  // 표시 이름. 아바타 이니셜은 이 값에서 파생한다(avatarInitial).
  displayName: string;
  // 이번 주에 적립한 카네이션 수. 순위 산정 기준이다.
  carnationCount: number;
  // 지난주 카네이션 1위 여부. 이번 주에 왕관을 단다.
  // 이번 주 순위와 무관하며, 지난주 공동 1위면 여러 명이 true일 수 있다.
  previousWeekWinner: boolean;
}

// 공동 순위를 반영한 표준 경쟁 순위(1,1,3 …)를 매긴 한 줄.
// rank는 서버가 내려주지 않고 조회 시점에 carnationCount로 계산한다(rankEntries).
export interface RankedEntry extends WeeklyRankingEntry {
  rank: number;
}

// API-CARNATION-001 응답 형식. 연동 시 이 묶음이 서버 응답으로 대체된다.
export interface WeeklyRankingSnapshot {
  // 집계 주간의 시작(월요일)·끝(일요일). KST 기준 ISO 날짜(YYYY-MM-DD).
  weekStart: string;
  weekEnd: string;
  rankings: readonly WeeklyRankingEntry[];
}

// 주간 랭킹 조회의 로드 상태. 피드(useFeed)와 같은 형태를 따른다.
export type WeeklyRankingLoadState =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'success'; snapshot: WeeklyRankingSnapshot};

// API-GROUPS-007 GET /groups/{groupId}/invite-code 응답.
// 유효 기간 필드는 없어 화면의 "제한 없음"은 정적 표기다.
export interface GroupInviteCode {
  inviteCode: string;
}

// H-4 그룹 코드 조회 로드 상태.
export type GroupInviteCodeLoadState =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'success'; inviteCode: string};

// API-GROUPS-008/009의 가입 요청 상태.
export type JoinRequestStatus = 'PENDING_ADMIN' | 'APPROVED' | 'REJECTED';

// API-GROUPS-008 GET /groups/{groupId}/join-requests 응답의 joinRequests[] 항목.
export interface JoinRequest {
  joinRequestId: string;
  applicantUserId: string;
  // 신청자 표시 이름. 아바타 이니셜은 이 값에서 파생한다.
  applicantName: string;
  // 신청자 프로필 이미지 URL. 없으면 이니셜 아바타로 대체한다.
  profileImageUrl: string | null;
  status: JoinRequestStatus;
  // 승인 시 지정된 역할. 대기 중이면 null이다.
  assignedRole: GroupRole | null;
  // 처리 시각(ISO). 대기 중이면 null이다.
  processedAt: string | null;
  // 신청 시각(ISO).
  createdAt: string;
}

// H-5 가입 승인 대기 목록 로드 상태.
export type JoinRequestsLoadState =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'success'; requests: readonly JoinRequest[]};

// API-GROUPS-009 PATCH .../join-requests/{joinRequestId} 요청 결정.
export type JoinRequestDecision = 'APPROVE' | 'REJECT';

// 가입 요청 처리 입력. 승인이면 역할을 함께 전달한다.
export interface JoinRequestDecisionInput {
  joinRequestId: string;
  decision: JoinRequestDecision;
  assignedRole?: GroupRole;
}
