# 그룹 생성·수정 API의 명시 오류 확정

- 상태: 제안
- 제안자: 이경호
- 작성일: 2026-07-29
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md` `API-GROUPS-002`·`API-GROUPS-006`, `domains/GROUPS_AND_MEMBERSHIP.md` 「확정된 동작」 1·13번
- 관련 작업: S15P11B104-117
- 관련 제안: [`CHG-S15P11B104-114-common-response-envelope.md`](./CHG-S15P11B104-114-common-response-envelope.md)

## 기존 내용

`docs/specs/contracts/API.md` 10~12행은 다음을 규정한다.

> 표의 성공 결과는 원본 성공 응답의 핵심 `data` 내용이다. 오류가 “명시 없음”인 행에도 구현자가 관례적인 오류 코드를 추가해서는 안 되며, 먼저 계약을 확정해야 한다.

그런데 같은 문서 75행 `API-GROUPS-002`(`POST /groups`)와 79행 `API-GROUPS-006`(`PATCH /groups/{groupId}`)의 「명시 오류」는 모두 `명시 없음`이다. 두 API는 각각 `name`·`myRole`을 받고 `name`을 수정하므로 검증 실패와 권한 실패가 반드시 발생하지만, 반환할 오류 코드가 계약에 없다.

또 `docs/specs/domains/GROUPS_AND_MEMBERSHIP.md` 「확정된 동작」 13번은 "피보호자는 동시에 하나의 활성 그룹에만 참여할 수 있다"고 규정하고, `docs/specs/contracts/DATA_MODEL.md`의 `uq_user_active_care_receiver` 부분 Unique 인덱스가 이를 강제한다. 그러나 이미 활성 피보호자인 사용자가 `myRole=CARE_RECEIVER`로 그룹을 생성할 때 반환할 오류 코드는 어느 문서에도 없다. 같은 규칙을 다루는 `API-GROUPS-009`·`API-GROUPS-010`에는 `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`이 정의되어 있다.

## 제안 내용

`API-GROUPS-002`의 「명시 오류」를 다음으로 확정한다.

- `400 INVALID_REQUEST`: `name`이 없거나 trim 후 1~10자를 벗어나는 경우, `myRole`이 없거나 `GUARDIAN`·`CARE_RECEIVER`가 아닌 경우
- `401 UNAUTHORIZED`: Access Token 없음·만료·위조
- `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`: 이미 다른 그룹의 활성 피보호자인 사용자가 `myRole=CARE_RECEIVER`로 생성을 요청한 경우

`API-GROUPS-006`의 「명시 오류」를 다음으로 확정한다.

- `400 INVALID_REQUEST`: `name`이 없거나 trim 후 1~10자를 벗어나는 경우
- `401 UNAUTHORIZED`: Access Token 없음·만료·위조
- `403 FORBIDDEN`: 요청자가 해당 그룹의 활성 관리자가 아닌 경우

두 API 공통으로 `name`은 trim 후 저장하며, trim 결과가 빈 문자열이면 거부한다. 길이 상한 10자는 `family_groups.name VARCHAR(10)`과 일치시킨다.

검증 문장: 활성 관리자가 아닌 구성원이 `PATCH /groups/{groupId}`를 호출하면 `403 FORBIDDEN`을 받고 그룹 이름이 바뀌지 않는다. 이미 활성 피보호자인 사용자가 `myRole=CARE_RECEIVER`로 `POST /groups`를 호출하면 그룹이 생성되지 않는다.

## 변경 근거

- `API-GROUPS-002`와 `API-GROUPS-006`은 요청 본문을 받는 쓰기 API이므로 검증 실패 응답이 반드시 필요하다. 계약에 오류가 없다고 해서 검증을 생략하면 `family_groups.name VARCHAR(10)` 제약 위반이 500으로 노출된다.
- 피보호자 중복 활성 그룹을 애플리케이션에서 막지 않으면 `uq_user_active_care_receiver` 위반이 DB 예외로 올라온다. 같은 규칙 위반에 `API-GROUPS-009`·`010`은 `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`을 쓰므로, 생성 경로만 다른 코드를 쓰면 클라이언트가 같은 원인을 두 가지로 처리해야 한다.
- 2026-07-29 구현에서는 계약 확정 전이므로 중복 활성 피보호자에 대해 임시로 `400 INVALID_REQUEST`를 반환했다. 이 제안이 승인되면 `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`으로 교체해야 한다.
- 구현과 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupService.java`, `backend/src/test/java/com/ssafy/s15p11b104/domain/group/GroupApiTest.java`

## 확인된 영향

- 영향 도메인: 그룹·멤버십의 그룹 생성과 그룹 정보 수정
- 영향 계약: `contracts/API.md` `API-GROUPS-002`·`API-GROUPS-006`의 「명시 오류」 칸. Method, Path, 요청 필드, 성공 결과와 테이블 구성은 변경하지 않는다. `CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`은 이미 계약에 존재하는 코드이므로 새 코드는 추가되지 않는다.
- 영향 화면: 확인 필요. 그룹 생성 화면에서 피보호자가 이미 다른 그룹에 속한 경우의 안내 문구가 필요하다.
- 검증 범위: `GroupApiTest`에서 이름 공백·길이 초과·`myRole` 누락·허용되지 않은 역할 값에 대한 `400`, 비관리자 수정 `403`, 중복 활성 피보호자 생성 차단을 검증했다. 중복 피보호자 케이스의 응답 코드는 이 제안 승인 시 함께 갱신해야 한다.

## 확인이 필요한 질문

- 중복 활성 피보호자의 생성 차단을 `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`으로 통일할지, 생성 경로에는 별도 코드를 둘지.
- 그룹 이름에 허용할 문자 집합과 중복 그룹명 허용 여부. 현재 구현은 trim 외에 문자 제한을 두지 않고 동명 그룹을 허용한다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
