# 그룹 삭제의 데이터 삭제 범위와 순서 확정

- 상태: 승인·반영 완료
- 제안자: 이경호
- 작성일: 2026-07-29
- 차단 변경: 예
- 영향 스펙·계약: `contracts/DATA_MODEL.md` 「삭제 정책」·「미결정」, `contracts/API.md` `API-GROUPS-014`, `domains/GROUPS_AND_MEMBERSHIP.md` 「미결정 사항」
- 관련 작업: S15P11B104-117
- 관련 제안: [`CHG-S15P11B104-116-withdrawal-side-effects.md`](../pending/CHG-S15P11B104-116-withdrawal-side-effects.md)

## 기존 내용

`docs/specs/contracts/DATA_MODEL.md` 「삭제 정책」 285행은 조건만 규정한다.

> 그룹 삭제: 관리자이면서 다른 활성 구성원이 없을 때만 하드 삭제할 수 있다.

같은 문서 「미결정」과 `docs/specs/domains/GROUPS_AND_MEMBERSHIP.md` 「미결정 사항」 100행은 삭제 방식이 확정되지 않았음을 명시한다.

> 그룹 삭제의 사용자 확인·복구 정책 및 모든 외래키 처리 방식.

`family_groups.id`를 참조하는 테이블은 `group_members`, `group_join_requests`, `member_aliases`, `posts`, `calendar_events`, `call_sessions`, `daily_reports`, `carnations`, `notifications`이며, 이 중 `notifications.group_id`만 `ON DELETE SET NULL`이다. 나머지는 삭제 동작이 지정되지 않아 그룹 행을 지우려는 순간 FK 위반이 발생한다. 즉 현재 스키마에서는 `API-GROUPS-014`를 구현할 수 없다.

## 제안 내용

그룹 삭제를 "그룹 범위 데이터의 하드 삭제"로 확정하고, 한 트랜잭션 안에서 다음 순서로 삭제한다.

1. `member_interests` (해당 그룹의 `group_members`를 참조하는 행)
2. `member_aliases`
3. `posts`
4. `calendar_events`
5. `call_sessions`
6. `daily_reports`
7. `carnations`
8. `group_join_requests`
9. `group_members`
10. `family_groups`

3~5번의 자식 테이블(`post_media`, `comments`, `post_reactions`, `post_analyses`, `event_participants`, `call_transcripts`, `call_reports`)은 스키마의 `ON DELETE CASCADE`로 함께 삭제된다. `notifications`의 `group_id`와 관련 FK 컬럼은 `ON DELETE SET NULL`로 처리되어 알림 레코드 자체는 `title`·`body` 스냅샷과 함께 남는다.

`users`는 삭제하지 않는다. 삭제된 그룹의 구성원 계정과 다른 그룹에서의 활동은 그대로 유지된다.

검증 문장: 다른 활성 구성원이 없는 그룹의 관리자가 `confirmationName`을 정확히 보내 `DELETE /groups/{groupId}`를 호출하면 `204`를 받고, 해당 그룹의 `family_groups`·`group_members`·`group_join_requests` 행과 그룹에 속한 게시글이 모두 사라지며, 삭제 요청자의 `users` 행은 남는다.

## 변경 근거

- FK 처리 방식이 정해지지 않은 채로는 `API-GROUPS-014`가 계약에 정의된 `204`를 반환할 수 없다. 어떤 순서로든 그룹 행을 지우려면 참조 행을 먼저 정리해야 한다.
- 삭제 조건이 "다른 활성 구성원이 없을 때"이므로, 남아 있는 참조 데이터는 대부분 이미 그룹을 떠난 구성원의 과거 기록이다. 이 기록은 그룹이 사라지면 조회 경로도 함께 사라지므로 보존 가치가 없다.
- 대안으로 그룹을 소프트 삭제(비활성 플래그)하는 방식이 있으나, `family_groups`에 상태 컬럼이 없고 스펙이 "하드 삭제"를 명시하므로 스키마 변경 없이는 선택할 수 없다.
- 2026-07-29 구현은 위 순서를 그대로 적용한 네이티브 삭제문을 사용한다. 스키마에 `ON DELETE CASCADE`를 추가하는 방식도 같은 결과를 내지만 마이그레이션이 필요하므로 이 제안의 승인 대상에 포함한다.
- 구현과 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupService.java`, `backend/src/test/java/com/ssafy/s15p11b104/domain/group/GroupApiTest.java`

## 확인된 영향

- 영향 도메인: 그룹·멤버십의 그룹 삭제. 피드, 일정, 통화, 리포트, 카네이션, 알림의 데이터 수명주기
- 영향 계약: `contracts/DATA_MODEL.md` 「삭제 정책」에 그룹 삭제 범위와 순서를 추가하고 「미결정」에서 해당 항목을 제거한다. `domains/GROUPS_AND_MEMBERSHIP.md` 「미결정 사항」의 외래키 처리 항목도 함께 정리한다. `API-GROUPS-014`의 Method·Path·요청·응답은 변경하지 않는다.
- 영향 화면: 확인 필요. 삭제 확인 화면에 "그룹의 게시글·일정·리포트가 함께 삭제된다"는 안내가 필요하다.
- 검증 범위: `GroupApiTest`에서 게시글과 가입 요청이 남아 있는 단독 관리자 그룹의 삭제가 `204`로 성공하고 관련 행이 모두 제거되는 것을 검증했다. FK 가드 테스트에서는 일정·통화·리포트·카네이션을 포함한 승인된 모든 삭제 경로에 실제 데이터를 넣고 `GroupService.delete` 호출 후 정리 결과를 검증했다.

## 확인이 필요한 질문

- 없음. 현행 애플리케이션 명시적 삭제 방식과 기존 FK의
  `NO ACTION`·`CASCADE`·`SET NULL` 정책을 유지한다.

## 결정 및 반영

- 결정: 전체 승인. 그룹 범위 데이터는 현행 Spring Boot 명시적 삭제 순서를
  유지하고, 기존 FK의 `NO ACTION`·`ON DELETE CASCADE`·
  `ON DELETE SET NULL` 정책을 변경하지 않는다. 실제 PostgreSQL·Flyway
  스키마의 `information_schema`를 조회하는 가드 테스트에서 승인된 FK 목록,
  `delete_rule`과 정리 방식을 검증하며, 미등록 FK 추가 또는 정책 변경 시
  실패시킨다.
- 결정자: 사용자
- 결정일: 2026-07-30
- 반영 문서: `docs/specs/domains/GROUPS_AND_MEMBERSHIP.md`,
  `docs/specs/contracts/DATA_MODEL.md`,
  `backend/src/test/java/com/ssafy/s15p11b104/domain/group/GroupDeletionForeignKeyContractTest.java`
- 반영 커밋:
- 검증: PostgreSQL 16 Testcontainers·Flyway 기준 FK 가드 테스트 3건과
  기존 그룹 API 통합 테스트 18건 통과
