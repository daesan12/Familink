# 건별 통화 리포트 선별 복구

이 절차는 원인 수정 배포 후에도 리포트가 없는 과거 `COMPLETED` 통화 중, 운영자가 승인한 단일 세션만 복구한다. 일괄 backfill이나 통화 상태 변경은 지원하지 않는다.

## 실행 전 조건

1. 운영 `GMS_API_KEY`와 Gemini 호출 경로가 정상인지 수동 E2E와 로그로 확인한다.
2. 복구할 `call_session_id`를 명시적으로 승인받는다.
3. 먼저 읽기 전용 진단을 실행하고 `repair_eligible`이 `true`인지 확인한다.

```text
psql <production-postgres-url> -v call_session_id=123 -f infrastructure/production/report-recovery/diagnose-call-report.sql
```

진단 결과에는 세션 상태, 전사 무결성·finalization·revision, 전체 전사 수와 공백이 아닌 전사 수, 미적용 이벤트 수, 생성 요청 상태, 기존 리포트 존재 여부가 함께 표시된다. 전사 본문은 출력하지 않는다.

## 단일 세션 복구

GMS 검증과 세션 승인이 모두 끝난 뒤에만 아래 스크립트를 실행한다.

```text
psql <production-postgres-url> -v call_session_id=123 -f infrastructure/production/report-recovery/requeue-call-report.sql
```

스크립트는 한 트랜잭션에서 조건을 다시 확인한다. 이때 리포트 생성기의 `StringUtils.hasText` 판정과 동일하게 탭·개행·유니코드 공백만 있는 전사를 제외하고, 실제 입력으로 사용할 수 있는 전사가 한 건 이상이어야 한다. 조건이 하나라도 맞지 않으면 rollback하고 실패한다. 요청이 없으면 현재 transcript revision으로 `PENDING`을 만들고, 기존 요청이 `GEMINI_FAILED`인 경우에만 해당 요청의 claim·실패 정보를 지우고 `PENDING`으로 되돌린다.

복구 후에는 공개 상태 API가 `GENERATING`에서 `READY`로 바뀌는지, `call_reports`가 정확히 한 건인지, 이후 일일 리포트 집계 입력에 포함되는지 확인한다.
