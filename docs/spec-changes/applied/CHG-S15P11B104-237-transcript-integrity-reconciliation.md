# 전사 무결성 상태·재처리·리포트 차단 계약

- 상태: 제안
- 제안자: unknown
- 작성일: 2026-08-02
- 차단 변경: 예
- 영향 스펙·계약: `AI_CALL`, `REPORTS`, `DATA_MODEL`, `TRANSCRIPT_INTEGRITY_STATUS`, 전사 재처리 원장, 건별 리포트 generation request·claim
- 관련 작업: `S15P11B104-237`, 선행 병합 `S15P11B104-236` MR `!117`

## 기존 내용

- `docs/specs/domains/AI_CALL.md`의 확정된 동작 7·18은 Sideband의 완료된 발화 단위 텍스트를 `call_transcripts`에 순서대로 저장하고 리포트 생성에 사용한다고 정의한다. 저장 실패 시 세션 상태, 재처리 원천과 리포트 차단 규칙은 정의하지 않는다.
- `docs/specs/domains/REPORTS.md`의 확정된 동작 1·2와 AC-001은 `COMPLETED` 통화의 저장된 전사로 건별 리포트를 생성한다고 정의한다. 전사가 일부 누락됐는지 확인하는 무결성 조건은 없다.
- `docs/specs/contracts/DATA_MODEL.md`의 `call_sessions`에는 통화 상태와 시각·lease만 있고 전사 무결성 상태가 없다. `call_transcripts`에는 발화 순번과 `openai_item_id`가 있지만 저장 실패 항목과 재처리 상태를 보존하는 구조는 없다.
- `INCOMPLETE` 통화 상태는 연결 후 비정상 단절을 나타내는 기존 계약이다. 전사 저장 실패를 같은 상태로 표현하면 연결 상태와 데이터 무결성 상태의 뜻이 섞인다.

## 제안 내용

### 확정 가능한 목표 동작

다음 목표를 `AI_CALL`, `REPORTS`와 공용 데이터 계약에 추가하는 것을 제안한다. 구체적인 저장 원천과 재시도 수치는 `확인이 필요한 질문`에서 승인받기 전까지 확정하지 않는다.

#### 전사 무결성 상태와 종료 순서

1. 통화 연결 상태와 별도로 세션별 전사 무결성 상태를 영속 저장한다. 상태는 수집 중인 `COLLECTING`, 모든 수집 이벤트가 닫히고 전사 저장이 끝난 `COMPLETE`, 누락·이상 이벤트를 해결해야 하는 `RECONCILIATION_REQUIRED`다. 기존 `CALL_STATUS.INCOMPLETE`를 전사 저장 실패에 재사용하지 않는다.
2. 새 통화는 `COLLECTING`으로 시작하고, Sideband 수집 종료를 확인한 `transcript_finalized_at`과 0부터 단조 증가하는 `transcript_revision`을 함께 관리한다. 최초 `RESERVED` 생성, 새 `READY` payload·이상 상태 기록, `APPLIED` materialization처럼 입력 또는 저장 완결성이 실제로 바뀌는 트랜잭션은 `call_sessions`를 먼저 잠그고 같은 트랜잭션에서 revision을 1 증가시킨다. 동일 이벤트의 no-op 재수신은 증가시키지 않는다. 모든 경로의 잠금 순서는 session 행 다음 원장 행으로 고정한다.
3. 이벤트 처리와 finalization은 세션별로 직렬화한다. remote close 전에 도착한 callback을 모두 처리한 뒤에만 finalization을 시작하며, 2초 drain timeout 또는 처리 중 callback이 남으면 `COMPLETE`로 승격하지 않는다. finalization은 잠금 후 현재 revision을 확정하고, 이후 정상 이벤트를 수락하지 않는다. 애플리케이션 시작 시와 매분, `ended_at`이 90초 이상 지난 terminal call status인데도 `COLLECTING`이고 `transcript_finalized_at IS NULL`인 세션을 잠금 후 `RECONCILIATION_REQUIRED`로 바꾸는 finalization watchdog을 실행한다.
4. 세션을 `COMPLETE`로 바꾸는 조건은 `transcript_finalized_at`이 기록되고, 미완료 예약·재처리 대상·복구 불가 이상 이벤트가 없으며, 모든 원장 항목이 `call_transcripts`에 반영된 경우뿐이다. `RECONCILIATION_REQUIRED -> COMPLETE`도 같은 조건과 최종 revision을 잠금 후 다시 확인한다. `COLLECTING`을 call status만 보고 자동 승격하지 않는다.
5. 종료 경로별 무결성 전이는 다음과 같다.

   | 통화 종료 경로 | 전사 무결성 전이 |
   |---|---|
   | 살아 있는 Sideband를 정상 drain한 `COMPLETED` | 모든 조건 충족 시 `COMPLETE`, 아니면 `RECONCILIATION_REQUIRED` |
   | 살아 있는 Sideband가 감지한 `INCOMPLETE` | 같은 finalization 검사를 적용한다. 향후 충분한 전사 기준을 구현해도 `COMPLETE`인 경우만 리포트 후보가 되며, 충분함의 기준이 미결정인 현재는 자동 생성하지 않는다. |
   | 연결 전 `CANCELLED`·`FAILED` | 전사 예약·이상 이벤트가 없으면 `COMPLETE`, 있으면 `RECONCILIATION_REQUIRED`; 두 call status 모두 리포트 대상은 아니다. |
   | Sideband 소유자를 잃은 재시작·lease 만료·소켓 부재 | active session은 기존 lease 복구, 이미 terminal인 미finalized 세션은 90초 watchdog으로 `RECONCILIATION_REQUIRED`로 전이하고 리포트를 차단한다. |

