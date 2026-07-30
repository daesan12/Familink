# managerMemberId 구성 규칙 확정

- 상태: 승인·반영 완료
- 제안자: 이경호
- 작성일: 2026-07-29
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md` `API-GROUPS-002`·`API-GROUPS-004`·「계약상 미결정」, `contracts/DATA_MODEL.md` 「미결정」
- 관련 작업: S15P11B104-117

## 기존 내용

`docs/specs/contracts/API.md` 195~196행 「계약상 미결정」은 다음을 명시한다.

> `API-GROUPS-002`·`004`의 `managerMemberId`를 `group_members.is_manager`에서 구성하는 정확한 규칙

`docs/specs/contracts/DATA_MODEL.md` 295~296행도 같은 내용을 미결정으로 둔다.

> 그룹 API의 `managerMemberId`는 `family_groups` 컬럼이 아니다. `group_members.is_manager`에서 응답을 구성하는 정확한 규칙은 확정되지 않았다.

즉 `managerMemberId`가 `group_members.id`인지 `users.id`인지, 관리자가 없는 그룹에서 어떤 값을 반환하는지가 정해져 있지 않다.

## 제안 내용

`managerMemberId`를 다음과 같이 확정한다.

- 값의 정체: 해당 그룹에서 `is_manager = true`이고 `left_at IS NULL`인 `group_members` 행의 `id`다. `users.id`가 아니다.
- 유일성: `uq_group_active_manager` 부분 Unique 인덱스가 그룹당 활성 관리자를 최대 한 명으로 보장하므로 후보는 항상 0개 또는 1개다.
- 활성 관리자가 없는 경우: `null`을 반환한다. 오류로 처리하지 않는다.
- `API-GROUPS-002`의 응답에서는 방금 생성된 생성자 멤버십의 `id`가 그대로 `managerMemberId`가 된다.
- `API-GROUPS-004`의 `isManager`는 조회 요청자 본인의 활성 멤버십 `is_manager` 값이며, `managerMemberId`와 별도로 계산한다.

검증 문장: 관리자와 피보호자가 각각 한 명인 그룹을 피보호자가 조회하면 `managerMemberId`는 관리자 구성원의 `group_members.id`이고 `isManager`는 `false`다. 그룹을 생성하면 응답의 `managerMemberId`가 생성자의 새 멤버십 `id`와 같다.

## 변경 근거

- `API-GROUPS-005`·`010`·`011`·`012`·`015`가 모두 `memberId`를 `group_members.id`로 사용하고, `API-GROUPS-011`의 요청 필드가 `newManagerMemberId`이므로 `managerMemberId`도 같은 식별자 공간이어야 클라이언트가 위임 요청을 그대로 만들 수 있다. `users.id`로 해석하면 두 종류의 ID가 같은 응답에 섞인다.
- `null` 허용이 필요한 이유는 관리자가 그룹을 나가는 경로(`API-GROUPS-013`)와 탈퇴 경로가 모두 위임을 요구하지만, 마지막 구성원 탈퇴나 데이터 정합성 문제로 활성 관리자가 일시적으로 없는 상태가 만들어질 수 있기 때문이다. 이때 조회를 실패시키면 구성원이 그룹 화면 자체에 진입하지 못한다.
- 2026-07-29 구현은 위 규칙을 적용했다. 계약이 확정되기 전 구현이므로 다른 결론이 나오면 응답 구성 코드를 수정해야 한다.
- 구현과 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupService.java`, `backend/src/test/java/com/ssafy/s15p11b104/domain/group/GroupApiTest.java`

## 확인된 영향

- 영향 도메인: 그룹·멤버십의 그룹 생성과 그룹 상세 조회
- 영향 계약: `contracts/API.md` 「계약상 미결정」에서 해당 항목을 제거하고 `API-GROUPS-002`·`004` 설명에 규칙을 추가한다. `contracts/DATA_MODEL.md` 「미결정」의 같은 항목도 정리한다. Method, Path, 필드 이름과 테이블 구성은 변경하지 않는다.
- 영향 화면: 확인 필요. 그룹 정보 화면에서 관리자 표시가 `managerMemberId`와 구성원 목록의 `memberId`를 비교하는 방식이면 이 규칙이 전제된다.
- 검증 범위: `GroupApiTest`에서 생성 응답의 `managerMemberId`가 생성자 멤버십 `id`와 일치하는지, 상세 조회에서 관리자 구성원의 `id`가 반환되고 비관리자의 `isManager`가 `false`인지 검증했다. 활성 관리자가 없는 그룹의 `null` 반환은 해당 상태를 만드는 API(`API-GROUPS-011`·`013`)가 구현되지 않아 검증하지 못했다.

## 확인이 필요한 질문

- 활성 관리자가 없는 그룹에서 `managerMemberId`를 `null`로 둘지, 이런 상태 자체를 금지할지.
- 프론트엔드가 `managerMemberId`를 `users.id`로 이미 가정하고 있는지 확인이 필요하다.

## 결정 및 반영

- 결정: 전체 승인. `managerMemberId`는 활성 관리자
  `group_members.id`이며, 활성 관리자가 없으면 `null`을 반환한다.
  `API-GROUPS-002`는 생성자의 새 멤버십 ID를 반환하고,
  `API-GROUPS-004`의 `isManager`는 요청자 멤버십에서 별도 계산한다.
- 결정자: 사용자
- 결정일: 2026-07-30
- 승인 근거: 사용자가 ERD 관련 승인 대기 2번을 제안 내용 그대로
  승인했다.
- 반영 문서: `docs/specs/contracts/API.md`,
  `docs/specs/contracts/DATA_MODEL.md`
- 반영 커밋:
