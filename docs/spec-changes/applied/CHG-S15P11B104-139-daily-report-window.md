# S15P11B104-139 일일 리포트 report_date 집계 구간 확정

- 상태: 적용 완료
- 제안자: 이종철[대전_1반_B104]팀원
- 작성일: 2026-07-30
- 차단 변경: 예
- 분류: SHARED_CONTRACT_CHANGE
- 영향 스펙·계약: `REPORTS`, `COMMON`, `API-REPORTS-002`, `DATA_MODEL.daily_reports.report_date`, `COVERAGE`
- 관련 작업: `S15P11B104-139`

## 기존 내용

- `docs/specs/domains/REPORTS.md`는 일일 리포트 스케줄러를 Asia/Seoul 22시 기준으로 설명하지만, 22시 이후 종료된 통화를 어느 `report_date`에 포함할지는 미결정 사항으로 남아 있습니다.
- `docs/specs/COMMON.md`와 `docs/specs/contracts/API.md`에도 동일한 일일 집계 경계 미결정 사항이 남아 있습니다.
- `docs/specs/contracts/DATA_MODEL.md`는 `daily_reports.report_date`를 저장하지만, 종료 시각과 날짜의 매핑 규칙은 확정하지 않았습니다.

## 제안 내용

- Asia/Seoul 기준 `report_date=D`인 일일 리포트의 집계 구간을 `[D-1 22:00, D 22:00)`로 확정합니다.
- DB 조회는 위 구간을 UTC `Instant`로 변환하여 수행하고, `report_date`에는 Asia/Seoul 날짜 `D`를 저장합니다.
- 정확히 `D 22:00:00`에 종료된 통화는 구간의 종료 경계에서 제외하여 `D+1` 리포트에 포함합니다.
- 스케줄러 실행 시점에 `call_reports` 저장이 완료된 건만 입력으로 사용합니다. 늦게 저장된 건별 리포트의 자동 복구·재생성 정책은 이번 변경으로 확정하지 않습니다.
- 집계 대상 통화가 없으면 `daily_reports` 행을 생성하지 않으며, 동일 피보호자와 `report_date` 조합은 기존 Unique 제약을 통해 하나의 행만 허용합니다.

## 변경 근거

- `S15P11B104-139` 구현 계획에서 22시 경계를 선택했으며, 집계 구간을 확정하지 않으면 스케줄러의 대상 날짜와 DB 조회 조건을 일관되게 구현할 수 없습니다.
- 기존 `CallSession.endedAt`은 실제 종료 시각을 저장하고, 기존 `daily_reports`에는 `report_date`와 `(care_receiver_member_id, report_date)` Unique 제약이 있으므로 별도 DB 구조 변경 없이 날짜 매핑 규칙을 계약으로 확정할 수 있습니다.
- 정확한 시작 포함·종료 제외 규칙은 반복 실행과 경계 시각 중복 집계를 방지하고, UTC 저장·KST 표시/스케줄 규칙과도 일치합니다.

## 확인된 영향

- 영향 도메인: 일일 리포트 생성·저장(`REPORTS`)
- 영향 계약: 공통 시간 규칙(`COMMON`), 일일 리포트 의미(`API-REPORTS-002`), `daily_reports.report_date` 의미(`DATA_MODEL`)
- 영향 화면: 없음. 조회 API와 FE는 `S15P11B104-123` 및 별도 작업 범위입니다.
- 검증 범위: 관련 공식 스펙의 동일 규칙 반영 여부, 시작 포함·종료 제외 경계 테스트, UTC 조회 통합 테스트, 반복·동시 실행 시 중복 방지 검증

## 결정 및 반영

- 결정: 전체 승인 및 적용
- 결정자: 사용자 승인(`apply`)
- 결정일: 2026-07-30
- 반영 문서: `docs/specs/domains/REPORTS.md`, `docs/specs/COMMON.md`, `docs/specs/contracts/API.md`, `docs/specs/contracts/DATA_MODEL.md`, `docs/specs/COVERAGE.md`
- 반영 커밋: 미커밋