#### 선기록 원장과 재처리

6. `conversation.item.added`에서 유효한 message·화자·`item_id`를 받으면 `(call_session_id, openai_item_id)` Unique와 `(call_session_id, sequence)` Unique를 가진 원장에 `RESERVED` 항목을 **먼저 별도 짧은 트랜잭션으로 커밋**한다. 순번은 세션 행을 먼저 잠근 뒤 기존 원장과 전사의 최대 순번 다음 값으로 할당해 프로세스 재시작·handler 재생성 뒤에도 재사용하지 않는다. 원장 상태는 `RESERVED`, `READY`, `APPLIED`, `FAILED`를 사용한다. 동일 item의 재전송은 기존 화자·순번과 같으면 현재 항목을 재사용하는 no-op이고, 값이 다를 때만 불일치로 fail-closed한다. 그 뒤에만 해당 예약을 수집기가 정상 수락한 것으로 본다.
7. 완료 전사 이벤트는 화자·순번·정규화된 내용과 `content_hash`로 원장 항목을 `READY`로 만드는 두 번째 짧은 트랜잭션을 먼저 커밋한다. 같은 item·동일 hash의 중복 완료는 현재 상태를 재사용하는 no-op이며, 다른 hash는 fail-closed한다. `call_transcripts` 멱등 insert와 원장 `APPLIED` 전이는 그 다음 별도 트랜잭션에서 실행한다. 따라서 `call_transcripts` insert가 rollback돼도 `READY` 원문은 남아 재처리할 수 있다. 원장 기록과 transcript insert를 같은 rollback 경계에 넣지 않는다.
8. live handler와 scheduler는 모두 같은 materialization 경로를 사용한다. 이 경로는 session 행과 `READY` 원장 행을 같은 순서로 잠근 뒤 `(call_session_id, openai_item_id)`로 `call_transcripts`에 멱등 저장하고 `APPLIED`·revision 증가를 함께 커밋한다. 다중 인스턴스 scheduler는 `FOR UPDATE SKIP LOCKED`와 항목별 짧은 트랜잭션으로 같은 원장 행을 동시에 처리하지 않는다. 총 3회 materialization이 모두 실패하면 항목을 `FAILED`로 확정하고 세션은 `RECONCILIATION_REQUIRED`로 유지한다.
9. malformed/non-object 이벤트, `item_id` 누락, 예약 없는 완료 이벤트, 화자 불일치, OpenAI transcription failed, 종료 시 남은 `RESERVED`, 원장 선기록 실패는 무시하지 않고 세션을 fail-closed한다. 가능한 진단 메타데이터는 원장에 남기되 원문이 없는 항목은 자동 복구 가능하다고 표시하지 않으며, `RECONCILIATION_REQUIRED`와 리포트 차단을 유지한다.
10. 원장 선기록까지 실패한 PostgreSQL 전체 장애나 원문이 없는 provider 실패는 PostgreSQL만으로 원문을 복원할 수 없다. 이때 현재 프로세스의 실패 latch와 기본 `COLLECTING` 상태가 `COMPLETE` 승격을 막고, 프로세스가 사라지면 active lease 복구 또는 terminal finalization watchdog이 `RECONCILIATION_REQUIRED`로 전이한다. 자동 원문 복원 보장은 원장이 `READY` payload를 커밋한 뒤의 실패부터 적용한다.

