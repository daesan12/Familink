// 캘린더 탭 내부 스택의 화면 집합 (S15P11B104-323).
// CalendarHome.openEventId는 알림 딥링크가 여는 일정 상세의 대상이다. 루트
// 화면 params라 재탭 재수화 때 남지 않도록 소비 직후 setParams로 비운다.
// CalendarEventForm의 edit 모드는 eventId만 싣고 상세 데이터는 CalendarHome이
// 스태시한다 — 상세를 params에 실으면 재수화 때 낡은 일정으로 저장될 수 있다.
export type CalendarStackParamList = {
  CalendarHome: { openEventId?: string } | undefined;
  CalendarEventForm: { mode: 'create' } | { mode: 'edit'; eventId: string };
};
