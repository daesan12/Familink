# Gemini AI 작업의 시간 제한·중복 방지·재시도 계약

- 상태: 적용 완료
- 제안자: unknown
- 작성일: 2026-08-02
- 차단 변경: 예
- 영향 스펙·계약: `AI_CALL`, `REPORTS`, `FEED_AND_MEDIA`, `DATA_MODEL`, `ANALYSIS_STATUS`
- 관련 작업: `S15P11B104-236`

## 기존 내용

- `docs/specs/domains/FEED_AND_MEDIA.md`는 Spring Scheduler가 안정된 게시글을 찾고(`확정된 동작` 8), 내부 서비스가 `PENDING`을 저장한 뒤 Gemini를 호출하며(9~10), 실패하면 `FAILED`를 저장한다고 정의한다(13). 게시글 분석의 재시도 횟수·백오프와 서버 재시작 후 복구 정책은 제외·미결정이다.
- `docs/specs/domains/REPORTS.md`는 통화·일일 리포트를 Spring Boot가 Gemini로 비동기 생성하고, 같은 대상의 중복 생성을 DB 제약과 멱등 처리로 막는다고 정의한다(1~8, 구현 규칙). Gemini 실패 시 성공 리포트를 저장하지 않지만 재시도·복구 및 스케줄 시점 이후 누락 복구 정책은 미결정이다(예외, 미결정 사항).
- `docs/specs/domains/AI_CALL.md`는 Spring Boot가 AI 오케스트레이션과 DB를 소유하고 통화 종료 후 Gemini 건별 리포트를 생성한다고 정의한다(`AI 작업 컨텍스트`, 확정된 동작 18). 통화 세션 lease 규칙은 확정되어 있으나 Gemini 작업의 실행 lease·재시도 계약은 정의하지 않는다.
- `docs/specs/contracts/DATA_MODEL.md`의 `post_analyses`는 `PENDING`, `SUCCESS`, `FAILED`와 요약·완료 시각만 가지며, `daily_reports`는 기준일별 단일 행 Unique만 정의한다. AI 작업 claim·시도 횟수·다음 시각·실패 원인 메타데이터는 정의하지 않는다.

## 제안 내용

### 확정 가능한 목표 동작

다음 목표를 `AI_CALL`, `REPORTS`, `FEED_AND_MEDIA` 및 공용 데이터 계약의 공통 AI 실행 경계로 추가하는 것을 제안한다. 아래는 목표 동작이며, 구체적인 수치와 상태 이름은 `확인이 필요한 질문`에서 승인받기 전까지 확정하지 않는다.

1. 모든 외부 Gemini 호출에는 설정 가능한 유한 총 제한시간을 적용한다. 제한시간이 끝나면 호출은 실패로 종결되고, 해당 작업을 잡은 실행 자원이 반환되어 다른 작업이 진행될 수 있어야 한다.
2. AI 네트워크 호출은 DB 트랜잭션을 열어 둔 채 수행하지 않는다. 대상 선정·claim·입력 스냅샷은 짧은 트랜잭션에서 저장하고, Gemini 호출 후 결과는 별도 짧은 트랜잭션에서 저장한다. 게시글 분석에 한해 같은 트랜잭션에서 retry metadata도 갱신한다.
3. AI 작업은 Spring 기본 `@Async` 실행기와 분리된 전용 bounded executor를 사용한다. 동시 실행 수와 대기열은 유한하며, 대기열이 가득 차도 외부 호출을 무기한 기다리지 않는다. 게시글 분석은 이 경우 재시도 가능한 상태로 남기고, 건별·일일 리포트는 이번 제안에서 새로운 자동 재시도 동작을 추가하지 않는다.
4. 게시글 분석은 대상 키별로 영속적인 retry metadata를 보존한다. 최소 의미는 `attempt_count`, `next_attempt_at`, 마지막 실패 분류/시각이며, 서버 재시작 뒤에도 이 정보로 재개할 수 있어야 한다. 저장 필드와 위치는 승인 질문으로 남긴다.
5. 게시글 분석 재시도는 최대 시도 횟수와 지수 backoff를 따르며, 한 스케줄 실행에서 처리하는 batch에도 상한을 둔다. 성공·영구 실패·재시도 대기 대상이 무한히 다시 선택되지 않아야 한다. 건별·일일 리포트의 자동 재시도 정책은 이번 제안의 범위에 포함하지 않는다.
6. Gemini를 호출하기 전에 대상 키에 대한 원자적 single-flight claim을 획득한다. 같은 게시글 분석 대상과 같은 `reportDate·careReceiverMemberId` 일일 리포트에는 동시에 하나의 AI 호출만 허용하며, 일일 리포트 결과는 기존 `(care_receiver_member_id, report_date)` Unique로 중복 저장을 막는다.
7. claim 소유 프로세스가 죽거나 제한시간을 넘겨도 영속 claim lease가 만료되어 다른 실행이 복구할 수 있어야 한다. 복구 시 대상 버전/멱등 키와 상태 전이를 확인한다. 일일 리포트 claim 복구는 재시도 정책이 아니라 새 실행이 다시 claim할 수 있게 만드는 단일 비행 안전장치로만 다룬다.

### 승인 전 권장 기본값(결정 아님)

초보자도 선택할 수 있도록 운영 시작점만 제시한다. 이 값들은 제안일 뿐이며 승인 전에는 구현 기준으로 사용하지 않는다.

