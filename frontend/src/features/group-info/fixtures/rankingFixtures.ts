import {getCurrentWeekRange} from '../rankingModel';
import type {WeeklyRankingEntry, WeeklyRankingSnapshot} from '../types';

import {getDevelopmentGroupInfo} from './groupInfoFixtures';

// 그룹별 "지난주 1위" memberId. 이번 주에 왕관을 단다.
// 이번 주 순위와 일부러 어긋나게 두어(예: 이번 주 2위가 왕관) 왕관이 지난주 기준임을 드러낸다.
// 지난주 공동 1위를 표현하려면 여러 memberId를 넣으면 된다.
const DEVELOPMENT_LAST_WEEK_WINNERS: Record<string, readonly string[]> = {
  // 손수호는 이번 주 카네이션 2위지만 지난주 1위라 왕관을 단다.
  'development-guardian-group': ['member-suho'],
  // 이준호·이서연은 이번 주 공동 1위다. 지난주 1위는 이서연으로 둔다.
  'development-care-receiver-group': ['member-seoyeon'],
  // 보호자가 최영숙 한 명뿐인 그룹.
  'development-empty-group': ['member-youngsook'],
};

// 그룹 ID에 해당하는 주간 효자 랭킹 목업을 만든다.
// 랭킹은 보호자만 오르므로 보호자만 담는다. 이번 주 게시글 수는 구성원 목업의
// 주간 도장(weeklyStamps)에서 적립 일수로 근사한다. 실제 서버는 같은 날 여러 건도
// 각각 세므로 도장 수보다 큰 값이 올 수 있다. 이 목업은 서버 미연동 개발용이며,
// 실행 중인 앱은 App.tsx가 주입하는 실제 게이트웨이를 사용한다.
export function getDevelopmentWeeklyRanking(
  groupId: string,
  today: Date,
): WeeklyRankingSnapshot {
  const {members} = getDevelopmentGroupInfo(groupId);
  const lastWeekWinners = new Set(
    DEVELOPMENT_LAST_WEEK_WINNERS[groupId] ?? [],
  );

  const rankings: readonly WeeklyRankingEntry[] = members
    .filter((member) => member.role === 'guardian')
    .map((member) => ({
      memberId: member.memberId,
      displayName: member.name,
      postCount: (member.weeklyStamps ?? []).filter(Boolean).length,
      previousWeekWinner: lastWeekWinners.has(member.memberId),
    }));

  return {...getCurrentWeekRange(today), rankings};
}
