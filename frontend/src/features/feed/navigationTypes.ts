// 피드 탭 내부 스택의 화면 집합 (S15P11B104-321).
// PostDetail의 groupId는 그룹 전환이 동반된 딥링크에서 "현재 그룹의 상세인지"를
// 판별하는 키다. PostComposer는 셸 스택이 아니라 피드 스택 화면이다 — 탭바
// 숨김은 내비게이터가 아니라 풀스크린 신호가 담당하므로(320 팀 결정) 셸로
// 승격할 이유가 없고, 업로드 상태 머신을 FeedScreen 스코프에 유지할 수 있다.
export type FeedStackParamList = {
  FeedHome: undefined;
  PostDetail: {
    entrySource?: 'feed' | 'notification';
    groupId: string;
    postId: string;
  };
  PostComposer: { mode: 'create' } | { mode: 'edit'; postId: string };
  // 셸이 소유하는 공유 하위 화면 (S15P11B104-367). 피드 탭 스택 화면으로 열려
  // 뒤로가기 pop이 진입 지점으로 돌아갈 수 있게 된다. 라우트 이름은 AppRoute와
  // 같은 소문자로 맞춰 이름 매핑 계층을 만들지 않는다.
  archive: undefined;
  notifications: undefined;
};
