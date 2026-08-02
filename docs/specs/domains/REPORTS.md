# [REPORTS] 통화·일일 리포트

> 상태: 일부 확정
> 기준: 2026-07-31, 최신 Notion 기술 결정·AI 요약 리포트 설계·API·ERD와 승인된 도메인 이벤트 알림 계약

## AI 작업 컨텍스트

- 목적: 통화 종료 후 보호자가 통화별 근황을 확인하고, 하루의 여러 통화를 한 번에 이해할 수 있는 일일 리포트를 제공한다.
- 포함 범위: 건별 리포트, 일일 리포트, 감정 대·소분류, 보호자 전달 메시지, 정기 생성과 조회.
- 제외 범위: 통화 원본·전체 전사 노출, 건별 감정의 화면 노출, 리포트 재생성, 일보호자 다중 화면.
- 핵심 경계: Spring Boot가 Gemini 호출, 리포트 생성·저장·조회와 스케줄 실행을 모두 담당하며 완료 콜백은 사용하지 않는다.

## 확정된 동작

1. 통화 종료 후 Spring Boot가 finalization된 완전한 전사를 기반으로
   `Gemini 3.5 Flash`를 호출해 건별 리포트를 비동기로 생성한다.
2. `COMPLETED`이면서 전사 무결성이 `COMPLETE`이고 finalization된 통화만
   현재 건별 리포트 생성 대상이다. `INCOMPLETE` 통화는 전사가 충분하고
   무결성이 `COMPLETE`일 때만 대상이 될 수 있으며, 충분함의 기준이 미결정인
   동안 자동 생성하지 않는다. `CANCELLED`·`FAILED` 통화에는 생성하지 않는다.
3. 건별 리포트에는 최대 100자의 요약, 감정 대분류·소분류, nullable인 최대 100자의 `guardian_message`를 저장한다.
4. 같은 통화의 건별 리포트가 이미 있으면 재생성하지 않는다.
5. Spring Scheduler는 `Asia/Seoul` 기준 매일 22시에 해당 일일 리포트 기준 구간의 건별 리포트를 조회한다.
   `report_date=D`의 집계 구간은 `[D-1 22:00, D 22:00)`이며 시작 시각은 포함하고 종료 시각은 제외한다. 정확히 `D 22:00:00`에 종료된 통화는 `D+1` 리포트에 포함한다.
6. 해당 리포트 기준 구간에 통화가 있는 피보호자별로 건별 통화 리포트
   전체를 Gemini에 한 번 전달해 최대 200자의 일일 요약, 일일 감정
   대분류·소분류, nullable인 최대 200자의 대표 보호자 메시지를 생성한다.
   대표 감정은 각 건별 리포트의 `summary`를 모아 판단한다.
7. 일일 리포트 API는 대표 보호자 메시지를 단일 `guardianMessageSummary` 필드로 제공한다. 전달할 내용이 없으면 `null`이다.
8. 대상 통화가 없으면 `daily_reports`를 생성하지 않는다. 같은 피보호자·기준일의 일일 리포트가 이미 있으면 재생성하지 않는다.
9. 보호자는 현재 그룹의 피보호자에 대해서만 날짜별 리포트와 건별 리포트를 조회한다.
10. 보호자 화면에는 건별 최대 100자 요약, 일일 최대 200자 요약, 일일 감정 대·소분류, `guardianMessageSummary`를 제공하고 전체 전사는 제공하지 않는다.
11. 건별 보호자 전달 메시지는 통화 종료 후 리포트 생성 단계에서 함께 만든다. 통화 중 Tool Calling으로 생성하지 않는다.
12. 모든 생성·수정·통화 시간과 API timestamp는 UTC 절대 시각으로 저장·교환한다. DB 시간 컬럼은 `TIMESTAMPTZ`를 사용하며, 화면 표시와 22시 비즈니스 스케줄에만 `Asia/Seoul`을 적용한다.
13. 건별 또는 일일 리포트가 새로 생성되면 해당 피보호자와 같은 그룹의
    현재 활성 보호자 전원에게 각각 `CALL_REPORT` 또는 `DAILY_REPORT`
    알림을 생성한다.
