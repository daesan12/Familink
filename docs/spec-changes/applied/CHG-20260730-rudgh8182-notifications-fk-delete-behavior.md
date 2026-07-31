# notifications 선택 FK 삭제 동작을 ON DELETE SET NULL로 확정

- 상태: 승인·반영 완료
- 제안자: rudgh8182
- 작성일: 2026-07-30
- 차단 변경: 아니오
- 영향 스펙·계약: `docs/specs/contracts/DATA_MODEL.md` (`notifications`, 미결정·충돌 절)
- 관련 작업: 없음 (DATA_MODEL.md와 실제 스키마 대조 과정에서 발견)

## 기존 내용

`docs/specs/contracts/DATA_MODEL.md`의 `notifications` 절:

> `title`, `body`는 스냅샷으로 유지한다. 관련 대상 삭제 시 해당 FK를
> NULL로 바꾸거나 스냅샷만 유지한다는 원칙까지만 확정되어 있다.

같은 문서의 `미결정·충돌` 절:

> `notifications`의 관련 일정 등 대상이 삭제될 때 "FK를 NULL 처리"와
> "스냅샷만 유지" 중 정확한 FK 동작은 확정되지 않았다.

## 제안 내용

- 관련 대상 삭제 시 `notifications`의 선택 FK(`actor_user_id`,
  `group_id`, `related_join_request_id`, `related_post_id`,
  `related_event_id`, `related_call_report_id`,
  `related_daily_report_id`)는 `ON DELETE SET NULL`로 NULL 처리하고,
  `title`, `body` 스냅샷은 유지한다고 본문에 확정한다.
- `미결정·충돌` 절에서 해당 항목을 제거한다.

## 변경 근거

- 실제 스키마가 이미 선택 FK 7개 전부에 `ON DELETE SET NULL`을 구현하고
  있다: `backend/src/main/resources/db/migration/V1__create_schema.sql`
  251~257행.
- 사용자(rudgh8182)가 2026-07-30 세션에서 "코드 기준으로 문서 미결정
  사항을 제거"하도록 결정했다.

## 확인된 영향

- 영향 도메인: 알림
- 영향 계약: `docs/specs/contracts/DATA_MODEL.md`
- 영향 화면: 없음 (동작 변경 없음, 문서를 기존 스키마에 맞추는 확정)
- 검증 범위: 문서만 변경. 스키마·코드 변경 없음.

## 결정 및 반영

- 결정: 승인 (코드 기준으로 확정)
- 결정자: rudgh8182
- 결정일: 2026-07-30
- 반영 문서: `docs/specs/contracts/DATA_MODEL.md`
- 반영 커밋:
