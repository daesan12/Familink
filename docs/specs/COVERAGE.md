# 원본 반영 범위

> 용도: 최초 이관과 이후 스펙 변경 시 전수 누락 검증
> 기준 조회: 2026-07-28 (`2 AI` 루트 및 직접 연결된 현행 문서)

Notion 응답의 `as of`는 이 작업에서 읽은 스냅샷 시각이며 페이지의
`last_edited_time`으로 해석하지 않는다. 일반 구현은 이 문서가 아니라
[`INDEX.md`](./INDEX.md)에서 시작한다.

## 집계

| 원본 종류 | 원본 수 | 반영 수 | 제외·보류 |
|---|---:|---:|---|
| 요구사항 정의서 | 49 | 49 | 없음: 확정 32, 검토중 17은 미결정으로 유지 |
| 현재 유효한 기능 명세 | 6 | 6 | 없음 |
| IA 화면 | 70 | 70 | 없음 |
| Notion 활성 API 명세 | 59 | 59 | 없음 |
| 최신 확정 ERD 현행 테이블 | 22 | 22 | 없음 |
| 확정 기술·AI 설계 결정 | 7 | 7 | 기술 결정 3건·현행 AI 설계 4건 |

회원가입과 로그인은 로그인 ID와 비밀번호를 사용한다. 이메일·소셜 인증과
웹 반응형 레이아웃은 제품 스펙과 인수 조건에 포함하지 않는다.

2026-07-28 최종 기술 결정, 현행 AI 설계, API와 ERD를 같은 주제의 최신
구현 기준으로 사용한다. AI 오케스트레이션과 데이터 처리는 Spring Boot
단일 백엔드가 담당한다.

## 요구사항 49건