14. 리포트 탭의 상단에는 생성이 완료된 가장 최신 일간 리포트와 해당 리포트의 날짜를 표시한다.
15. 당일 일간 리포트가 아직 생성되지 않았거나 당일 통화가 없더라도 이전에 생성된 일간 리포트가 있으면 가장 최신 일간 리포트를 상단에 유지한다. 하단 건별 목록에는 당일 생성된 건만 시간순으로 표시한다.
16. 건별 리포트는 있으나 생성된 일간 리포트가 아직 하나도 없으면 일간 리포트 준비 상태를 표시한다.
17. 일간 리포트의 `guardianMessageSummary` 또는 건별 리포트의 `guardianMessage`가 `null`이면 제목·배경·여백을 포함한 전달 메시지 영역 전체를 표시하지 않는다.
18. 리포트 달력 API는 요청 월의 `reportDates[]`와 함께 해당 피보호자의 전체 일일 리포트 중 가장 최신 `report_date`인 `latestReportDate`를 반환한다. 일일 리포트가 한 건도 없으면 `latestReportDate`는 `null`이다.
19. 모든 Gemini 호출에는 설정 가능한 30초 총 제한시간을 적용한다. Gemini
    네트워크 호출은 DB 트랜잭션 밖에서 수행하며, 건별·일일 리포트와 게시글
    분석은 최대 동시 실행 2개·대기열 20개의 공용 bounded executor를 사용한다.
20. 일일 리포트는 Gemini 호출 전에 `care_receiver_member_id + report_date`
    기준 영속 claim을 획득한다. claim lease는 90초이며 만료 claim은 1분마다
    정리해 새 실행이 다시 claim할 수 있게 한다. 기존
    `(care_receiver_member_id, report_date)` Unique는 성공 결과의 중복 저장을
    계속 막는다. claim에는 입력 건별 리포트의 개수와 최대 ID를 저장하고
    완료 시 다시 확인한다. 호출 중 입력이 추가됐다면 오래된 결과를 저장하지
    않는다. claim 소유 실행만 token·기존 입력 버전을 조건으로 claim을 최신
    입력 버전과 새 lease로 원자 갱신한 뒤 다시 생성한다. 다른 실행은 활성
    claim의 입력 버전을 덮어쓰지 않는다. 이는 실패 자동 재시도가 아니라
    닫힌 리포트 구간의 입력 일관성 보정이다. 같은 키에 동시에 하나의 Gemini
    호출만 허용한다.
21. 건별 리포트는 finalization 트랜잭션에서 생성된 durable generation
    request를 사용한다. 상태는 `PENDING`, `CLAIMED`, `GEMINI_FAILED`,
    `DONE`이며 세션마다 하나만 존재한다. queue 거부는 `PENDING`을 유지하고,
    worker는 90초 single-flight claim 뒤에만 Gemini를 호출한다.
22. 1분 주기 복구 작업은 batch 20으로 `PENDING`과 만료 `CLAIMED`만 다시
    접수한다. 명시적인 Gemini 실패인 `GEMINI_FAILED`와 성공한 `DONE`은
    `PENDING`으로 되돌리지 않는다. claim owner가 결과 기록 전에 종료된 경우의
    외부 호출은 at-least-once일 수 있지만, 유효 claim token과
    `call_reports.call_session_id` Unique로 저장 결과는 한 건만 허용한다.
23. target claim과 결과 저장은 모두 세션 잠금 뒤 generation request 잠금
    순서를 사용한다. 호출 전후에 call status, 전사 무결성 `COMPLETE`,
    `transcript_finalized_at`, 미해결 전사 원장 없음과 입력
    `transcript_revision`을 재검사한다. 하나라도 달라지면 Gemini 결과를 버리고
    리포트·알림을 저장하지 않는다.
24. `call_reports` DB 쓰기 자체도 같은 무결성·finalization·미해결 원장 조건을
    강제한다. 따라서 롤링 배포 중 새 컬럼을 읽지 않는 이전 버전 인스턴스도
    부분 전사로 리포트를 저장할 수 없다.