#### 리포트 gate와 경쟁 조건

11. 건별 리포트 target은 기존 call status 조건과 함께 전사 무결성 `COMPLETE`, `transcript_finalized_at` 존재, 미해결 원장 항목 없음인 세션만 선택한다. target은 `transcript_revision`을 입력 버전으로 보존한다.
12. Gemini 호출 뒤 리포트를 저장하는 짧은 트랜잭션은 `call_sessions` 행을 잠그고 call status, 무결성 상태, finalization, 원장 미해결 여부와 `transcript_revision` 일치를 모두 다시 검사한다. 하나라도 달라지면 분석 결과를 버리고 리포트·알림을 저장하지 않는다. finalization 이후 새 전사 이벤트를 정상 수락하지 않으므로 부분 리포트가 먼저 저장된 뒤 무결성이 내려가는 순서를 허용하지 않는다.
13. durable `call_report_generation_requests`는 `call_session_id`를 PK 겸 `call_sessions.id` FK로 사용해 세션당 정확히 한 행만 허용한다. 행은 `PENDING`, `CLAIMED`, `GEMINI_FAILED`, `DONE` 상태와 입력 revision, claim token·만료 시각, 마지막 실패 분류를 가진다. 무결성 `COMPLETE` 전이는 현재 리포트 대상 call status에 대해서만 같은 트랜잭션에서 `call_session_id` 충돌 키로 멱등 upsert한다. 행이 없을 때만 `PENDING`을 만들고, 기존 `PENDING`은 유지하며 `GEMINI_FAILED`·`DONE`을 `PENDING`으로 덮어쓰지 않는다. bounded executor가 queue를 거부하면 `PENDING`을 유지하고, 실제 worker가 Gemini 호출 직전 `CLAIMED` 90초 single-flight claim을 얻는다.
14. Gemini 호출 중 DB 트랜잭션을 열지 않으며 저장 시 request claim token과 revision을 재확인한다. 성공 시 리포트 한 행과 request `DONE`을 함께 저장한다. 명시적인 Gemini 예외는 `GEMINI_FAILED`와 실패 분류를 저장하고 자동 스캔에서 제외한다. claim owner가 결과 상태를 남기지 못하고 죽은 `CLAIMED`만 lease 만료 뒤 `PENDING`으로 회수한다.
15. 1분 복구 스캔은 batch 20으로 `PENDING`과 만료 `CLAIMED`만 다시 dispatch한다. 프로세스가 Gemini 응답을 받은 뒤 DB 저장 전에 죽으면 lease 만료 후 외부 호출이 한 번 더 일어날 수 있으므로 외부 호출 보장은 at-least-once이며, 유효 claim과 `call_reports.call_session_id` Unique로 동시 호출과 중복 저장을 막고 최신 유효 claim 결과 한 행만 남긴다.
16. 전사 무결성 상태와 재처리 원장·generation request는 내부 처리 계약으로만 사용하고, 이번 작업에서 공개 API·관리 화면·보호자 응답 필드를 추가하지 않는다.

#### 삭제·보존과 마이그레이션

17. 원장과 generation request는 `call_session_id -> call_sessions.id ON DELETE CASCADE`를 사용해 그룹·세션 삭제를 막지 않고 함께 삭제한다. `APPLIED` 또는 최대 시도 초과가 되면 중복 원문 내용은 즉시 `NULL`로 지우고 item·sequence·content hash·상태·실패 메타데이터만 남긴다. 안전망 cleanup은 `created_at` 기준 24시간이 지난 non-APPLIED payload를 비우며, 매시간 batch 100으로 실행한다. 공식 전사 보존 기간이 더 짧게 확정되면 그 기간을 우선한다.
18. 새 컬럼 기본값은 `COLLECTING`이다. 기존 행은 `CONNECTING`·`IN_PROGRESS -> COLLECTING`, 기존 리포트가 있는 `COMPLETED -> COMPLETE`, 리포트가 없는 `COMPLETED`와 모든 `INCOMPLETE -> RECONCILIATION_REQUIRED`, 전사 대상이 아닌 `CANCELLED`·`FAILED -> COMPLETE`로 채운다. 기존 리포트는 재분석하지 않는다. 롤링 배포 중 새 무결성 컬럼을 읽지 않는 구버전 인스턴스도 부분 리포트를 저장하지 못하도록 `call_reports` DB 쓰기에 `COMPLETE`·finalization·미해결 원장 없음 gate를 함께 강제한다.