| 원본 종류 | ID·이름 | 반영 문서 | 상태 | 비고 |
|---|---|---|---|---|
| 요구사항 | REQ-001 Android 모바일 앱 지원 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영·미결정 유지 | Android 전용은 확정, 최소 버전·시험 기기는 미결정 |
| 요구사항 | REQ-002 아이디·비밀번호 회원가입 및 로그인 | [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영·확정 | Keystore 보호 세션 저장·앱 시작 복원·확정 무효화 시 기존 비로그인 진입 |
| 요구사항 | REQ-003 프로필 및 개인정보 설정 | [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영·확정 | 그룹 구성원 프로필은 `memberId`, `displayName`, `age`, `gender`만 제공 |
| 요구사항 | REQ-004 가족 그룹 생성 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영·확정 |  |
| 요구사항 | REQ-005 가족 초대·참가 요청·관리자 승인 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 가입 요청 생성은 활성 관리자, 승인·거절 결과는 신청자에게 알림 |
| 요구사항 | REQ-006 역할 및 그룹 데이터 접근 제어 | [공통](./COMMON.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영·확정 |  |
| 요구사항 | REQ-007 사용자별 그룹 소속 범위 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영·확정 | 보호자는 여러 그룹, 피보호자는 활성 한 그룹 |
| 요구사항 | REQ-008 역할 구성과 그룹 지속 이용 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영·확정 | 역할 부족에 따른 유예·비활성화 없음 |
| 요구사항 | REQ-009 역할별 화면 및 하단 내비게이션 | [UI](./UI_AND_NAVIGATION.md) | 반영·확정 |  |
| 요구사항 | REQ-010 피보호자 자유 발신 AI 전화 | [AI 통화](./domains/AI_CALL.md) | 반영·확정 |  |
| 요구사항 | REQ-011 AI 통화 제어 | [AI 통화](./domains/AI_CALL.md) | 반영·확정 |  |
| 요구사항 | REQ-012 AI 페르소나 선택 및 소개 정보 | [AI 통화](./domains/AI_CALL.md) | 반영·확정 | 표시명·소개글·말투 태그 제공, 텍스트 예시 발화·음성 미리 듣기 미제공 |
| 요구사항 | REQ-013 AI 발화 실시간 자막 | [AI 통화](./domains/AI_CALL.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 |  |
| 요구사항 | REQ-014 피보호자 관심사 입력 및 대화 반영 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [AI 통화](./domains/AI_CALL.md) | 반영·확정 | 태그 목록은 미결정 |
| 요구사항 | REQ-015 가족 게시글 기반 AI 대화 | [피드](./domains/FEED_AND_MEDIA.md), [AI 통화](./domains/AI_CALL.md) | 반영·확정 | 텍스트 모델·품질 기준·대체 모델은 미결정 유지 |
| 요구사항 | REQ-016 장기 개인화 대화 기억 | [AI 통화](./domains/AI_CALL.md) | 반영·미결정 유지 | MVP 제외, 확장 정책 미결정 |
| 요구사항 | REQ-017 통화 건별 요약 리포트 | [리포트](./domains/REPORTS.md) | 반영·확정 | 전사 무결성 finalization gate·durable generation request·선별 운영 복구 |
| 요구사항 | REQ-018 22시 일일 리포트 생성 | [리포트](./domains/REPORTS.md) | 반영·확정 | Spring Scheduler `Asia/Seoul` 22시, UTC 저장; `report_date=D`는 `[D-1 22:00, D 22:00)` 구간 |
| 요구사항 | REQ-019 피보호자별 리포트 조회 | [리포트](./domains/REPORTS.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 | 전체 최신 `latestReportDate`, 좌우 넘김, 건별 상태 조회·제한 polling, 피보호자 수만큼 위치 표시 전용 인디케이터, 구성원 필터 없음 |
| 요구사항 | REQ-020 통화 녹음 원본 미저장 및 전체 전문 미제공 | [공통](./COMMON.md), [AI 통화](./domains/AI_CALL.md), [리포트](./domains/REPORTS.md) | 반영·확정 | 전사 원장 payload도 API·로그 비노출 |
| 요구사항 | REQ-021 가족 피드 게시글 관리 | [피드](./domains/FEED_AND_MEDIA.md) | 반영·확정 |  |
| 요구사항 | REQ-022 게시글 미디어 구성 제한 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 |  |
| 요구사항 | REQ-023 게시글 반응·댓글·게시 알림 | [피드](./domains/FEED_AND_MEDIA.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 새 게시글은 작성자를 제외한 그룹 활성 구성원, 댓글·반응은 본인 행동을 제외한 게시글 작성자에게 알림; 대댓글·댓글 반응 없음 |
| 요구사항 | REQ-024 게시글 보관함 및 필터 | [피드](./domains/FEED_AND_MEDIA.md) | 반영·확정 | 서버의 활성 구성원 `memberId`·날짜·유형 AND 필터 |
| 요구사항 | REQ-025 공유 일정 등록·조회·수정·삭제 | [일정](./domains/CALENDAR.md) | 반영·확정 | 그룹 이탈 멤버십의 참여자 연결 삭제·재가입 시 미복원 |
| 요구사항 | REQ-026 공유 일정 알림 | [일정](./domains/CALENDAR.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 지정 참여자가 모두 이탈해도 그룹 전체로 확대하지 않음; 일정 변경은 변경자를 제외한 기존·변경 후 참여자, 시작 알림은 1분 주기와 최근 1시간 복구 범위 적용 |
| 요구사항 | REQ-027 공유 캘린더 범위 분리 | [일정](./domains/CALENDAR.md), [AI 통화](./domains/AI_CALL.md) | 반영·확정 | 기기 캘린더 연동 없음 |
| 요구사항 | REQ-028 보호자 활동 잔디 및 연속 기록 | [카네이션·랭킹](./domains/CARNATIONS_AND_RANKING.md) | 반영·미결정 유지 | 과거 주 UI 등 미결정 |
| 요구사항 | REQ-029 그룹별 주간 효자랭킹 및 왕관 | [카네이션·랭킹](./domains/CARNATIONS_AND_RANKING.md) | 반영·미결정 유지 | 표시 세부 미결정 |
| 요구사항 | REQ-030 가족 호칭 개인화 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영·확정 |  |
| 요구사항 | REQ-031 중요 행동 확인 및 실행 취소 | [UI](./UI_AND_NAVIGATION.md) | 반영·미결정 유지 | 대상 행동·실행 취소 시간 미결정 |
| 요구사항 | REQ-032 웹 랜딩 및 앱·웹 고객센터 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영·미결정 유지 | 제공 방식 미결정 |
| 요구사항 | REQ-033 서비스 용어 일관성 | [공통](./COMMON.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 |  |
| 요구사항 | REQ-034 가족 연결 중심 서비스 메시지 | [공통](./COMMON.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 | AI를 가족 대체로 표현하지 않음 |
| 요구사항 | REQ-035 피드 미디어 리사이징 및 품질 최적화 | [피드](./domains/FEED_AND_MEDIA.md) | 반영·미결정 유지 | 품질 기준 미결정 |
| 요구사항 | REQ-036 Android 미디어 포맷 호환 | [피드](./domains/FEED_AND_MEDIA.md) | 반영·미결정 유지 | 확장자·코덱 목록 미결정 |
| 요구사항 | REQ-037 미디어 메타데이터 처리 정책 | [공통](./COMMON.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영·미결정 유지 | 보존·제거 목록 미결정 |
| 요구사항 | REQ-038 가족 직접 연락 요청 알림 | [AI 통화](./domains/AI_CALL.md), [알림](./domains/NOTIFICATIONS.md) | 반영·미결정 유지 | 확장 기능 판단·대상 정책 미결정 |
| 요구사항 | REQ-039 첫 사용 온보딩 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영·미결정 유지 | 단계·건너뛰기 미결정 |
| 요구사항 | REQ-040 소셜 로그인 | [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영·미결정 유지 | 확장 범위, 사업자·병합 정책 미결정 |
| 요구사항 | REQ-041 게시 대상 그룹 선택 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영·미결정 유지 | 보호자 다중 그룹은 확정, 다중 그룹 게시글의 최종 작성·노출 규칙은 미결정 |
| 요구사항 | REQ-042 개인정보 및 AI 통화 동의 | [공통](./COMMON.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영·미결정 유지 | 동의 문구·필수/선택·재동의 미결정 |
| 요구사항 | REQ-043 현재 그룹 표시 및 그룹 전환 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 |  |
| 요구사항 | REQ-044 무그룹 사용자 진입 및 요청 상태 확인 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 |  |
| 요구사항 | REQ-045 AI 통화 시작 시 당일 게시글 맥락 주입 | [AI 통화](./domains/AI_CALL.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영·확정 | Tool Calling 아님; Spring Boot가 초기화 시 주입; 피보호자 본인 작성 게시글 제외 후 최신 최대 10건 |
| 요구사항 | REQ-046 특정 인물 최신 게시글 요약 조회 Tool | [AI 통화](./domains/AI_CALL.md) | 반영·확정 |  |
| 요구사항 | REQ-047 대화 주제 관련 게시글 검색 Tool | [AI 통화](./domains/AI_CALL.md) | 반영·확정 | 확장 분류만 확정, 계약은 미결정 |
| 요구사항 | REQ-048 보호자 전달 메모 통화 후처리 | [AI 통화](./domains/AI_CALL.md), [리포트](./domains/REPORTS.md) | 반영·확정 | 통화 중 Tool이 아님 |
| 요구사항 | REQ-049 회원 탈퇴와 기록 보존 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [데이터](./contracts/DATA_MODEL.md) | 반영·확정 | 일정·멤버십 이력은 보존하고 종료 멤버십의 일정 참여자 연결은 삭제 |

## 현재 유효한 기능 명세 6건

| 원본 종류 | ID·이름 | 반영 문서 | 상태 | 비고 |
|---|---|---|---|---|
| 기능 명세 | FN-009 게시글 AI 분석 및 저장 | [피드](./domains/FEED_AND_MEDIA.md), [API](./contracts/API.md), [데이터](./contracts/DATA_MODEL.md) | 반영·확정 | Spring Scheduler·내부 서비스로 수행 |
| 기능 명세 | FN-010 AI 통화 세션 생성 | [AI 통화](./domains/AI_CALL.md), [API](./contracts/API.md) | 반영·확정 | Kotlin이 Spring Boot API 호출 |
| 기능 명세 | FN-011 건별 통화 리포트 생성 및 저장 | [리포트](./domains/REPORTS.md), [API](./contracts/API.md) | 반영·상위 결정 적용 | 무결성 COMPLETE·revision 재검증·single-flight 저장 |
| 기능 명세 | FN-012 22시 일일 리포트 생성 및 저장 | [리포트](./domains/REPORTS.md), [API](./contracts/API.md) | 반영·상위 결정 적용 | Spring Scheduler `Asia/Seoul` 22시, UTC 저장 |
| 기능 명세 | FN-013 특정 날짜 전체 일정 조회 Tool | [AI 통화](./domains/AI_CALL.md), [일정](./domains/CALENDAR.md) | 반영 | Tool 입력 `date_expression`; 서버가 `Asia/Seoul` 기준 날짜 해석·조회 |
| 기능 명세 | FN-014 피드 다중 사진 가로 넘김 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |

## IA 화면 70건

화면의 색상·간격·픽셀 값은 옮기지 않았고, 진입·행동·권한·결과를 해당
도메인과 UI 계약에 반영했다.

| 원본 종류 | ID·이름 | 반영 문서 | 상태 | 비고 |
|---|---|---|---|---|
| IA | J-5 보호자 / 이용 가이드 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | J-3p 피보호자 / 관심사 선택 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 서버 조회 성공 후 직접 입력 |
| IA | J-4 피보호자 / 관심사 선택 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 조회 로딩·오류·재시도, 최종 선택 |
| IA | J-4p 피보호자 / 관심사 선택 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 저장 실패 시 편집값 유지, 저장 결과 |
| IA | J-1 피보호자 / 프로필 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 관심사 설정 진입·복귀 |
| IA | I-3 보호자 / 프로필 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영·불일치 보존 | 제목은 보호자, 본문은 피보호자 편집으로 역할 표기 충돌 |
| IA | J-2 피보호자 / 프로필 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 편집 |
| IA | I-7 피보호자 / 이용 가이드 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영·불일치 보존 | 화면 이름과 설명의 역할 표기가 어긋남 |
| IA | I-4 피보호자 / 프로필 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 생년월일 선택 |
| IA | J-3 피보호자 / 관심사 선택 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 선택 |
| IA | I-6 피보호자 / 알림설정 | [알림](./domains/NOTIFICATIONS.md), [UI](./UI_AND_NAVIGATION.md) | 반영·불일치 보존 | 제목은 피보호자이나 확정 설정은 양 역할 공통 |
| IA | I-5 보호자 / 프로필 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [카네이션·랭킹](./domains/CARNATIONS_AND_RANKING.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 월별 활동 |
| IA | H-7 구성원 내보내기 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | I-1 보호자 / 프로필 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | I-2 보호자 / 프로필 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 편집 |
| IA | H-5 피보호자&보호자 / 그룹정보 9 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 승인 대기 요청 |
| IA | H-8 그룹 나가기 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | H-6 그룹 관리자 변경 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | H-5p 피보호자&보호자 / 그룹정보 10 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 역할 선택 승인 |
| IA | H-9 피보호자&보호자 / 그룹정보 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 그룹 삭제 |
| IA | H-1 피보호자&보호자 / 그룹정보 1 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 그룹 정보 |
| IA | H-1p 피보호자&보호자 / 그룹정보 3 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 구성원·활동 팝업 |
| IA | H-2 피보호자&보호자 / 그룹정보 5 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 역할·호칭 |
| IA | G-2p 보호자 / 통화 리포트 | [리포트](./domains/REPORTS.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 | 건당 리포트 READY·GENERATING·FAILED·UNAVAILABLE 상태 |
| IA | H-4 피보호자&보호자 / 그룹정보 8 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 초대 코드 |
| IA | G-3c 보호자 / 통화 리포트 | [리포트](./domains/REPORTS.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 다른 피보호자 리포트 날짜 |
| IA | H-3p 보호자 / 주간 효자 랭킹 | [카네이션·랭킹](./domains/CARNATIONS_AND_RANKING.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | G-3 보호자 / 통화 리포트 | [리포트](./domains/REPORTS.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 피보호자 좌측 넘김 |
| IA | E-2p 피보호자&보호자 / 일정 세부사항 | [일정](./domains/CALENDAR.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 상세 |
| IA | F-2 피보호자 / AI 전화 | [AI 통화](./domains/AI_CALL.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 통화 중 |
| IA | E-3 피보호자&보호자 / 일정 추가 시 | [일정](./domains/CALENDAR.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 생성·편집 |
| IA | G-2c 보호자 / 통화 리포트 | [리포트](./domains/REPORTS.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 날짜 선택 |
| IA | F-1 피보호자 / AI 전화 | [AI 통화](./domains/AI_CALL.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 페르소나·시작 |
| IA | G-2 보호자 / 통화 리포트 | [리포트](./domains/REPORTS.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 일일 리포트 |
| IA | G-1 보호자 / 통화 리포트 | [리포트](./domains/REPORTS.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 빈 상태 |
| IA | F-3 피보호자 / AI 전화 | [AI 통화](./domains/AI_CALL.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 통화 종료 |
| IA | D-11 카메라 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | D-10 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 보관함 서버 `memberId` 필터 |
| IA | D-9 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 게시글 보관함 |
| IA | E-2 피보호자&보호자 / 일정 | [일정](./domains/CALENDAR.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 선택 날짜 목록 |
| IA | D-9c 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 보관함 날짜 필터 |
| IA | D-10c 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 보관함 `memberId`·날짜 AND 필터 |
| IA | E-1 피보호자&보호자 / 일정 | [일정](./domains/CALENDAR.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 캘린더 |
| IA | D-12 갤러리 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | D-5p-1 피보호자&보호자 / 알림 | [알림](./domains/NOTIFICATIONS.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 가입 요청 승인 역할 선택 |
| IA | D-8 피보호자&보호자 / 피드 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 그룹 전환 |
| IA | D-6 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 글 작성·현재 그룹 |
| IA | D-7p 피보호자&보호자 / 피드 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 게시 대상 그룹 |
| IA | D-2p 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 본인 글 동작 |
| IA | D-3 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 댓글 |
| IA | D-5p-2 피보호자&보호자 / 알림 | [알림](./domains/NOTIFICATIONS.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 가입 요청 거절 결과 |
| IA | D-4 피보호자&보호자 / 알림 | [알림](./domains/NOTIFICATIONS.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 앱 내부 알림 목록 |
| IA | C-1p 피보호자 / 관심사 선택 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 직접 입력 |
| IA | B-5 피보호자&보호자 / 그룹 선택 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 그룹 생성·역할 |
| IA | B-4 피보호자&보호자 / 그룹 선택 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 승인 대기 카드 |
| IA | C-1 피보호자 / 관심사 선택 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 최소 선택 개수 없음, 0~10개 |
| IA | D-1 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 다중 사진 가로 넘김 |
| IA | B-3 피보호자&보호자 / 그룹 선택 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 무그룹 선택·승인 대기 통합 |
| IA | D-0 피보호자&보호자 / 피드 | [피드](./domains/FEED_AND_MEDIA.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 빈 피드 |
| IA | B-1 피보호자&보호자 / 그룹 선택 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 대체 | B-3 통합 화면으로 대체 |
| IA | A-1 피보호자&보호자 / 메인 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 비로그인 진입; 확정 인증 무효화 시 기존 상태 재사용 |
| IA | A-5 피보호자&보호자 / 회원가입 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 성별 |
| IA | B-2p 피보호자&보호자 / 그룹 참가 | [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 초대 코드 요청 |
| IA | A-3 피보호자&보호자 / 회원가입 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 가입 입력 |
| IA | A-6 피보호자&보호자 / 회원가입 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 생년월일 |
| IA | 00 공통 기준·전체 화면 목록·검토 체크리스트 | [UI](./UI_AND_NAVIGATION.md) | 반영 | 공통 기준 |
| IA | A-4 피보호자&보호자 / 메인 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 | 로그인 후 A-10 무그룹 안내 경유 |
| IA | A-2 피보호자&보호자 / 로그인 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | J-7 피보호자 / 프로필 · 생년월일 선택 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |
| IA | J-6 피보호자 / 프로필 · 성별 선택 | [계정](./domains/ACCOUNT_AND_PROFILE.md), [UI](./UI_AND_NAVIGATION.md) | 반영 |  |

## Notion 활성 API 명세 59건

각 행의 Method·Path·권한·핵심 요청·성공 결과·명시 오류는
[`contracts/API.md`](./contracts/API.md)에 있다.

| 원본 종류 | ID·이름 | 반영 문서 | 상태 | 비고 |
|---|---|---|---|---|
| 활성 API | API-ALIASES-001 그룹원 호칭 설정 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | Spring Boot |
| 활성 API | API-AUTH-001 로그인 ID 중복 확인 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영 | Spring Boot |
| 활성 API | API-AUTH-002 회원가입 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영 | Spring Boot |
| 활성 API | API-AUTH-003 로그인 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영·확정 | Keystore 보호 버전 세션 레코드 저장·Access Token 만료 시각 계산 |
| 활성 API | API-AUTH-004 토큰 재발급 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영·확정 | 앱 복원 1회 재발급·보호 API `401` single-flight·원 요청 1회 재시도·확정/일시 실패 분리 |
| 활성 API | API-AUTH-005 로그아웃 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md), [알림](./domains/NOTIFICATIONS.md) | 반영·일부 확정 | 현재 기기 token 해제 후 인증 로그아웃; 서버 결과와 무관하게 로컬 세션 삭제 |
| 활성 API | API-CALENDAR-001 그룹 일정 목록 조회 | [API](./contracts/API.md), [일정](./domains/CALENDAR.md) | 반영 | Spring Boot |
| 활성 API | API-CALENDAR-002 일정 상세 조회 | [API](./contracts/API.md), [일정](./domains/CALENDAR.md) | 반영 | Spring Boot |
| 활성 API | API-CALENDAR-003 일정 등록 | [API](./contracts/API.md), [일정](./domains/CALENDAR.md) | 반영 | Spring Boot |
| 활성 API | API-CALENDAR-004 일정 수정 | [API](./contracts/API.md), [일정](./domains/CALENDAR.md) | 반영 | Spring Boot |
| 활성 API | API-CALENDAR-005 일정 삭제 | [API](./contracts/API.md), [일정](./domains/CALENDAR.md) | 반영 | Spring Boot |
| 활성 API | API-CALLS-001 AI 통화 세션 생성 | [API](./contracts/API.md), [AI 통화](./domains/AI_CALL.md) | 반영·확정 | 성공 문구·요청 검증·유효 lease 활성 통화·stale 복구·AI 연결 실패 매핑 |
| 활성 API | API-CALLS-002 WebRTC 연결 결과 전달 | [API](./contracts/API.md), [AI 통화](./domains/AI_CALL.md) | 반영·확정 | 성공 문구·세션 존재·상태 오류 매핑 |
| 활성 API | API-CALLS-003 통화 종료 | [API](./contracts/API.md), [AI 통화](./domains/AI_CALL.md), [리포트](./domains/REPORTS.md) | 반영·확정 | 성공 문구·중복 종료 멱등·단일 후처리 |
| 활성 API | API-CARNATION-001 그룹 잔디·주간 랭킹 조회 | [API](./contracts/API.md), [카네이션·랭킹](./domains/CARNATIONS_AND_RANKING.md) | 반영·확정 | KST 월~일, `startDate`·`endDate` 둘 다 지정 또는 생략 |
| 활성 API | API-CARNATION-002 구성원 카네이션 날짜 조회 | [API](./contracts/API.md), [카네이션·랭킹](./domains/CARNATIONS_AND_RANKING.md) | 반영 | Spring Boot |
| 활성 API | API-COMMENTS-001 댓글 목록 조회 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영·확정 | `page`·`size`, 오래된순 고정, `updatedAt`, `hasNext` |
| 활성 API | API-COMMENTS-002 댓글 등록 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | Spring Boot |
| 활성 API | API-COMMENTS-003 댓글 수정 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | Spring Boot |
| 활성 API | API-COMMENTS-004 댓글 삭제 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | Spring Boot |
| 활성 API | API-FILES-001 Presigned URL 발급 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영·확정 | 목적·개수·MIME·크기·필드·PUT 헤더·10분 만료 |
| 활성 API | API-GROUPS-001 내 그룹·가입 요청 조회 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | Spring Boot |
| 활성 API | API-GROUPS-002 그룹 생성 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | Spring Boot |
| 활성 API | API-GROUPS-003 초대 코드 가입 요청 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | Spring Boot |
| 활성 API | API-GROUPS-004 그룹 상세 조회 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | Spring Boot |
| 활성 API | API-GROUPS-005 그룹 구성원 조회 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [캘린더](./domains/CALENDAR.md) | 반영·확정 | nullable 다운로드용 서명 `profileImageUrl` 포함 |
| 활성 API | API-GROUPS-006 그룹 정보 수정 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | Spring Boot |
| 활성 API | API-GROUPS-007 초대 코드 조회 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | Spring Boot |
| 활성 API | API-GROUPS-008 가입 요청 목록 조회 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | 관리자 |
| 활성 API | API-GROUPS-009 가입 요청 처리 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영·확정 | 요청 명령 `decision=APPROVE\|REJECT`; 응답·저장 상태 `APPROVED\|REJECTED` |
| 활성 API | API-GROUPS-010 구성원 역할 변경 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | 관리자 |
| 활성 API | API-GROUPS-011 관리자 변경 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | 관리자 |
| 활성 API | API-GROUPS-012 구성원 내보내기 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | 관리자 |
| 활성 API | API-GROUPS-013 그룹 나가기 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | 본인·`DELETE` |
| 활성 API | API-GROUPS-014 그룹 삭제 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 | 관리자 |
| 활성 API | API-GROUPS-015 구성원 프로필 조회 | [API](./contracts/API.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영 | 축소 프로필 |
| 활성 API | API-INTERESTS-001 관심사 조회 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영 | 피보호자 본인·같은 그룹 보호자 |
| 활성 API | API-INTERESTS-002 관심사 일괄 수정 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영 | 0~10개·피보호자 본인 |
| 활성 API | API-NOTIFICATIONS-001 기기 토큰 등록 | [API](./contracts/API.md), [알림](./domains/NOTIFICATIONS.md), [데이터](./contracts/DATA_MODEL.md) | 반영·확정 | 원자적 재등록·재활성화·소유권 이전 |
| 활성 API | API-NOTIFICATIONS-002 미읽음 수 조회 | [API](./contracts/API.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 성공 문구 `읽지 않은 알림 개수 조회 성공` |
| 활성 API | API-NOTIFICATIONS-003 앱 내부 알림 목록 | [API](./contracts/API.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | `page`·`size`, 최신순 고정; `actor={userId,name,profileImageUrl}\|null`; 가입 요청 현재 상태 `relatedJoinRequestStatus` |
| 활성 API | API-NOTIFICATIONS-004 단일 알림 읽음 | [API](./contracts/API.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 성공 문구 `알림 읽음 처리 성공` |
| 활성 API | API-NOTIFICATIONS-005 전체 알림 읽음 | [API](./contracts/API.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 성공 문구 `전체 알림 읽음 처리 성공` |
| 활성 API | API-NOTIFICATIONS-006 푸시 설정 조회 | [API](./contracts/API.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 7개 유형; 성공 문구 `푸시 알림 설정 조회 성공` |
| 활성 API | API-NOTIFICATIONS-007 푸시 설정 저장 | [API](./contracts/API.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 7개 유형; 성공 문구 `푸시 알림 설정 저장 성공` |
| 활성 API | API-NOTIFICATIONS-008 기기 토큰 비활성화 | [API](./contracts/API.md), [알림](./domains/NOTIFICATIONS.md), [데이터](./contracts/DATA_MODEL.md) | 반영·확정 | 소프트 비활성화·본인 멱등·타인 403 |
| 활성 API | API-POSTS-001 그룹 피드 조회 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영·확정 | `page`·`size`, 최신순 고정 |
| 활성 API | API-POSTS-002 게시글 상세 조회 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | Spring Boot |
| 활성 API | API-POSTS-003 게시글 보관함 조회 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영·확정 | 활성 `memberId`·`date`·`type` AND 필터 |
| 활성 API | API-POSTS-004 게시글 등록 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | Spring Boot |
| 활성 API | API-POSTS-005 게시글 수정 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영·확정 | `thumbnailUrl` 선택, `media` 전체 교체 |
| 활성 API | API-POSTS-007 게시글 삭제 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | Spring Boot |
| 활성 API | API-REACTIONS-001 게시글 반응 변경 | [API](./contracts/API.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | Spring Boot |
| 활성 API | API-REPORTS-001 리포트 날짜 조회 | [API](./contracts/API.md), [리포트](./domains/REPORTS.md) | 반영 | 보호자; 요청 월 `reportDates[]`와 전체 최신 `latestReportDate` |
| 활성 API | API-REPORTS-002 일일·건별 리포트 조회 | [API](./contracts/API.md), [리포트](./domains/REPORTS.md) | 반영 | 단일 `guardianMessageSummary` |
| 활성 API | API-REPORTS-003 통화 건별 리포트 조회 | [API](./contracts/API.md), [리포트](./domains/REPORTS.md) | 반영 | 보호자 |
| 활성 API | API-REPORTS-004 통화 건별 리포트 상태 조회 | [API](./contracts/API.md), [리포트](./domains/REPORTS.md), [UI](./UI_AND_NAVIGATION.md) | 반영·확정 | 보호자; READY·GENERATING·FAILED·UNAVAILABLE |
| 활성 API | API-USERS-001 내 프로필 조회 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영 | Spring Boot |
| 활성 API | API-USERS-002 내 프로필 수정 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영·일부 확정 | 프로필 이미지 업로드·유지·삭제·교체 규칙 확정 |
| 활성 API | API-USERS-003 회원 탈퇴 | [API](./contracts/API.md), [계정](./domains/ACCOUNT_AND_PROFILE.md), [알림](./domains/NOTIFICATIONS.md) | 반영·일부 확정 | 모든 기기 토큰을 탈퇴 트랜잭션에서 비활성화 |

## 최신 확정 ERD 현행 테이블 24개

| 원본 종류 | ID·이름 | 반영 문서 | 상태 | 비고 |
|---|---|---|---|---|
| ERD | `users` | [데이터](./contracts/DATA_MODEL.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영 |  |
| ERD | `family_groups` | [데이터](./contracts/DATA_MODEL.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 |  |
| ERD | `group_members` | [데이터](./contracts/DATA_MODEL.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 |  |
| ERD | `group_join_requests` | [데이터](./contracts/DATA_MODEL.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 |  |
| ERD | `member_aliases` | [데이터](./contracts/DATA_MODEL.md), [그룹](./domains/GROUPS_AND_MEMBERSHIP.md) | 반영 |  |
| ERD | `member_interests` | [데이터](./contracts/DATA_MODEL.md), [계정](./domains/ACCOUNT_AND_PROFILE.md) | 반영 |  |
| ERD | `posts` | [데이터](./contracts/DATA_MODEL.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | 그룹별 독립 행 |
| ERD | `post_media` | [데이터](./contracts/DATA_MODEL.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 |  |
| ERD | `comments` | [데이터](./contracts/DATA_MODEL.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 |  |
| ERD | `post_reactions` | [데이터](./contracts/DATA_MODEL.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 |  |
| ERD | `post_analyses` | [데이터](./contracts/DATA_MODEL.md), [피드](./domains/FEED_AND_MEDIA.md) | 반영 | Spring Boot 쓰기 |
| ERD | `calendar_events` | [데이터](./contracts/DATA_MODEL.md), [일정](./domains/CALENDAR.md) | 반영 |  |
| ERD | `event_participants` | [데이터](./contracts/DATA_MODEL.md), [일정](./domains/CALENDAR.md) | 반영 |  |
| ERD | `call_sessions` | [데이터](./contracts/DATA_MODEL.md), [AI 통화](./domains/AI_CALL.md) | 반영·확정 | lease·전사 무결성·revision·finalization |
| ERD | `call_transcript_events` | [데이터](./contracts/DATA_MODEL.md), [AI 통화](./domains/AI_CALL.md) | 반영·확정 | RESERVED→READY→APPLIED/FAILED 영속 원장 |
| ERD | `call_transcripts` | [데이터](./contracts/DATA_MODEL.md), [AI 통화](./domains/AI_CALL.md) | 반영·확정 | 세션별 item·sequence Unique |
| ERD | `call_report_generation_requests` | [데이터](./contracts/DATA_MODEL.md), [리포트](./domains/REPORTS.md) | 반영·확정 | PENDING·90초 claim·실행 유실 복구·조건부 운영자 선별 복구 |
| ERD | `call_reports` | [데이터](./contracts/DATA_MODEL.md), [리포트](./domains/REPORTS.md) | 반영 | Spring Boot 쓰기 |
| ERD | `daily_reports` | [데이터](./contracts/DATA_MODEL.md), [리포트](./domains/REPORTS.md) | 반영 | Spring Boot 쓰기 |
| ERD | `daily_report_generation_claims` | [데이터](./contracts/DATA_MODEL.md), [리포트](./domains/REPORTS.md) | 반영·확정 | 일일 리포트 90초 single-flight claim |
| ERD | `carnations` | [데이터](./contracts/DATA_MODEL.md), [카네이션·랭킹](./domains/CARNATIONS_AND_RANKING.md) | 반영 |  |
| ERD | `notifications` | [데이터](./contracts/DATA_MODEL.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 앱 내부 알림; 일정 시작 Unique와 비일정 사건용 `source_event_key` 부분 Unique 적용 |
| ERD | `notification_settings` | [데이터](./contracts/DATA_MODEL.md), [알림](./domains/NOTIFICATIONS.md) | 반영 | 푸시 허용 설정 |
| ERD | `device_tokens` | [데이터](./contracts/DATA_MODEL.md), [알림](./domains/NOTIFICATIONS.md) | 반영·확정 | 전역 Unique·단일 활성 소유권·원자적 이전·소프트 비활성화 |

## 확정 기술·AI 설계 결정 7건

기술 결정 DB 8개 레코드 중 이름과 결정 본문이 있는 3건만 결정으로
집계했다. 이름·본문이 비어 있는 5건은 누락이 아니라 자리표시자이므로
구현 기준으로 만들지 않았다. 여기에 직접 연결된 현행 AI 설계 결정 4건을
각각 매핑했다.

| 원본 종류 | ID·이름 | 반영 문서 | 상태 | 비고 |
|---|---|---|---|---|
| 기술 결정 | 기술 스택 / 아키텍처 명확히 결정 | [공통](./COMMON.md), [API](./contracts/API.md), [데이터](./contracts/DATA_MODEL.md) | 반영 | AI 통화 화면과 푸시 등록 토큰만 Kotlin, 나머지 React Native, Spring Boot·PostgreSQL |
| 기술 결정 | AI 전화 Tool Calling 및 통화 전후 처리 | [AI 통화](./domains/AI_CALL.md), [리포트](./domains/REPORTS.md) | 반영 | Spring 단일 백엔드·Tool과 비-Tool 주입 분리 |
| 기술 결정 | 게시물 멀티모달 분석 방식 — A안 확정 | [피드](./domains/FEED_AND_MEDIA.md), [데이터](./contracts/DATA_MODEL.md) | 반영·확정 | 이미지·영상 `gemini-3.5-flash`; 텍스트 `gemini-2.5-flash-lite`; 저장소 MIME 사용 |
| AI 설계 | AI 요약 리포트 생성 | [리포트](./domains/REPORTS.md), [데이터](./contracts/DATA_MODEL.md) | 반영 | 건당·일일 리포트 모두 `Gemini 3.5 Flash` |
| AI 설계 | AI 통화 tool calling | [AI 통화](./domains/AI_CALL.md), [일정](./domains/CALENDAR.md) | 반영 | 현행 Tool 2개와 가족 `personKey`·이름·별칭 비-Tool 주입 |
| AI 설계 | AI 통화 상세 로직 | [AI 통화](./domains/AI_CALL.md), [리포트](./domains/REPORTS.md) | 반영 | 세션 상태·전사·후처리·최근 통화 요약 최대 5건 |
| AI 설계 | AI 게시글 분석 로직 | [피드](./domains/FEED_AND_MEDIA.md), [데이터](./contracts/DATA_MODEL.md) | 반영 | 10분 안정화·상태 저장 |

## 확인된 출처 충돌·미결정

이 항목의 내용은 “반영 대기 규칙”이 아니라 구현자가 임의로 결정해서는 안
되는 경계다. 상세 맥락은 연결된 도메인의 `미결정 사항`에 있다.

- 텍스트 게시글용 `Gemini 2.5 Flash Lite`의 최종 채택 여부·정확한 버전, 품질 통과 기준,
  대체 모델
- 게시글 분석 실패의 재시도 횟수·백오프·서버 복구·추가 오류 정책
- IA의 일부 역할명과 화면 설명 불일치
- 그룹 API의 `managerMemberId`와 ERD의
  `group_members.is_manager` 사이 응답 구성 규칙
- 게시글 영상 최대 재생 시간·허용 코덱, FFprobe 검증과 게시글 저장 전
  스토리지 메타데이터 재검증 정책
- 프로필 수정의 이미지 외 필드 `null`·빈 요청 처리와 변경 전 로그인 ID
  재사용 정책
- `API-NOTIFICATIONS-002~007`을 제외한 아직 별도 결정되지 않은 API별
  성공 `message` 문구
- 통화 고유 오류 코드의 정확한 `message` 문구
- FCM token 해제 실패 시 `API-AUTH-005` 호출 지속 여부·재시도와 비인증
  상태의 OS 알림 권한 철회 처리
- 통화 전사 보존 기간과 개인정보·AI 통화 동의의 문구·재동의 정책
