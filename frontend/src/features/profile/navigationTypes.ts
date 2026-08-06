// 프로필 탭 내부 스택의 화면 집합 (S15P11B104-322).
// 보호자(MyPageScreen)·피보호자(CareReceiverMyPageScreen) 내비게이터가
// 같은 이름 집합을 공유해야 AppShell 재탭 정규화가 단일 코드
// (popTo ProfileHome)로 동작한다. InterestSettings는 피보호자 내비게이터만
// 등록한다 — 보호자 쪽에서 이 이름으로 navigate하는 코드가 없고, 역할 전환
// 재수화 시 미등록 라우트는 StackRouter가 routeNames 기준으로 걸러낸다.
export type ProfileStackParamList = {
  ProfileHome: undefined;
  ProfileEdit: undefined;
  ProfileGuide: undefined;
  NotificationSettings: undefined;
  InterestSettings: undefined;
};
