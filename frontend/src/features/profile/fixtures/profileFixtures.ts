import type {
  CareReceiverProfile,
  GuardianProfile,
  QuickStartStep,
  WeeklyStampBoard,
} from '../types';

// 앱 버전 표기(I-1 하단). 실제 빌드 정보 연동 전까지 mock 상수로 둔다.
export const APP_VERSION = '3.11.9';

// I-1·I-2 mock 프로필. 스크린샷의 이종철 보호자 기준.
export const GUARDIAN_PROFILE: GuardianProfile = {
  age: 27,
  birthDate: '1999.08.02',
  gender: 'male',
  hasCrown: true,
  joinedAt: '2026.06.10',
  loginId: 'whdcjflee',
  name: '이종철',
  weeklyRank: 1,
};

// J-1·J-2 mock 프로필. 스크린샷의 손수호 피보호자 기준(효자 도장 없음, 관심사 보유).
export const CARE_RECEIVER_PROFILE: CareReceiverProfile = {
  age: 67,
  birthDate: '1959.05.20',
  gender: 'male',
  interests: ['가족과 일상', '산책과 운동', '역사와 추억', '임영웅', '츄'],
  loginId: 'soohohshon',
  name: '손수호',
};

// I-1 주간 효자 도장 현황. 월~일 7일 중 게시글을 남긴 날만 채워진다.
// (스펙: 보호자가 한 건 이상 작성한 KST 날짜마다 카네이션 하나, 주 최대 7개)
export const GUARDIAN_WEEKLY_STAMPS: WeeklyStampBoard = {
  days: [true, false, true, true, true, true, false],
  title: '2026년 7월 3째주 효자도장 현황',
};

// I-5 월간 도장의 기준(현재) 월. 모달은 이 달로 열리고 이후 달로는 넘어가지 않는다.
export const MONTHLY_STAMP_YEAR = 2026;
export const MONTHLY_STAMP_MONTH = 7;
// 적립 날짜(mock). 가입월(6월)부터 기준월(7월)까지 존재한다.
export const MONTHLY_STAMP_DATES: readonly string[] = [
  '2026-06-11',
  '2026-06-12',
  '2026-06-15',
  '2026-06-18',
  '2026-06-19',
  '2026-06-22',
  '2026-06-25',
  '2026-06-26',
  '2026-06-29',
  '2026-06-30',
  '2026-07-01',
  '2026-07-03',
  '2026-07-04',
  '2026-07-06',
  '2026-07-07',
  '2026-07-08',
  '2026-07-09',
  '2026-07-10',
  '2026-07-13',
  '2026-07-14',
  '2026-07-15',
  '2026-07-16',
  '2026-07-17',
  '2026-07-20',
  '2026-07-21',
  '2026-07-22',
  '2026-07-24',
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
];

// I-7 빠른 시작 3단계.
export const QUICK_START_STEPS: readonly QuickStartStep[] = [
  {
    description: '가족을 초대할 공간을 만들어요.',
    order: 1,
    title: '가족 그룹 만들기',
  },
  {
    description: '초대 링크를 공유해요.',
    order: 2,
    title: '가족 초대하기',
  },
  {
    description: '오늘의 일상을 기록해요.',
    order: 3,
    title: '첫 게시글 남기기',
  },
];

