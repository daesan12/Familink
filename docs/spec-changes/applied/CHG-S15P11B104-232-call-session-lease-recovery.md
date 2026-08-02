# call_sessions stale lease 및 자동 복구

- 상태: 적용 완료
- 제안자: Jch-Lee
- 작성일: 2026-08-02
- 차단 변경: 예
- 영향 스펙·계약: `AI_CALL`, `API-CALLS-001`, `DATA_MODEL`의 `call_sessions`
- 관련 작업: `S15P11B104-232`

## 기존 내용

- `docs/specs/domains/AI_CALL.md`는 통화 상태를 `CONNECTING`, `IN_PROGRESS`, `COMPLETED`, `INCOMPLETE`, `CANCELLED`, `FAILED`로 정의하고 연결 끊김 시 `FAILED` 또는 `INCOMPLETE`로 전환하도록 한다.
- `docs/specs/contracts/DATA_MODEL.md`의 `call_sessions`에는 `persona_id`, `status`, `created_at`, `started_at`, `ended_at`만 정의되어 있으며 stale lease 또는 자동 복구 규칙은 없다.
- `API-CALLS-001`은 활성 통화가 있으면 `409 ACTIVE_CALL_EXISTS`를 반환하도록 한다.

## 제안 내용

- `call_sessions`에 nullable `lease_expires_at TIMESTAMPTZ`를 추가한다. 활성 상태 세션은 lease를 가져야 하며 종결 상태에서는 `NULL`로 만든다.
- 새 `CONNECTING` 세션은 lease를 설정하고, 살아 있는 Sideband 세션은 주기적으로 lease를 갱신한다.
- lease가 만료된 세션은 애플리케이션 시작 시와 주기 작업에서 잠금 후 다음과 같이 원자 전환한다.
  - `CONNECTING -> FAILED`
  - `IN_PROGRESS -> INCOMPLETE`
  - `ended_at`을 복구 시각으로 기록한다.
- 새 통화 생성 직전에도 해당 피보호자의 만료 세션을 복구하여 stale 세션이 `ACTIVE_CALL_EXISTS`의 근거가 되지 않게 한다.
- 기존 종료 API 경로, 중복 종료의 `202` 응답, 최초 종결 상태·시각 보존 규칙은 변경하지 않는다.
- 초기 운영값은 lease 90초, 갱신 주기 30초로 제안한다. 설정으로 조정 가능하게 한다.

## 변경 근거

- `backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/CallSessionService.java`의 `prepareCall()`은 외부 OpenAI 호출 전에 `CONNECTING` 행을 별도 트랜잭션으로 커밋하고, 활성 상태 존재 여부만으로 `ACTIVE_CALL_EXISTS`를 판정한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/call/repository/CallSessionRepository.java`의 활성 세션 조회에는 시간 조건이 없다.
- `backend/src/main/resources/db/migration/V1__create_schema.sql`의 `call_sessions`에는 heartbeat·lease 만료 시각이 없다.
- 2026-08-02 검증에서 중복 종료 관련 대상 테스트 13개는 모두 통과했지만, 프로세스 종료 후 stale 세션을 복구하는 코드나 스케줄러는 확인되지 않았다.

## 확인된 영향

- 영향 도메인: AI 통화 세션 생성·연결·종료, Sideband 세션 수명주기
- 영향 계약: `DATA_MODEL` DB 컬럼, `API-CALLS-001`의 활성 통화 판정 시점
- 영향 화면: 없음. 공개 API 요청·응답 형식은 유지한다.
- 검증 범위: Flyway 마이그레이션, JPA 엔티티·저장소, lease 갱신/복구 스케줄러, 통화 생성 직전 복구, 기존 중복 종료 회귀 테스트

## 결정 및 반영

- 결정: 전체 승인. lease 90초·갱신 30초와 인스턴스별 소유 Sideband 세션 갱신·만료 행 복구 정책을 적용한다.
- 결정자: 이종철
- 결정일: 2026-08-02
- 반영 문서: `docs/specs/domains/AI_CALL.md`, `docs/specs/contracts/API.md`, `docs/specs/contracts/DATA_MODEL.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
