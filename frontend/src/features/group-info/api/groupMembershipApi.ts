import {getDevelopmentJoinRequests} from '../fixtures/groupMembershipFixtures';
import {getInviteCode} from './groupApi';
import type {
  GroupInviteCode,
  JoinRequest,
  JoinRequestDecisionInput,
} from '../types';

// 그룹 초대 코드를 조회하는 로더. 테스트·연동에서 주입할 수 있다.
export type GroupInviteCodeLoader = (
  groupId: string,
) => Promise<GroupInviteCode>;

// 대기 중 가입 요청 목록을 조회하는 로더.
export type JoinRequestsLoader = (
  groupId: string,
) => Promise<readonly JoinRequest[]>;

// 가입 요청 승인·거절을 처리하는 커맨드. 연동 전에는 로컬 상태만 갱신하도록
// 기본값을 no-op으로 두고, 연동 시 API-GROUPS-009 호출로 교체한다.
export type JoinRequestProcessor = (
  groupId: string,
  input: JoinRequestDecisionInput,
) => Promise<void>;

export async function loadGroupInviteCode(
  groupId: string,
): Promise<GroupInviteCode> {
  return getInviteCode(groupId);
}

// 개발 목업 로더. API 연동 시 이 함수만 API-GROUPS-008 호출로 교체한다.
export async function loadJoinRequests(
  groupId: string,
): Promise<readonly JoinRequest[]> {
  await Promise.resolve();
  return getDevelopmentJoinRequests(groupId);
}
