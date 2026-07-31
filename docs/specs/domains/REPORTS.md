# [REPORTS] 통화·일일 리포트

> 상태: 일부 확정
> 기준: 2026-07-31, 최신 Notion 기술 결정·AI 요약 리포트 설계·API·ERD와 승인된 도메인 이벤트 알림 계약

## AI 작업 컨텍스트

- 목적: 통화 종료 후 보호자가 통화별 근황을 확인하고, 하루의 여러 통화를 한 번에 이해할 수 있는 일일 리포트를 제공한다.
- 포함 범위: 건별 리포트, 일일 리포트, 감정 대·소분류, 보호자 전달 메시지, 정기 생성과 조회.
- 제외 범위: 통화 원본·전체 전사 노출, 건별 감정의 화면 노출, 리포트 재생성, 일보호자 다중 화면.
- 핵심 경계: Spring Boot가 Gemini 호출, 리포트 생성·저장·조회와 스케줄 실행을 모두 담당하며 완료 콜백은 사용하지 않는다.

## 확정된 동작

1. 통화 종료 후 Spring Boot가 저장된 전사를 기반으로 `Gemini 3.5 Flash`를 호출해 건별 리포트를 비동기로 생성한다.
2. `COMPLETED` 통화는 건별 리포트 생성 대상이다. `INCOMPLETE` 통화는 전사가 충분할 때만 생성하며, 충분함의 기준은 미결정이다. `CANCELLED`·`FAILED` 통화에는 생성하지 않는다.
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

건별 감정 대분류 enum은 `ANGER`, `SADNESS`, `ANXIETY`, `HURT`, `EMBARRASSMENT`, `JOY`, `NEUTRAL`이다. 한국어 표시명과 이미지 매핑은 미결정이다.

## 예외

- 해당 리포트 구간에 통화가 없으면 일일 리포트를 만들지 않고 조회 화면은 빈 상태를 표시한다.
- 건별 리포트가 아직 준비되지 않았으면 [API 계약](../contracts/API.md)의 준비 전 오류를 사용한다.
- Gemini 호출이 실패하면 성공 리포트를 저장하지 않는다. 재시도·복구 정책은 미결정이다.

## 구현 규칙

- 권한: 같은 그룹의 활성 보호자만 피보호자 리포트를 조회할 수 있다.
- API:
  - `API-REPORTS-001` `GET /groups/{groupId}/care-receivers/{memberId}/reports/calendar`
  - `API-REPORTS-002` `GET /groups/{groupId}/members/{memberId}/reports/daily/{reportDate}`
  - `API-REPORTS-003` `GET /call-sessions/{callSessionId}/report`
  - 요청·응답·명시 오류의 상세는 [API 계약](../contracts/API.md)을 따른다.
- 데이터:
  - 관련 엔티티는 `call_reports`, `daily_reports`, `call_sessions`, `call_transcripts`다.
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

## 미결정 사항

- 감정 소분류의 허용 목록·중립값·한국어 표시명·이미지 매핑.
- `INCOMPLETE` 통화의 전사 충분 여부 판단 기준.
- Gemini 실패 시 재시도 횟수·백오프와 서버 재시작 후 누락 리포트 복구 정책.
- 스케줄러 실행 시점 이후 저장된 건별 리포트를 과거 `report_date`에 반영·복구하는 정책.
