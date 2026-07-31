import type {GroupMember} from '../types';

// 그룹정보 화면이 한 그룹을 그릴 때 필요한 목업 묶음.
// API 연동 시 이 묶음이 그룹별 조회 응답으로 대체된다.
export interface GroupInfoSnapshot {
  members: readonly GroupMember[];
  // 조회자(현재 로그인 사용자)로 간주할 구성원. 방장 여부로 역할 토글 권한을 판단한다.
  currentMemberId: string;
  // 가입 승인 대기 건수. "승인 요청 N건" 문구에 쓴다.
  pendingJoinCount: number;
}

// '우리 가족의 이야기' 그룹 (피보호자 2명, 보호자 3명). 이경호가 방장이다.
const FAMILY_MEMBERS: readonly GroupMember[] = [
  {
    memberId: 'member-suho',
    name: '손수호',
    alias: '아빠',
    role: 'guardian',
    isManager: false,
    avatarText: '수',
    age: 52,
    gender: 'male',
    weeklyRank: 4,
    weeklyStamps: [true, true, false, true, false, false, false],
  },
  {
    memberId: 'member-daesan',
    name: '장대산',
    alias: '삼촌',
    role: 'guardian',
    isManager: false,
    avatarText: '대',
    age: 47,
    gender: 'male',
    weeklyRank: 5,
    weeklyStamps: [false, true, false, false, true, false, false],
  },
  {
    memberId: 'member-gyeongho',
    name: '이경호',
    alias: null,
    role: 'guardian',
    isManager: true,
    avatarText: '경',
    age: 30,
    gender: 'male',
    weeklyRank: 2,
    weeklyStamps: [true, true, true, false, true, true, false],
  },
  {
    memberId: 'member-yura',
    name: '홍유라',
    alias: '여동생',
    role: 'careReceiver',
    isManager: false,
    avatarText: '유',
    age: 24,
    gender: 'female',
    weeklyRank: 3,
    weeklyStamps: [true, false, true, true, false, false, true],
  },
  {
    memberId: 'member-jongcheol',
    name: '이종철',
    alias: null,
    role: 'careReceiver',
    isManager: false,
    avatarText: '종',
    age: 27,
    gender: 'male',
    weeklyRank: 1,
    weeklyStamps: [true, false, true, true, true, true, false],
  },
];

// '할머니랑 사촌들' 그룹. 조회자(할머니 박말순)는 피보호자라 역할 토글 권한이 없다.
const COUSINS_MEMBERS: readonly GroupMember[] = [
  {
    memberId: 'member-junho',
    name: '이준호',
    alias: '사촌오빠',
    role: 'guardian',
    isManager: true,
    avatarText: '준',
    age: 28,
    gender: 'male',
    weeklyRank: 2,
    weeklyStamps: [true, false, true, false, false, false, false],
  },
  {
    memberId: 'member-seoyeon',
    name: '이서연',
    alias: '사촌언니',
    role: 'guardian',
    isManager: false,
    avatarText: '서',
    age: 25,
    gender: 'female',
    weeklyRank: 3,
    weeklyStamps: [false, true, false, true, false, false, false],
  },
  {
    memberId: 'member-malsun',
    name: '박말순',
    alias: null,
    role: 'careReceiver',
    isManager: false,
    avatarText: '말',
    age: 79,
    gender: 'female',
    weeklyRank: 1,
    weeklyStamps: [true, true, true, false, true, false, false],
  },
];

// '외갓집 식구들' 그룹. 조회자(엄마 최영숙)가 방장이다.
const MATERNAL_MEMBERS: readonly GroupMember[] = [
  {
    memberId: 'member-youngsook',
    name: '최영숙',
    alias: '엄마',
    role: 'guardian',
    isManager: true,
    avatarText: '영',
    age: 51,
    gender: 'female',
    weeklyRank: 1,
    weeklyStamps: [true, true, false, true, true, false, false],
  },
  {
    memberId: 'member-boknyeo',
    name: '한복녀',
    alias: '외할머니',
    role: 'careReceiver',
    isManager: false,
    avatarText: '복',
    age: 81,
    gender: 'female',
    weeklyRank: 2,
    weeklyStamps: [true, false, false, false, false, false, false],
  },
];

const FAMILY_GROUP_INFO: GroupInfoSnapshot = {
  members: FAMILY_MEMBERS,
  currentMemberId: 'member-gyeongho',
  pendingJoinCount: 2,
};

// App.tsx의 DEVELOPMENT_GROUPS 그룹 ID와 맞춘다.
const DEVELOPMENT_GROUP_INFO: Record<string, GroupInfoSnapshot> = {
  'development-guardian-group': FAMILY_GROUP_INFO,
  'development-care-receiver-group': {
    members: COUSINS_MEMBERS,
    currentMemberId: 'member-malsun',
    pendingJoinCount: 0,
  },
  'development-empty-group': {
    members: MATERNAL_MEMBERS,
    currentMemberId: 'member-youngsook',
    pendingJoinCount: 1,
  },
};

// 그룹 ID에 해당하는 목업을 돌려준다. 알 수 없는 그룹은 가족 그룹으로 대체한다.
export function getDevelopmentGroupInfo(groupId: string): GroupInfoSnapshot {
  return DEVELOPMENT_GROUP_INFO[groupId] ?? FAMILY_GROUP_INFO;
}

// 기존 참조 호환용(우리 가족 그룹 기준).
export const DEVELOPMENT_GROUP_MEMBERS = FAMILY_MEMBERS;
export const DEVELOPMENT_CURRENT_MEMBER_ID = FAMILY_GROUP_INFO.currentMemberId;
export const DEVELOPMENT_PENDING_JOIN_COUNT = FAMILY_GROUP_INFO.pendingJoinCount;