건별 감정 대분류 enum은 `ANGER`, `SADNESS`, `ANXIETY`, `HURT`, `EMBARRASSMENT`, `JOY`, `NEUTRAL`이다. 한국어 표시명과 이미지 매핑은 미결정이다.

## 예외

- 해당 리포트 구간에 통화가 없으면 그 기준일의 일일 리포트를 만들지 않는다. 이전에 생성된 일일 리포트가 있으면 조회 화면 상단에 가장 최신 일일 리포트를 유지하고 당일 건별 목록만 빈 상태로 표시한다. 생성된 일일 리포트가 전혀 없을 때만 전체 리포트 빈 상태를 표시한다.
- 건별 리포트가 아직 준비되지 않았으면 [API 계약](../contracts/API.md)의 준비 전 오류를 사용한다.
- Gemini 호출이 실패하거나 30초 총 제한시간을 넘으면 성공 리포트를 저장하지
  않는다. 건별 요청은 `GEMINI_FAILED`로 확정하고 자동 재시도하지 않는다.
  `PENDING`·만료 `CLAIMED` 복구는 Gemini 실패 재시도가 아니라 실행 접수·
  소유권 유실 복구이며, 일일 리포트의 만료 claim 정리도 기존 single-flight
  복구만 허용한다.

## 구현 규칙

- 권한: 같은 그룹의 활성 보호자만 피보호자 리포트를 조회할 수 있다.
- API:
  - `API-REPORTS-001` `GET /groups/{groupId}/care-receivers/{memberId}/reports/calendar`
    - `reportDates[]`는 요청한 월의 일일 리포트 날짜만 담고, `latestReportDate`는 월과 관계없이 전체 최신 일일 리포트 날짜를 담는다.
  - `API-REPORTS-002` `GET /groups/{groupId}/members/{memberId}/reports/daily/{reportDate}`
  - `API-REPORTS-003` `GET /call-sessions/{callSessionId}/report`
  - 요청·응답·명시 오류의 상세는 [API 계약](../contracts/API.md)을 따른다.
- 데이터:
  - 관련 엔티티는 `call_reports`, `daily_reports`,
    `daily_report_generation_claims`, `call_report_generation_requests`,
    `call_sessions`, `call_transcript_events`, `call_transcripts`다.
  - 모든 읽기·쓰기는 Spring Boot가 소유한다.
  - 동일 통화 건별 리포트와 동일 피보호자·기준일 일일 리포트의 중복 생성을 DB 제약과 멱등 처리로 방지한다.
- 알림:
  - 리포트 저장 트랜잭션 안에서 생성 이벤트를 발행한다.
  - 현재 활성 보호자 수신자·문구·중복 방지와 커밋 후 푸시는
    [알림 스펙](./NOTIFICATIONS.md)을 따른다.
- 스케줄:
  - 실행 규칙은 `Asia/Seoul` 매일 22시다.
  - `report_date=D`는 `[D-1 22:00, D 22:00)` 구간의 기준일이며, 종료 시각 조건은 UTC `Instant`로 변환해 조회한다.
  - 서버·로그·API·DB timestamp는 UTC를 사용한다.
- AI 실행:
  - 대상·claim·입력 조회와 결과 저장은 짧은 DB 트랜잭션으로 나누고 Gemini
    호출 중에는 DB 트랜잭션을 유지하지 않는다.
  - 공용 AI executor의 대기열이 가득 차면 무기한 기다리지 않는다. 건별·일일
    리포트에는 이 티켓에서 새로운 수동 재시도 API나 관리 화면을 추가하지 않는다.

## 인수 조건

### AC-001

- Given: 통화가 `COMPLETED`이고 건별 리포트가 없다.
- When: 통화 종료 후처리가 실행된다.
- Then: Spring Boot가 최대 100자의 요약, 감정 분류, nullable 보호자 메시지를 생성해 저장한다.

### AC-002

- Given: `Asia/Seoul` 기준 `report_date=D`의 `[D-1 22:00, D 22:00)` 구간에 피보호자 건별 리포트가 하나 이상 있다.
- When: `Asia/Seoul` 22시에 Spring Scheduler가 실행된다.
- Then: 건별 요약을 전체 맥락으로 분석한 최대 200자의 일일 리포트와 nullable 대표 보호자 메시지를 한 번만 저장한다.

