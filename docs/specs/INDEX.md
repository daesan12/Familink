# 스펙 색인

현재 작업에 필요한 도메인 스펙과 계약만 찾기 위한 가벼운 라우터입니다.
요구사항, IA, API, ERD의 전체 매핑은 [`COVERAGE.md`](./COVERAGE.md)에서
관리합니다.

| 작업 영역 | 도메인 스펙 | 추가 계약 | 관련 코드 영역 |
|---|---|---|---|
| 로그인·회원가입·온보딩·프로필·관심사·탈퇴 | [`ACCOUNT_AND_PROFILE`](./domains/ACCOUNT_AND_PROFILE.md) | [`COMMON`](./COMMON.md), [`API`](./contracts/API.md), [`DATA_MODEL`](./contracts/DATA_MODEL.md), [`UI`](./UI_AND_NAVIGATION.md) | React Native, Spring Boot 제품 모듈 |
| 그룹 생성·가입·승인·전환·관리자·호칭·이탈 | [`GROUPS_AND_MEMBERSHIP`](./domains/GROUPS_AND_MEMBERSHIP.md) | [`COMMON`](./COMMON.md), [`API`](./contracts/API.md), [`DATA_MODEL`](./contracts/DATA_MODEL.md), [`UI`](./UI_AND_NAVIGATION.md) | React Native, Spring Boot 제품 모듈 |
| 피드·미디어·댓글·반응·보관함·게시글 분석 | [`FEED_AND_MEDIA`](./domains/FEED_AND_MEDIA.md) | [`COMMON`](./COMMON.md), [`API`](./contracts/API.md), [`DATA_MODEL`](./contracts/DATA_MODEL.md), [`UI`](./UI_AND_NAVIGATION.md) | React Native, Spring Boot, FastAPI 제품 모듈 |
| 페르소나·AI 통화·WebRTC·자막·Tool Calling | [`AI_CALL`](./domains/AI_CALL.md) | [`COMMON`](./COMMON.md), [`API`](./contracts/API.md), [`DATA_MODEL`](./contracts/DATA_MODEL.md), [`UI`](./UI_AND_NAVIGATION.md) | React Native·Kotlin 브리지, FastAPI, `realtime-voice-poc/` |
| 건당·일일 리포트·감정·보호자 메시지 | [`REPORTS`](./domains/REPORTS.md) | [`COMMON`](./COMMON.md), [`API`](./contracts/API.md), [`DATA_MODEL`](./contracts/DATA_MODEL.md), [`UI`](./UI_AND_NAVIGATION.md) | React Native, Spring Boot, FastAPI 제품 모듈 |
| 일정 CRUD·참여자·알림·AI 일정 조회 | [`CALENDAR`](./domains/CALENDAR.md) | [`COMMON`](./COMMON.md), [`API`](./contracts/API.md), [`DATA_MODEL`](./contracts/DATA_MODEL.md), [`UI`](./UI_AND_NAVIGATION.md) | React Native, Spring Boot 제품 모듈 |
| 앱 알림·푸시 설정·기기 토큰 | [`NOTIFICATIONS`](./domains/NOTIFICATIONS.md) | [`COMMON`](./COMMON.md), [`API`](./contracts/API.md), [`DATA_MODEL`](./contracts/DATA_MODEL.md), [`UI`](./UI_AND_NAVIGATION.md) | React Native·Android, Spring Boot 제품 모듈 |
| 카네이션 적립·주간 랭킹·왕관 | [`CARNATIONS_AND_RANKING`](./domains/CARNATIONS_AND_RANKING.md) | [`COMMON`](./COMMON.md), [`API`](./contracts/API.md), [`DATA_MODEL`](./contracts/DATA_MODEL.md), [`UI`](./UI_AND_NAVIGATION.md) | React Native, Spring Boot 제품 모듈 |
