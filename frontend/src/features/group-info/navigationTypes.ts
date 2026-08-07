// 그룹정보 탭 내부 스택의 화면 집합 (S15P11B104-322).
// 모든 화면이 라이브 부모 상태를 children 클로저로 받으므로 params가 없다.
// JoinApproval에 있던 groupId는 그룹 전환이 동반된 딥링크가 이 스택에 도달할
// 때의 판별자였으나, 그 딥링크가 피드 탭 스택으로 옮겨져 소비처를 잃었다
// (S15P11B104-336, 369).
export type GroupInfoStackParamList = {
  GroupInfoHome: undefined;
  GroupCode: undefined;
  JoinApproval: undefined;
  ChangeManager: undefined;
  RemoveMember: undefined;
  LeaveGroup: undefined;
  RenameGroup: undefined;
};
