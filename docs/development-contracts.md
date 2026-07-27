# Notion 개발 문서 기준 계약

> Notion 최신 개발 문서를 로컬에서 구현·검토할 때 사용하는 교차 문서 요약이다. 상세 원문과 데이터베이스 레코드는 각 Notion 링크를 기준으로 한다.
>
> 확인일: 2026-07-24  
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
| 설계 | [현재 API 명세서](https://app.notion.com/p/3a5e66fae19280f6ab4dfeef2f5f91fc) | 이 문서의 호출 경계 |
| 설계 | [주요 로직 설계](https://app.notion.com/p/2afe66fae1928348bd86014fc6ae8101) | 이 문서의 처리 순서 |

참고·보관 API는 [별도 페이지](https://app.notion.com/p/448e66fae19282249cb4813815821614)이며 현재 구현 기준으로 사용하지 않는다. ERD·API 원문은 Notion에서 관리하고, 로컬에는 확정된 교차 계약만 기록한다.

## 2. 서비스·권한 경계

- Android 앱은 Spring Boot에서 검증된 인증정보를 연계해 FastAPI에 AI 통화 세션 생성을 직접 요청한다.
- Spring Boot는 사용자·그룹 권한 검증, 게시글 마지막 수정 시각 관리, 리포트 DB 조회와 화면 제공을 담당한다.
- FastAPI는 AI 통화 세션, 게시글 분석, 건별·일일 리포트 생성 및 AI 결과의 DB 직접 저장을 담당한다.
- 완료 콜백과 Spring Boot의 리포트 생성 요청은 사용하지 않는다.
- 현재 그룹의 권한 범위를 벗어난 게시글·일정·리포트 데이터는 Tool과 프롬프트에 포함하지 않는다.

## 3. AI 통화 계약

### 세션 초기화

- 프론트엔드는 선택한 페르소나 번호를 전달한다.
- FastAPI는 번호를 고정 매핑해 Realtime 음성과 고정 말투 프롬프트를 적용한다.
- `personas` DB와 Spring DB의 `voice_id`는 사용하지 않는다.
- 현재 그룹의 당일 게시글 분석 결과를 통화 시작 프롬프트에 한 번 주입한다. 이는 Tool Calling이 아니다.

### 필수 Tool

| Tool | 입력·범위 | 반환 경계 |
| --- | --- | --- |
| `get_person_recent_post_summaries` | `person_query`; 현재 그룹의 최신 게시글 요약 최대 5개 | 원문·미디어 제외 |
| `get_calendar_events_by_date` | `target_date` 하나; 상대 날짜는 별도 전처리 | 해당 날짜의 모든 가족 일정, `keyword` 없음 |

주제 관련 게시글 검색과 장기 메모리 검색은 확장 기능이다. Tool 이름·검색 범위·스키마는 확정하지 않는다.

## 4. 게시글 분석 계약

- Spring Boot가 마지막 수정 후 10분 동안 변경이 없음을 확인한다.
- Spring Boot가 `post_id`를 FastAPI에 전달한다.
- FastAPI가 게시글 원문·미디어를 DB에서 직접 조회하고 같은 분석 작업에서 `summary`와 `keywords`를 생성한다.
- `summary`는 최대 500자이며 `analyzed_at`과 함께 저장한다.
- 사진·영상 포함 게시글은 Gemini 3.5 Flash, 텍스트 전용 게시글은 Gemini 2.5 Flash Lite를 우선 시험한다.
- 분석 모델·버전 정보는 별도로 저장하지 않는다.
- 분석 실패·지연의 재시도 횟수와 오류 코드는 아직 확정하지 않는다.

> 루트 `System Architecture`의 `summary`만 저장한다는 요약 문구는 최신 멀티모달 기술 결정과 백엔드 전달사항의 `summary + keywords` 계약과 충돌한다. 이 로컬 계약은 상세 기술 결정과 현재 백엔드 전달사항을 반영해 `keywords`를 포함한다.

## 5. 리포트·감정·보호자 전달 메모

### 건별 리포트

- 통화 종료 직후 FastAPI가 비동기로 최대 100자 요약을 생성해 `call_reports`에 직접 저장한다.
- 저장 필드: `summary`, `emotion_category`, `emotion_subcategory`, nullable `guardian_message`.
- 감정 대분류: `분노·슬픔·불안·상처·당황·기쁨·중립`.
- 세부분류는 텍스트로 분리 저장하고 건별 화면에는 표시하지 않는다.
- 보호자 전달사항은 통화 중 Tool이 아니라 리포트 생성 단계에서 함께 만든다.

### 일일 리포트

- FastAPI가 Asia/Seoul 22시에 당일 `call_reports`를 조회한다.
- 통화가 있는 피보호자에 대해 최대 200자 일일 리포트를 `daily_reports`에 직접 저장한다.
- 일일 화면에는 대표 대분류 이모지, 세부분류 텍스트, `guardianMessages`를 표시한다.
- 당일 통화가 없으면 생성하지 않으며 건별·일일 리포트는 재생성하지 않는다.
- 중립 세부분류, 전체 세부분류 목록, 대표 감정 집계, 전달 메모 채널과 상태 추적은 추가 결정 사항이다.

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

- 외부 REST 공통 URL은 `/api/v1`, 내부 API는 `/internal/v1`이다.
- 현재 API 명세는 FastAPI AI 결과 직접 저장과 건별·일일 리포트 생성 요청·완료 콜백 미사용을 전제로 한다.
- 현재 API에 정의된 주요 흐름은 그룹 코드 참가 요청, 역할 변경, 관리자 위임·나가기·삭제, 피드·댓글·반응, 캘린더, AI 통화 세션, 리포트 조회, 카네이션 잔디·랭킹이다.
- 구현 계약은 [`docs/specs/contracts/API.md`](./specs/contracts/API.md)와
  [`docs/specs/contracts/DATA_MODEL.md`](./specs/contracts/DATA_MODEL.md)를
  기준으로 확인한다. 계약 자체를 바꿔야 하면 `docs/spec-changes/pending/`에
  변경 제안을 기록하고 승인 후 반영한다.
- 로컬 문서에서는 아직 확정되지 않은 오류 코드, 재시도, 동시성, 정리 작업, 추가 스키마를 임의로 확정하지 않는다.

## 8. 테스트 단계 연결

Notion의 [단위 테스트](https://app.notion.com/p/ddde66fae1928241aa5501eaa7a20170), [통합 테스트](https://app.notion.com/p/cb5e66fae19283dcadb8013b48ccf71e), [회귀 테스트](https://app.notion.com/p/a87e66fae192820a8cfb81d9f0a935a8), [E2E 테스트](https://app.notion.com/p/0d1e66fae19282dcb6ff010d443a971f), [User Test](https://app.notion.com/p/383e66fae19282e29f690115c0644ceb)는 테스트 DB와 체크리스트의 원본이다. 현재 로컬 PoC 테스트는 세션 연결·오디오·VAD 재현만 검증하며 제품 리포트·권한·그룹 데이터 격리를 검증했다고 간주하지 않는다.
