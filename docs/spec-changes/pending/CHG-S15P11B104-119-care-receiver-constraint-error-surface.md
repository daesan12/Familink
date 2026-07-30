# 활성 피보호자 제약이 DB에서 걸릴 때의 오류 응답 정의

- 상태: 제안
- 제안자: rudgh8182
- 작성일: 2026-07-30
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md`(API-GROUPS-002, API-GROUPS-009, API-GROUPS-010), `contracts/DATA_MODEL.md`(`group_members`), `domains/GROUPS_AND_MEMBERSHIP.md`
- 관련 작업: S15P11B104-119

## 기존 내용

`docs/specs/contracts/DATA_MODEL.md`의 `group_members` 절은 활성 피보호자 제약을
부분 유니크 인덱스로 규정한다.

> 한 사용자는 활성 피보호자로 한 그룹에만 속함:
> `uq_user_active_care_receiver(user_id) WHERE role = 'CARE_RECEIVER' AND left_at IS NULL`

`docs/specs/contracts/API.md`의 「명시 오류」는 이 제약과 관련해 다음과 같다.

- `API-GROUPS-002`(`POST /groups`): `명시 없음`
- `API-GROUPS-009`(`PATCH /groups/{groupId}/join-requests/{joinRequestId}`):
  `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP` 포함
- `API-GROUPS-010`(`PATCH /groups/{groupId}/members/{memberId}/role`):
  `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP` 포함

세 항목 모두 이 제약이 **애플리케이션 사전 검사에서 걸릴 때**의 응답만 다룬다.
사전 검사를 통과한 뒤 DB 인덱스가 최종적으로 거부할 때 API가 무엇을 응답해야
하는지는 어느 문서에도 정의되어 있지 않다. `GROUPS_AND_MEMBERSHIP.md`의 확정된
예외 목록에도 이 경우가 없다.

## 제안 내용

1. 활성 피보호자 제약이 DB 인덱스에서 거부되는 경우에도 API는 사전 검사와 동일하게
   `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`을 응답한다. 사전 검사 통과
   여부는 클라이언트에게 구분되지 않는다.
2. `API-GROUPS-002`의 「명시 오류」에
   `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`을 추가한다. 이 API는
   `myRole=CARE_RECEIVER`로 그룹을 생성할 수 있어 같은 제약의 대상이다.
3. `DATA_MODEL.md`의 "최종 보장은 부분 유니크 인덱스가 담당한다"는 서술에, 인덱스가
   거부한 결과를 계약된 오류 코드로 변환해야 한다는 요건을 함께 명시한다.

검증 가능한 형태:

- 서로 다른 두 그룹에서 같은 사용자를 동시에 `CARE_RECEIVER`로 지정하면, 한 요청은
  성공하고 다른 요청은 `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`으로
  끝난다. `500`이 응답되지 않는다.
- `POST /groups`를 `myRole=CARE_RECEIVER`로 두 번 동시에 호출하면 한 번만 성공하고
  나머지는 `409`다.

## 변경 근거

S15P11B104-119(`API-GROUPS-010` 구현) 리뷰에서 확인했다.

사전 검사는 세 곳에 있고 모두 잠금 없이 조회한다.

- `backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupService.java`
  `isActiveCareReceiver`
- `backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/JoinRequestService.java`
  `isActiveCareReceiver`
- `backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupMemberService.java`
  `hasOtherActiveCareReceiverMembership`

세 검사 모두 다른 그룹의 멤버십 행을 잠그지 않으므로, 두 트랜잭션이 같은 사용자를
서로 다른 그룹에서 동시에 `CARE_RECEIVER`로 지정하면 양쪽 사전 검사를 모두
통과한다. 나중에 커밋하는 트랜잭션에서 `uq_user_active_care_receiver` 위반이
`DataIntegrityViolationException`으로 올라온다.

`backend/src/main/java/com/ssafy/s15p11b104/global/exception/GlobalExceptionHandler.java`
에는 `DataIntegrityViolationException` 핸들러가 없다. 이 클래스의 주석은 "계약에 없는
오류 코드를 만들지 않기 위해 예상하지 못한 예외는 처리하지 않고 프레임워크 기본 처리에
맡긴다"고 명시하므로, 현재 동작은 `500`이다. 즉 계약이 `409`를 명시한
`API-GROUPS-009`·`API-GROUPS-010`에서도 이 경로로는 계약을 만족하지 못한다.

이 제안이 필요한 이유는 구현 방식만으로 결정할 수 없기 때문이다. 위반된 제약을 특정해
`409`로 변환하려면 DB 제약 이름(`uq_user_active_care_receiver`)에 의존하거나, 사전
검사에 그룹 간 잠금을 도입해야 한다. 전자는 스키마 식별자를 애플리케이션 오류 매핑에
결합시키고, 후자는 서로 다른 그룹의 트랜잭션을 직렬화한다. 어느 쪽을 택하는지는 API
계약과 데이터 계약에 함께 남아야 하는 결정이다.

S15P11B104-119에서는 계약에 명시된 사전 검사 경로만 구현하고 테스트했다
(`GroupMemberApiTest.roleChangeIsRejectedWhenUserIsCareReceiverInAnotherGroup`).
동시 경로는 이 제안이 승인된 뒤 별도 작업으로 처리한다.

## 확인된 영향

- 영향 도메인: `GROUPS_AND_MEMBERSHIP`
- 영향 계약: `API.md`의 `API-GROUPS-002`·`API-GROUPS-009`·`API-GROUPS-010`,
  `DATA_MODEL.md`의 `group_members`
- 영향 화면: 없음. 오류 코드가 이미 계약에 있는 값이라 클라이언트 분기는 그대로다.
  `API-GROUPS-002`를 호출하는 그룹 생성 화면은 `409` 처리 추가가 필요할 수 있다 —
  확인 필요
- 검증 범위: `GroupService.create`, `JoinRequestService.decide`,
  `GroupMemberService.changeRole`의 동시 실행 테스트와
  `GlobalExceptionHandler`의 예외 매핑

## 확인이 필요한 질문

1. DB 인덱스가 거부한 결과를 `409`로 변환하는 방식을 택할지, 사전 검사에 그룹 간
   잠금을 도입해 위반 자체를 막을지.
2. 변환 방식을 택하면 제약 이름을 오류 코드에 매핑하는 위치를 `GlobalExceptionHandler`로
   할지, 각 서비스에서 `DataIntegrityViolationException`을 잡아 변환할지.
3. `API-GROUPS-002`의 「명시 오류」에 `409`를 추가하면 그룹 생성 화면에 이 실패 안내를
   넣어야 하는지. 현재 UI 스펙에는 해당 문구가 없다.
4. 같은 성격의 제약인 `uq_group_active_manager`도 동일한 규칙을 적용할지. 관리자 위임은
   S15P11B104-119에서 요청자·대상 행을 모두 잠가 위반 경로를 닫았으므로 현재는 문제가
   없지만, 규칙을 문서에 남길지 확인이 필요하다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
