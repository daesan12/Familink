import {getDevelopmentWeeklyRanking} from '../fixtures/rankingFixtures';
import type {WeeklyRankingSnapshot} from '../types';

// 그룹 ID로 주간 효자 랭킹을 조회하는 로더. 테스트·연동에서 주입할 수 있다.
export type WeeklyRankingLoader = (
  groupId: string,
) => Promise<WeeklyRankingSnapshot>;

// 개발 목업 로더. API 연동 시 이 함수만 API-CARNATION-001
// (GET /groups/{groupId}/grass) 호출로 교체하면 화면·훅은 그대로 재사용된다.
export async function loadWeeklyRanking(
  groupId: string,
): Promise<WeeklyRankingSnapshot> {
  await Promise.resolve();
  return getDevelopmentWeeklyRanking(groupId, new Date());
}