### 승인 전 권장 기본값(결정 아님)

- 복구 원천: 새 PostgreSQL 전사 재처리 원장을 write-ahead inbox로 사용한다. 전체 Sideband JSON 대신 session·item·화자·순번·완료 전사·상태·시도 메타데이터만 저장한다.
- 트랜잭션: `RESERVED` 선커밋, `READY` payload 커밋, transcript materialization을 서로 다른 짧은 트랜잭션으로 분리한다.
- 재처리: 1분 주기, batch 20, 총 3회(실패 뒤 1분·2분 backoff), `FOR UPDATE SKIP LOCKED`를 권장한다. 최대 시도 후에는 `RECONCILIATION_REQUIRED`와 리포트 차단을 유지한다.
- 미finalized 복구: 애플리케이션 시작 시와 1분 주기로, 종료 후 90초가 지난 terminal `COLLECTING` 세션을 `RECONCILIATION_REQUIRED`로 전환한다.
- 리포트 복구: durable generation request, 90초 claim과 1분·batch 20 복구 스캔을 사용한다. queue 거부는 `PENDING`, owner 종료는 만료 `CLAIMED`, 명시적인 Gemini 실패는 `GEMINI_FAILED`로 구분해 앞의 두 상태만 다시 접수한다.
- 공개 범위: API와 화면에는 노출하지 않는다. 최대 시도 초과 항목을 수동 재개하는 관리 API도 이번 티켓에서 제외한다.
- 기존 데이터: 상태별 보수적 backfill을 적용하고 이미 생성된 리포트는 재분석하지 않는다. 원장·generation request FK는 cascade하고 반영 완료·최대 시도 초과 payload는 즉시 비우며 나머지도 24시간 안전망 cleanup을 적용한다.
- 선행 변경: MR `!117`이 공용 AI executor, 건별 리포트 dispatcher와 V8 마이그레이션을 변경하므로, 237 구현은 `!117` 병합 후 최신 `develop`에 맞추고 후속 마이그레이션 번호를 사용한다.

## 변경 근거

- Jira `S15P11B104-237`의 QA-012 근거는 발화 저장 실패를 무시해 누락된 일부 전사로 완전한 분석처럼 보이는 리포트가 생성될 수 있음을 지적한다.
- 현재 `origin/develop` 코드 확인:
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/SidebandTranscriptHandler.java:155-173`은 `saveIfAbsent`의 `RuntimeException`을 로그만 남기고 삼키며, 실패 항목을 영속 기록하거나 재시도하지 않는다.
  - `backend/src/test/java/com/ssafy/s15p11b104/domain/call/service/SidebandTranscriptHandlerTest.java:128-149`는 첫 전사 저장 실패 후 다음 전사 저장을 계속하는 동작을 성공 조건으로 고정한다.
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/CallSessionService.java:135-155`는 `IN_PROGRESS -> COMPLETED`를 확정한 뒤 Sideband 종료와 리포트 생성을 접수한다.
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/call/report/CallReportGenerationService.java:71-92`는 `COMPLETED`, 기존 리포트 없음, 비어 있지 않은 전사 한 건 이상만 확인한다. 순번 누락이나 세션 전사 무결성은 검사하지 않는다.
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/SidebandSessionManager.java:121-128,182-197`은 종료 시 최대 2초를 기다린 뒤 handler의 메모리 예약 정보를 지운다. 별도 Redis Stream·outbox·provider replay 구현은 없다.
- 집중 테스트 `SidebandTranscriptHandlerTest.continuesAfterMalformedJsonAndStorageFailure`와 `CallReportGenerationIntegrationTest`는 성공했다. 전사 저장 실패 로그가 실제로 발생해도 기존 테스트는 통과하므로, 현재 동작이 부분 전사를 허용한다는 코드 경로를 재현했다.
- 저장 예외를 삼키는 동작은 확정된 “완료 발화를 순서대로 저장” 규칙에 대한 `IMPLEMENTATION_GAP`이다. 전사 무결성 상태·재처리 원장·리포트 gate는 여러 서비스와 DB가 함께 따를 새 계약이므로 전체 분류는 `SHARED_CONTRACT_CHANGE`이며 현재 스펙에는 `SPEC_GAP`이 있다.

