// 그룹정보 탭 내부 스택의 화면 집합 (S15P11B104-322).
// JoinApproval의 groupId는 그룹 전환이 동반된 딥링크에서 "새 그룹의 승인
// 화면인지"를 판별하는 키다(FeedStack PostDetail.groupId 선례). 나머지
// 화면은 라이브 부모 상태를 children 클로저로 받으므로 params가 없다.
export type GroupInfoStackParamList = {
  GroupInfoHome: undefined;
  GroupCode: undefined;
  JoinApproval: { groupId: string };
  ChangeManager: undefined;
  RemoveMember: undefined;
  LeaveGroup: undefined;
  RenameGroup: undefined;
};