### AC-003

- Given: 해당 기준 구간에 통화가 없다.
- When: 일일 리포트를 조회한다.
- Then: 일일 리포트가 생성되지 않았고 화면은 빈 상태를 표시한다.

### AC-004

- Given: 일일 리포트에 대표 보호자 메시지가 있다.
- When: `API-REPORTS-002`를 조회한다.
- Then: `dailyReport.guardianMessageSummary` 단일 문자열로 반환한다.

### AC-005

- Given: 피보호자의 건별 또는 일일 리포트가 처음 저장됐다.
- When: 리포트 생성 알림 이벤트를 처리한다.
- Then: 같은 그룹의 현재 활성 보호자 전원에게 리포트 종류에 맞는 알림이
  중복 없이 생성된다.

### AC-006

- Given: 당일 일일 리포트가 아직 생성되지 않았거나 당일 통화가 없고 이전에 생성된 일일 리포트가 있다.
- When: 보호자가 리포트 탭을 조회한다.
- Then: 가장 최신 일일 리포트와 그 날짜를 상단에 표시하고 당일 건별 목록은 당일 데이터에 따라 표시한다.

### AC-007

- Given: 일일 리포트의 `guardianMessageSummary` 또는 건별 리포트의 `guardianMessage`가 `null`이다.
- When: 해당 리포트를 표시한다.
- Then: 전달 메시지 영역 전체를 표시하지 않는다.

### AC-008

- Given: 조회 기준일이 속한 달에는 일일 리포트가 없고 이전 달에 생성된 일일 리포트가 있다.
- When: 보호자가 리포트 탭을 조회한다.
- Then: `API-REPORTS-001.latestReportDate`로 전체 최신 날짜를 확인하고 해당 날짜의 일일 리포트를 상단에 표시한다.

### AC-009

- Given: 동일 피보호자·기준일의 일일 리포트 생성 요청이 동시에 실행된다.
- When: 각 실행이 Gemini 호출 전에 영속 claim을 시도한다.
- Then: 하나의 실행만 90초 lease를 획득해 Gemini를 호출하고, 성공 결과는
  기존 Unique로 한 번만 저장된다. 호출 중 입력 건별 리포트가 추가되면 오래된
  결과를 버리고 같은 claim에서 최신 입력으로 생성한 결과만 저장한다.

### AC-010

- Given: Gemini가 응답하지 않거나 공용 AI executor가 포화됐다.
- When: 건별·일일 리포트 생성을 실행한다.
- Then: 실행 중인 Gemini 호출은 30초 안에 실패하고 실행 자원을 반환한다.
  executor가 포화된 새 작업은 Gemini 호출과 DB claim 전에 즉시 거부·기록하며,
  대기열은 20개를 넘겨 무기한 증가하지 않는다.

### AC-011

- Given: 전사 원장에 `RESERVED`·`READY`·`FAILED` 항목이 있거나 전사 무결성이
  `COMPLETE`가 아닌 종료 통화다.
- When: 건별 리포트 target 선택 또는 결과 저장이 실행된다.
- Then: Gemini 호출 또는 `call_reports` 저장이 수행되지 않으며 부분 전사
  리포트와 알림이 생성되지 않는다.

### AC-012

- Given: 건별 리포트 generation request가 `PENDING`이거나 claim owner 종료로
  90초가 지난 `CLAIMED`다.
- When: 1분 주기 복구 작업이 최대 20건을 다시 접수한다.
- Then: 최신 전사 revision의 유효 claim만 결과를 저장하고, 동시·지연 실행이
  있더라도 건별 리포트와 생성 알림은 각각 한 번만 저장된다.

## 미결정 사항

- 감정 소분류의 허용 목록·중립값·한국어 표시명·이미지 매핑.
- `INCOMPLETE` 통화의 전사 충분 여부 판단 기준.
- 건별·일일 리포트의 자동 재시도 횟수·backoff와 서버 재시작 후 누락
  리포트를 다시 생성하는 정책.
- 스케줄러 실행 시점 이후 저장된 건별 리포트를 과거 `report_date`에 반영·복구하는 정책.
