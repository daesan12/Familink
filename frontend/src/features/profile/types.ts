export type Gender = 'male' | 'female';

export interface ProfileImageAsset {
  contentType: string;
  fileName: string;
  sizeBytes: number;
  uri: string;
}

export type ProfileImageChange =
  | {type: 'unchanged'}
  | {type: 'remove'}
  | {asset: ProfileImageAsset; type: 'replace'};

// 마이페이지·프로필 편집에서 두 역할이 공통으로 다루는 본인 프로필 필드.
// 필드명은 ACCOUNT_AND_PROFILE 계약을 따르며 API 연동 전이라 mock 값으로 채운다.
export interface BaseProfile {
  age: number;
  birthDate: string; // 'YYYY.MM.DD' 표시 형식
  gender: Gender;
  loginId: string;
  name: string;
  profileImageUrl?: string | null;
}

// 보호자 마이페이지(I-1). 효자 도장·주간 랭킹·왕관을 함께 다룬다.
export interface GuardianProfile extends BaseProfile {
  // 지난주 1위 여부(왕관 표시). CARNATIONS_AND_RANKING 규칙.
  hasCrown: boolean;
  // 가입일('YYYY.MM.DD'). 효자 도장 월간 조회의 시작 월 하한이 된다.
  joinedAt: string;
  weeklyRank: number;
}

// 피보호자 마이페이지(J-1). 효자 도장 대신 관심사를 다룬다(카네이션은 보호자 전용).
export interface CareReceiverProfile extends BaseProfile {
  interests: readonly string[];
}

// I-1 효자 도장(카네이션) 주간 현황. 하루 한 건 이상 작성하면 도장 하나가 채워진다.
export interface WeeklyStampBoard {
  // 월~일 7일의 적립 여부.
  days: readonly boolean[];
  title: string;
}

// I-7 이용 가이드의 빠른 시작 단계.
export interface QuickStartStep {
  description: string;
  order: number;
  title: string;
}
