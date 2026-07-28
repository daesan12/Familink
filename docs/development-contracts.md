# Notion 개발 문서 기준 계약

> Notion 최신 개발 문서를 로컬에서 구현·검토할 때 사용하는 교차 문서 요약이다. 상세 원문과 데이터베이스 레코드는 각 Notion 링크를 기준으로 한다.
>
> 확인일: 2026-07-28
> 기준 루트: [2 AI 프로젝트](https://app.notion.com/p/a07e66fae192822d8862011c73e2305e)

## 1. 문서 원본과 로컬 대응

| 단계 | Notion 원본 | 로컬 대응 |
| --- | --- | --- |
| 기획 | [프로젝트 기획서](https://app.notion.com/p/399e66fae19280eb9e7cd99616fc0f3e) | [project-plan.md](project-plan.md) |
| 기획 | [요구사항 정의서](https://app.notion.com/p/399e66fae192805aabe8f07d2c5b36b2) | [requirements.md](requirements.md) |
| 기획 | [사용자 흐름도](https://app.notion.com/p/399e66fae1928078a5dee95aa398645d) | [user-flow.md](user-flow.md) |
| 기획 | [사용자 시나리오](https://app.notion.com/p/399e66fae192807e8080e86f45b7f7ad) | [user-scenarios.md](user-scenarios.md) |
| 기획 | [기술적 의사결정](https://app.notion.com/p/b41e66fae192830cabb881a7da4b5e10) | 이 문서 |
| 설계 | [정보구조도 IA](https://app.notion.com/p/3a5e66fae192800586becdd186c52640) | 이 문서의 화면 계약 |
| 설계 | [기능 명세서](https://app.notion.com/p/399e66fae19280e4839bf2cb4698008a) | 요구사항·사용자 흐름과 교차 확인 |
| 설계 | [데이터 모델링 ERD](https://app.notion.com/p/2aee66fae192821c8c8101ef1ede4025) | 이 문서의 저장 경계 |
| 설계 | [현재 API 명세서](https://app.notion.com/p/3a9e66fae19280f59e4df42a241b0934?v=fafe66fae192830bb03a086ca40b4e7a) | 이 문서의 호출 경계 |
| 설계 | [주요 로직 설계](https://app.notion.com/p/2afe66fae1928348bd86014fc6ae8101) | 이 문서의 처리 순서 |

참고·보관 API는 [별도 페이지](https://app.notion.com/p/448e66fae19282249cb4813815821614)이며 현재 구현 기준으로 사용하지 않는다. ERD·API 원문은 Notion에서 관리하고, 로컬에는 확정된 교차 계약만 기록한다.

## 2. 서비스·권한 경계

- AI 전화 화면과 통화 엔진만 Android Kotlin 네이티브 모듈로 구현하고,
  나머지 모바일 화면과 기능은 React Native로 구현한다.
- 회원가입과 로그인은 로그인 ID·비밀번호만 사용하며 이메일
  회원가입·로그인·인증은 지원하지 않는다.
- 모든 서비스 API, 인증·인가, AI 오케스트레이션과 DB 접근은 Spring Boot
  단일 백엔드가 담당한다.
- 음성은 Kotlin 모듈과 OpenAI Realtime이 WebRTC로 직접 주고받는다.
  Spring Boot는 SDP 교환, Sideband WebSocket, Tool Calling, 발화 완료
  전사와 통화 상태를 처리한다.
- 게시글 분석과 건별·일일 리포트 생성은 Spring Boot 내부 처리이며 완료
  콜백을 사용하지 않는다.
- 현재 그룹의 권한 범위를 벗어난 게시글·일정·리포트 데이터는 Tool과 프롬프트에 포함하지 않는다.

## 3. AI 통화 계약

### 세션 초기화

- AI 전화 전용 Kotlin 모듈은 선택한 페르소나 번호를 전달한다.
- Spring Boot는 `persona_id` 1~6을 고정 매핑해 Realtime 음성과 말투
  프롬프트를 적용한다.
- `personas` 테이블과 `voice_id`는 사용하지 않는다.
- 현재 그룹의 관심사·가족 구성원 호칭·당일 게시글 분석 결과를 통화 시작
  프롬프트에 주입한다. 당일 게시글 맥락 주입은 Tool Calling이 아니다.

### 필수 Tool

| Tool | 입력·범위 | 반환 경계 |
| --- | --- | --- |
| `get_person_recent_post_summaries` | 세션 전용 `person_key`; 현재 그룹의 최신 게시글 요약 최대 5개 | 원문·미디어 제외 |
| `get_calendar_events_by_date` | 원문 날짜 표현 `date_expression`; 서버가 `Asia/Seoul` 기준 단일 날짜로 해석 | 해당 날짜의 모든 가족 일정, `keyword` 없음 |

주제 관련 게시글 검색과 장기 메모리 검색은 확장 기능이다. Tool 이름·검색 범위·스키마는 확정하지 않는다.

## 4. 게시글 분석 계약

- Spring Scheduler가 마지막 수정 후 10분 동안 변경이 없는 게시글을 찾고
  Spring Boot 내부 `PostAnalysisService`가 분석한다.
- Spring Boot가 게시글 원문·미디어를 DB에서 직접 조회해 최대 500자의
  가족 맥락용 `summary`를 생성하고 `analyzed_at`과 함께 저장한다.
- 사진·영상 포함 게시글은 Gemini 3.5 Flash, 텍스트 전용 게시글은 Gemini 2.5 Flash Lite를 우선 시험한다.
- `keywords`, 분석 모델·버전 정보는 생성·저장하지 않으며 별도 VLM이나
  영상 프레임 추출을 사용하지 않는다.
- 분석 실패·지연의 재시도 횟수와 오류 코드는 아직 확정하지 않는다.

## 5. 리포트·감정·보호자 전달 메모

### 건별 리포트

- 통화 종료 후 Spring Boot가 저장된 발화 완료 단위 전사를 바탕으로
  비동기로 최대 100자 요약을 생성해 `call_reports`에 저장한다.
- 저장 필드: `summary`, `emotion_category`, `emotion_subcategory`, nullable `guardian_message`.
- 감정 대분류: `분노·슬픔·불안·상처·당황·기쁨·중립`.
- 세부분류는 텍스트로 분리 저장하고 건별 화면에는 표시하지 않는다.
- 보호자 전달사항은 통화 중 Tool이 아니라 리포트 생성 단계에서 함께 만든다.

### 일일 리포트

- Spring Scheduler가 `Asia/Seoul` 기준 매일 22시에 처리 대상 피보호자의
  건별 리포트 전체를 조회한다.
- 통화가 있는 피보호자에 대해 최대 200자 일일 리포트와 대표 감정,
  nullable인 최대 200자 대표 보호자 메모를 `daily_reports`에 저장한다.
- 일일 화면에는 대표 감정과 단일 `guardianMessageSummary`를 “오늘의
  전달사항”으로 표시한다.
- 당일 통화가 없으면 생성하지 않으며 건별·일일 리포트는 재생성하지 않는다.
- 감정 소분류 허용 목록·표시 매핑, 22시 이후 통화의 `report_date`,
  `INCOMPLETE` 통화의 전사 충분 기준은 추가 결정 사항이다.

## 6. 그룹·일정·참여도 계약

- 초대는 그룹 코드 입력과 관리자 승인으로 통일한다. 사용자 ID 검색·직접 초대·받은 초대 목록은 제공하지 않는다.
- 관리자는 가입 승인 시 보호자·피보호자 역할을 지정하고, 가입 후에도 활성 구성원의 역할을 변경할 수 있다.
- 역할 구성원이 0명이 되어도 유예기간·`PENDING`·`READ_ONLY`·기능 제한을 적용하지 않는다.
- 관리자가 다른 구성원이 있는 그룹을 나가려면 먼저 권한을 위임한다. 관리자 단독 그룹의 나가기는 그룹 삭제 확인으로 연결한다.
- 일정 알림은 시간 지정 일정은 시작 1시간 전, 날짜만 지정한 일정은 전날 09:00에 한 번 발송한다. `LEFT` 구성원에게 미래 일정은 보내지 않는다.
- 하루 게시글 1건 이상이면 같은 그룹에 카네이션 잔디 1개를 기록한다.
- 주간 범위는 월요일 00:00 이상, 다음 월요일 00:00 미만이다. 이번 주 효자랭킹과 지난주 1위 왕관만 제공하며 레벨·프로필 테두리는 제공하지 않는다.
- 그룹명 탭은 별도 페이지가 아니라 현재 화면의 토글로 그룹을 전환한다.

## 7. API·ERD 교차 메모

- 현재 API 명세서의 Method와 Endpoint를 그대로 사용하며 `/api/v1`,
  `/internal/v1` 같은 별도 기본 경로를 임의로 붙이지 않는다.
- 게시글 분석과 건별·일일 리포트 생성은 Spring Boot 내부 처리이며
  프론트용 생성 요청·완료 콜백 API로 노출하지 않는다.
- 현재 API에 정의된 주요 흐름은 그룹 코드 참가 요청, 역할 변경, 관리자 위임·나가기·삭제, 피드·댓글·반응, 캘린더, AI 통화 세션, 리포트 조회, 카네이션 잔디·랭킹이다.
- 구현 계약은 [`docs/specs/contracts/API.md`](./specs/contracts/API.md)와
  [`docs/specs/contracts/DATA_MODEL.md`](./specs/contracts/DATA_MODEL.md)를
  기준으로 확인한다. 계약 자체를 바꿔야 하면 `docs/spec-changes/pending/`에
  변경 제안을 기록하고 승인 후 반영한다.
- 로컬 문서에서는 아직 확정되지 않은 오류 코드, 재시도, 동시성, 정리 작업, 추가 스키마를 임의로 확정하지 않는다.

## 8. 테스트 단계 연결

Notion의 [단위 테스트](https://app.notion.com/p/ddde66fae1928241aa5501eaa7a20170), [통합 테스트](https://app.notion.com/p/cb5e66fae19283dcadb8013b48ccf71e), [회귀 테스트](https://app.notion.com/p/a87e66fae192820a8cfb81d9f0a935a8), [E2E 테스트](https://app.notion.com/p/0d1e66fae19282dcb6ff010d443a971f), [User Test](https://app.notion.com/p/383e66fae19282e29f690115c0644ceb)는 테스트 DB와 체크리스트의 원본이다. 현재 저장소에는 실행 가능한 로컬 PoC 테스트가 없으므로 제품 리포트·권한·그룹 데이터 격리가 검증됐다고 간주하지 않는다.