## 확인된 영향

- 영향 도메인: AI 통화 Sideband 전사 수집·종료, 건별 리포트 생성·알림
- 영향 계약: `DATA_MODEL.call_sessions`, `DATA_MODEL.call_transcripts`, 새 전사 재처리 원장, 전사 무결성 enum, `call_report_generation_requests`
- 영향 화면: 직접적인 화면·공개 API 변경 없음
- 검증 범위:
  - 원장 `READY` 커밋 뒤 transcript insert 실패 시 원장은 남고 리포트는 생성되지 않으며, 재처리 후 전체 순서 전사로 정확히 한 행의 리포트가 생성됨
  - malformed·예약 없는 완료·provider transcription failed·close timeout·재시작·active lease 복구·terminal finalization watchdog은 fail-closed하고 부분 리포트를 만들지 않음
  - Gemini 분석 중 revision 변경, 저장 직전 integrity 변경, claim 만료·queue 거부·다중 인스턴스 경쟁에서 stale 결과·동시 외부 호출·중복 저장을 차단하고 owner crash 뒤 순차 재호출은 at-least-once 경계로 검증함
  - 상태별 기존 행 backfill, 원장·generation request FK cascade, `APPLIED`·최대 시도·24시간 payload cleanup과 그룹 삭제 계약을 검증함
  - MR `!117` 반영 후 집중·통합·전체 백엔드 테스트와 diff 검사를 실행함

## 확인이 필요한 질문

1. **복구 원천과 보장 범위**: PostgreSQL write-ahead 원장을 `RESERVED -> READY -> APPLIED`의 독립 커밋으로 사용하고, `READY` 커밋 뒤의 실패만 자동 복구하는 권장안을 승인할까요? PostgreSQL 전체 장애나 원문 없는 provider 실패까지 자동 복원하려면 Redis Stream·클라이언트/provider 재전송 계약으로 범위를 확대해야 합니다.
2. **상태·종료 전이·리포트 gate**: `COLLECTING`, `COMPLETE`, `RECONCILIATION_REQUIRED`, `transcript_finalized_at`, 입력 revision을 call status와 분리하고, 종료 경로별 전이표·종료 후 90초 watchdog·Gemini 저장 직전 잠금과 revision 재검사를 적용하는 권장안을 승인할까요?
3. **재처리와 리포트 복구**: 전사 재처리는 1분·batch 20·총 3회·1분/2분 backoff·`SKIP LOCKED`, 건별 리포트는 durable generation request·90초 claim·1분 복구 스캔을 적용할까요? `PENDING`·owner가 사라진 `CLAIMED`만 복구하고 `GEMINI_FAILED`는 자동 재시도하지 않습니다. owner crash 창의 외부 호출은 at-least-once입니다.
4. **공개·삭제·마이그레이션 범위**: API·관리 화면·수동 재개는 제외하고, 원장·request cascade, 성공·최대 시도 payload 즉시 제거, 나머지 payload 24시간 cleanup과 상태별 보수적 backfill을 적용하는 권장안을 승인할까요?

## 결정 및 반영

- 결정: 전체 승인. PostgreSQL 영속 원장, 전사 무결성 상태·revision·finalization, bounded 재처리, durable 건별 리포트 generation request, 보수적 backfill과 payload cleanup을 모두 적용한다. 승인 후 검토에서 확인된 롤링 배포 우회와 재시작 시 순번 충돌은 각각 DB 쓰기 gate와 세션 잠금 기반 DB 순번 할당으로 보완한다.
- 결정자: 사용자
- 결정일: 2026-08-02
- 반영 문서: `docs/specs/domains/AI_CALL.md`, `docs/specs/domains/REPORTS.md`, `docs/specs/contracts/DATA_MODEL.md`, `docs/specs/COVERAGE.md`
- 반영 커밋: 미커밋