- Gemini 총 제한시간: 30초. 너무 오래 붙잡힌 연결을 빠르게 실패시키면서 정상적인 모델 응답 시간을 허용하는 최소 운영값으로 제안한다.
- 전용 executor: 최대 동시 2개, 대기열 20개. 외부 API 호출이 DB 작업자와 전체 서버를 잠식하지 않도록 작게 시작하고 관측 후 조정한다.
- 게시글 분석 재시도: 총 3회(최초 1회 + 재시도 2회), 기본 backoff 1분, 지수 증가 후 최대 15분. 일시 장애는 흡수하되 매분 전체 재선정을 막기 위한 값이다.
- 게시글 분석 batch: 스케줄 1회당 최대 20건. 오래된 실패가 새 작업을 굶기지 않도록 한 번의 작업량을 제한한다.
- claim lease: 90초, 만료 claim 복구 점검: 1분 주기. 30초 제한시간과 저장·스케줄 오버헤드를 감안해 죽은 작업을 회수할 여유를 둔다.
- 영구 실패 보존: 게시글 분석이 최대 시도 초과 시 `FAILED`와 마지막 실패 메타데이터를 남기고 자동 재시도하지 않는다.

## 변경 근거

- Jira `S15P11B104-236`의 QA-007·QA-013·SEC-007 근거는 Gemini 호출 무제한 대기, 일일 리포트 중복 실행, 게시글 분석의 상한·backoff 없는 매분 재시도를 지적한다.
- CodeGraph 및 현재 `origin/develop` 코드 확인:
  - `backend/src/main/java/com/ssafy/s15p11b104/global/ai/gemini/GoogleGeminiClient.java:22-35`의 `HttpOptions`에는 base URL·API 버전·헤더만 있고 timeout 설정이 없다.
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisService.java:47-98`은 `@Transactional` 범위에서 gateway Gemini 호출을 수행하고, `findStablePostIds`가 성공하지 않은 모든 대상을 다시 선택한다.
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/report/service/DailyReportGenerationService.java:58-93`은 AI 호출 전에 일일 리포트 claim을 저장하지 않는다. 동시 실행은 `exists` 확인 전 Gemini를 중복 호출할 수 있다.
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/report/service/DailyReportGenerationDispatcher.java:21-32`와 `backend/src/main/java/com/ssafy/s15p11b104/domain/call/report/CallReportGenerationDispatcher.java:19-29`는 이름 없는 `@Async`를 사용하며, `BackendApplication.java:9-15`에는 전용 bounded executor가 없다.
- 공식 스펙은 해당 목표의 일부만 확정하고 게시글 분석 재시도·AI 실행 자원 수명·일일 리포트 single-flight claim은 미결정으로 남겨 두므로, 여러 AI 파이프라인이 공유하는 실행·데이터 경계에 걸친 `SHARED_CONTRACT_CHANGE`가 필요하다. 건별·일일 리포트의 자동 재시도는 이번 제안에서 결정하지 않는다.

## 확인된 영향

- 영향 도메인: `FEED_AND_MEDIA` 게시글 분석, `REPORTS` 건별·일일 리포트, `AI_CALL`의 종료 후 건별 리포트 경계
- 영향 계약: `DATA_MODEL.post_analyses`, `DATA_MODEL.daily_reports`, `ANALYSIS_STATUS`, 게시글 분석 retry metadata, 게시글·일일 리포트 claim lease 및 executor 운영 설정
- 영향 화면: 직접적인 화면 계약 변경은 확인되지 않음. 실패·준비 상태 노출을 추가할지는 별도 결정 필요
- 검증 범위: 현재 코드·스펙 정적 대조와 Jira QA 근거 확인. 실제 Gemini timeout, 다중 인스턴스 경쟁, 프로세스 강제 종료 후 복구 E2E는 실행하지 않음

## 확인이 필요한 질문

1. **제한시간**: 총 30초를 기본값으로 승인할까요? 연결·읽기·전체를 각각 둘지, SDK가 제공하는 단일 전체 timeout으로 둘지 선택이 필요합니다.
2. **게시글 분석 재시도**: 기존 `PENDING/SUCCESS/FAILED`를 유지하고 retry metadata로 대기 상태를 표현할까요(권장: enum 확장을 최소화)? 총 3회·기본 1분·최대 15분 backoff, batch 20건을 승인할까요? timeout·429·5xx만 재시도하고 입력/응답 스키마 오류는 영구 실패로 둘지도 함께 결정해야 합니다.
3. **single-flight claim**: 게시글 분석과 `careReceiverMemberId + reportDate` 일일 리포트에 claim lease 90초·1분 주기 복구를 적용할까요? 권장 방식은 새 공용 작업 테이블보다 각 기존 대상 행 또는 가장 단순한 DB claim 필드를 확장하는 것입니다. 일일 리포트 claim 만료는 자동 재시도가 아니라 새 실행이 다시 claim할 수 있게 하는 용도로만 사용합니다.
4. **bounded executor**: 전용 executor 동시 2·queue 20을 기본값으로 승인할까요? 건별·일일 리포트와 게시글 분석이 같은 제한을 공유할지, 분리할지 결정이 필요합니다. 최대 시도 후 자동 재처리 API나 관리 화면은 이번 티켓에서 명시적으로 제외합니다.

## 결정 및 반영

- 결정: 전체 승인. Gemini 총 제한시간 30초, 게시글 분석 총 3회·1분 지수 backoff·최대 15분·batch 20, timeout·429·5xx 재시도, 90초 claim lease·1분 만료 정리, 공용 AI executor 동시 2·queue 20을 적용한다. 건별·일일 리포트 자동 재시도와 자동 재처리 API·관리 화면은 제외한다.
- 결정자: 사용자
- 결정일: 2026-08-02
- 반영 문서: `docs/specs/domains/FEED_AND_MEDIA.md`, `docs/specs/domains/REPORTS.md`, `docs/specs/domains/AI_CALL.md`, `docs/specs/contracts/DATA_MODEL.md`, `docs/specs/COVERAGE.md`
- 반영 커밋: 미커밋
