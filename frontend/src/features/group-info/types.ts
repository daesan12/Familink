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
  age: number;
  // 성별.
  gender: MemberGender;
  // 이번 주 카네이션 랭킹 순위. 1위는 왕관을 함께 표시한다.
  weeklyRank: number;
  // 최근 7일 카네이션(도장) 적립 여부. 길이는 WEEKLY_STAMP_DAYS다.
  weeklyStamps: readonly boolean[];
}
