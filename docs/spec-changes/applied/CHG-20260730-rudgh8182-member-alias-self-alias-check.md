# member_aliases 자기 자신 별칭 금지 CHECK를 문서에 추가

- 상태: 승인·반영 완료
- 제안자: rudgh8182
- 작성일: 2026-07-30
- 차단 변경: 아니오
- 영향 스펙·계약: `docs/specs/contracts/DATA_MODEL.md` (`member_aliases`)
- 관련 작업: 없음 (DATA_MODEL.md와 실제 스키마 대조 과정에서 발견)

## 기존 내용

`docs/specs/contracts/DATA_MODEL.md`의 `member_aliases` 절에는 PK, FK,
컬럼, Unique만 기록되어 있고 자기 자신에 대한 별칭을 금지하는 제약은
없다.

## 제안 내용

- `member_aliases` 절에 CHECK 제약을 추가한다:
  `owner_member_id <> target_member_id` — 자기 자신에게는 별칭을 붙일 수
  없다. 본인 표시 이름을 바꾸려면 별칭이 아니라 이름(프로필)을 수정한다.

## 변경 근거

- 실제 스키마에 CHECK 제약이 이미 존재한다:
  `backend/src/main/resources/db/migration/V1__create_schema.sql` 99행
  `ck_member_aliases_distinct_members CHECK (owner_member_id <> target_member_id)`.
- 사용자(rudgh8182)가 2026-07-30 세션에서 "자기 자신에게 별칭을 못
  붙이는 게 맞고, 바꾸고 싶다면 이름을 바꾸는 구조"라고 확인하고 문서
  추가를 결정했다.

## 확인된 영향

- 영향 도메인: 회원·그룹 (별칭)
- 영향 계약: `docs/specs/contracts/DATA_MODEL.md`
- 영향 화면: 없음 (동작 변경 없음, 기존 스키마 제약의 문서화)
- 검증 범위: 문서만 변경. 스키마·코드 변경 없음.

## 결정 및 반영

- 결정: 승인 (기존 스키마 제약의 문서화)
- 결정자: rudgh8182
- 결정일: 2026-07-30
- 반영 문서: `docs/specs/contracts/DATA_MODEL.md`
- 반영 커밋:
