# 2 AI 최신 AI 계약·API·분석 규칙 동기화

- 상태: 승인됨
- 제안자: unknown
- 작성일: 2026-07-28
- 차단 변경: 예
- 영향 스펙·계약: `API-REPORTS-001`, `AI_CALL`, `CALENDAR`, `COMMON`, `DATA_MODEL`, `FEED_AND_MEDIA`, `COVERAGE`
- 관련 작업: 사용자 승인 항목 1~4

## 기존 내용

- [`docs/specs/contracts/API.md`](../../specs/contracts/API.md)는 `API-REPORTS-001` 요청 query를 `yearMonth`로 기록하고 있다.
- [`docs/specs/domains/AI_CALL.md`](../../specs/domains/AI_CALL.md), [`CALENDAR.md`](../../specs/domains/CALENDAR.md), [`COMMON.md`](../../specs/COMMON.md)는 Tool 입력을 `person_key`·`person_query`, `date_expression`·`target_date` 충돌로 남겨 두고 있다.
- [`docs/specs/domains/AI_CALL.md`](../../specs/domains/AI_CALL.md)는 고정 `persona_id` 범위와 가족 구성원 호칭 주입을 명시하지 않는다.
- [`docs/specs/domains/FEED_AND_MEDIA.md`](../../specs/domains/FEED_AND_MEDIA.md)는 게시글 AI 분석의 비생성 항목과 최신 요약 의미를 명시하지 않는다.

## 제안 내용

1. `API-REPORTS-001` 요청 query를 `year`, `month`로 통일하고 응답의 `yearMonth`는 유지한다.
2. [AI 통화 Tool Calling](https://app.notion.com/p/3a9e66fae1928056b518f3a4cef4251e) 문서를 기준으로 `get_person_recent_post_summaries` 입력은 `person_key`, `get_calendar_events_by_date` 입력은 `date_expression`으로 통일한다. 모델은 표현을 추출하고 서버 Tool 로직이 세션·권한·`Asia/Seoul` 기준으로 검증·해석한다. 날짜는 단일 날짜로 확정되지 않으면 조회하지 않는다.
3. `persona_id`는 AI 전화 전용 Kotlin 모듈의 고정 번호 `1~6`으로 검증하고 별도 `personas` 테이블·외래 키를 두지 않는다. 통화 시작 컨텍스트에 현재 그룹의 관심사·가족 구성원 호칭·당일 게시글 분석 결과를 주입한다.
4. 게시글 AI 분석은 가족 맥락용 최대 500자 `summary`만 생성·저장하며 `keywords`, 모델·버전 메타데이터, 별도 VLM·영상 프레임 추출은 생성·저장·사용하지 않는다.

## 변경 근거

- 사용자 승인: `1. 노션 기준으로 스펙 문서 업데이트`, `2. Tool Calling 문서 기준으로 스펙, 노션 통일`, `3. 노션 기준으로 스펙 문서 업데이트`, `4. 노션 기준으로 스펙 문서 업데이트`
- [API-REPORTS-001](https://app.notion.com/p/dd3e66fae1928262818e810b4010055f): 요청 query `year`, `month`, 응답 `yearMonth`
- [AI 통화 Tool Calling](https://app.notion.com/p/3a9e66fae1928056b518f3a4cef4251e): `person_key`, `date_expression`, 서버 검증·날짜 해석·모호성 처리
- [AI 통화 상세 로직](https://app.notion.com/p/3a9e66fae1928039986cf4393a377c92): 고정 페르소나 매핑과 통화 시작 컨텍스트
- [AI 게시글 분석](https://app.notion.com/p/3a9e66fae19280aaacbecafe26ea7104): 최대 500자 요약, 비생성 항목과 분석 경계

## 확인된 영향

- 영향 도메인: AI 통화, 일정, 피드·미디어·게시글 분석, 리포트 API
- 영향 계약: `API-REPORTS-001`, Tool 입력 계약, `persona_id` 애플리케이션 검증
- 영향 화면: 없음
- 검증 범위: 관련 로컬 문서 재조회, API·데이터·도메인 간 용어 검색, Notion 대상 페이지 재조회

## 확인이 필요한 질문

없음. 사용자가 Tool Calling 문서를 기준으로 통일하도록 명시적으로 승인했다.

## 결정 및 반영

- 결정: 승인 (전체 항목 1~4)
- 결정자: 사용자
- 결정일: 2026-07-28
- 반영 문서: `docs/specs/contracts/API.md`, `docs/specs/domains/AI_CALL.md`, `docs/specs/domains/CALENDAR.md`, `docs/specs/COMMON.md`, `docs/specs/contracts/DATA_MODEL.md`, `docs/specs/domains/FEED_AND_MEDIA.md`, `docs/specs/COVERAGE.md`, Notion `AI 통화 상세 로직`, Notion `FN-013`
- 반영 커밋:
