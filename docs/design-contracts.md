# Notion 설계 문서 로컬 반영 요약

> 설계 단계의 원문은 Notion에서 관리하고, 이 문서는 저장소에서 필요한 화면·기능·API·데이터 경계를 최신 Notion 기준으로 확인하기 위한 요약이다. ERD와 API 원문을 로컬에서 임의로 재작성하지 않는다.

## 원본 문서

- [정보구조도(IA)](https://app.notion.com/p/3a5e66fae192800586becdd186c52640)
- [기능 명세서](https://app.notion.com/p/399e66fae19280e4839bf2cb4698008a)
- [데이터 모델링(ERD)](https://app.notion.com/p/2aee66fae192821c8c8101ef1ede4025)
- [2차 와이어프레임](https://app.notion.com/p/cc5e66fae19283ec9a7f01dc389d5dfb)
- [주요 로직 설계](https://app.notion.com/p/2afe66fae1928348bd86014fc6ae8101)
- [현재 API 명세서](https://app.notion.com/p/3a9e66fae19280f59e4df42a241b0934?v=fafe66fae192830bb03a086ca40b4e7a)
- [참고·보관 API 명세서](https://app.notion.com/p/448e66fae19282249cb4813815821614)

## 1. IA 화면 기준

현재 화면 식별자는 다음 흐름을 사용한다.

- 모바일 구현은 AI 전화 화면·통화 엔진만 Kotlin 네이티브 모듈이고,
  나머지 화면과 기능은 React Native다. 화면이 없는 푸시 등록 토큰
  확보에만 Kotlin 구성요소를 추가로 사용한다.
- 공통: `A` 메인·로그인·회원가입, `B` 그룹 생성·참가·선택
- 관심사: `C` 관심사 선택
- 피드: `D` 빈 피드·목록·상세·알림·카메라·갤러리·보관함
- 일정: `E` 월간 달력·상세·추가·알림 계산
- AI 전화: `F` 페르소나 선택·통화·종료
- 리포트: `G` 일일 리포트·건별 리포트·피보호자 전환
- 그룹 정보: `H` 랭킹·호칭·초대 코드·참가 승인·관리자·나가기·삭제
- 보호자 프로필: `I` 프로필·활동 달력·알림·이용 가이드
- 피보호자 프로필: `J` 프로필·관심사·알림·이용 가이드

각 화면의 세부 요소 ID와 담당자·완료 상태는 Notion IA 데이터베이스를 기준으로 한다. 로컬의 실행 가능한 흐름은 [user-flow.md](user-flow.md)에 정리했다.

## 2. 기능 명세 핵심 레코드

최신 기능 레코드는 다음 기능 경계를 사용한다.

| 기능 ID | 기능 | 핵심 계약 |
| --- | --- | --- |
| FN-009 | 게시글 AI 분석 및 저장 | 10분 무변경 후 Spring Boot 내부 분석, 최대 500자 `summary` 저장 |
| FN-010 | AI 통화 세션 생성 | Kotlin 모듈이 Spring Boot에 요청하고 Spring Boot가 SDP·Sideband 처리 |
| FN-011 | 건별 통화 리포트 | 종료 후 Spring Boot가 비동기 생성·저장 |
| FN-012 | 22시 일일 리포트 | Spring Scheduler가 당일 통화 1건 이상일 때만 생성·저장 |
| FN-013 | 특정 날짜 전체 일정 Tool | `date_expression`을 서버가 단일 날짜로 해석해 해당 날짜의 모든 가족 일정 반환 |

계정 기능은 로그인 ID와 비밀번호를 사용하며 이메일·소셜 인증은 제공하지
않는다.

## 3. API 경계

- 현재 API 명세서의 Method와 Endpoint를 그대로 사용하며 별도 기본 경로를
  임의로 추가하지 않는다.
- 그룹: 코드 참가 요청, 승인·거절, 역할 변경, 관리자 위임·나가기·삭제
- 피드: 그룹 피드, 게시글 상세·수정·삭제, 반응, 댓글
- 일정: 생성·조회·수정·삭제, 설정된 고정 알림
- AI 전화: `POST /call-sessions`, 세션 상태 조회, 취소
- 리포트: 피보호자별 달력·일일 리포트 조회
- 잔디: 구성원 주간 카네이션과 그룹 주간 효자랭킹 조회
- 내부 처리: 게시글 분석과 건별·일일 리포트 자동 생성은 Spring Boot
  내부 처리이며 프론트용 생성 요청·완료 콜백 API로 노출하지 않는다.

현재 API 레코드의 화면 매핑, 권한, 인증 토큰, 구현 상태는 [현재 API 명세서](https://app.notion.com/p/3a9e66fae19280f59e4df42a241b0934?v=fafe66fae192830bb03a086ca40b4e7a)의 데이터베이스를 기준으로 한다.

## 4. ERD 반영 경계

최신 백엔드 전달사항과 ERD 문서의 교차 검토 기준은 다음과 같다.

- 역할 부족에 따른 `family_groups.status`, 유예 시작·만료 시각, `PENDING`·`READ_ONLY` 상태 전환을 제거한다.
- 사용자 ID 초대에만 필요한 초대 발신자·만료 필드와 `USER_INVITE`·`PENDING_USER`·`EXPIRED` 흐름을 제거하고 그룹 코드 참가 요청으로 통일한다.
- 일반 구성원 이탈은 `LEFT`로 기록하고 과거 게시글·댓글·일정·잔디·호칭 관계를 보존한다.
- 게시글 AI 분석 결과는 최대 500자의 `summary`, 상태, `analyzed_at`을
  보관하며 `keywords`와 모델·버전 메타데이터는 저장하지 않는다.
- 건별 리포트는 `summary`, `emotion_category`, `emotion_subcategory`, nullable `guardian_message`를 사용한다.
- 일일 리포트는 대표 감정과 `daily_reports.guardian_message`를 단일
  `guardianMessageSummary`로 노출한다.
- 페르소나 번호 1~6의 음성·말투 매핑은 Spring Boot가 고정 관리하며
  `personas` 테이블과 `voice_id`는 사용하지 않는다.

API·데이터 계약 변경은 `docs/spec-changes/pending/`에서 제안하고, 명시적으로
승인된 범위만 `docs/specs/contracts/`에 반영한다.

## 5. 주요 로직·미확정 범위

- 통화 시작 전 당일 게시글 분석 결과 주입은 Tool Calling이 아니다.
- 통화 중 필수 Tool은 최근 게시글 요약 조회와 날짜별 일정 조회다.
- 보호자 전달 메모는 통화 종료 후 리포트 생성 단계에서 처리한다.
- 장기 메모리와 주제 검색은 확장 범위다.
- 감정 소분류 허용 목록·표시 매핑, 22시 이후 통화의 `report_date`,
  게시글 분석·리포트 생성 실패의 재시도, 전사 보존 기간과 랭킹 상세 화면
  방식은 미정이다.
