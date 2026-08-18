# Familink API 명세서

> 기준: Spring Boot 제품 컨트롤러 · 공식 로컬 API 계약 · 2026-08-18 포트폴리오 정리본

Familink 모바일 앱과 Spring Boot 백엔드가 사용하는 HTTP API 63개를 도메인별로 정리했습니다. 개발용 화면과 내부 스케줄러 호출은 제외했습니다.

## 목차

- [공통 규약](#공통-규약)
- [인증·회원](#인증회원)
- [그룹·구성원](#그룹구성원)
- [파일·피드](#파일피드)
- [일정](#일정)
- [AI 통화](#ai-통화)
- [리포트·카네이션](#리포트카네이션)
- [알림·기기 토큰](#알림기기-토큰)

## 공통 규약

### 인증

- 공개 API를 제외한 요청은 `Authorization: Bearer <accessToken>` 헤더를 사용합니다.
- Access Token 재발급은 요청 본문의 Refresh Token을 사용합니다.
- 로그아웃은 유효한 Access Token과 요청 본문의 Refresh Token이 모두 필요합니다.

### 성공 응답

```json
{
  "success": true,
  "message": "요청 성공",
  "data": {}
}
```

`204 No Content`는 응답 본문을 반환하지 않습니다.

### 실패 응답

```json
{
  "success": false,
  "code": "INVALID_REQUEST",
  "message": "요청 형식 또는 검증 실패",
  "errors": [
    {
      "field": "fieldName",
      "message": "검증 오류 내용"
    }
  ]
}
```

| HTTP 상태 | 의미 |
|---:|---|
| `400` | 요청 형식·필드 검증 실패 |
| `401` | 인증 정보 누락·만료·서명 실패 |
| `403` | 인증됐지만 해당 리소스 권한 없음 |
| `404` | 리소스를 찾을 수 없거나 아직 생성되지 않음 |
| `409` | 중복·현재 상태와 충돌 |
| `429` | 로그인 요청 제한 |
| `502` | 외부 AI 연결 실패 |
| `503` | 비동기 생성 작업을 접수할 수 없음 |

### 목록·시간 규칙

- 목록 API는 `page` 기본값 `0`, `size` 기본값 `20`, 허용 범위 `1~100`을 사용합니다.
- 목록 응답은 `content[]`와 `hasNext`를 포함하며 정렬은 서버에서 고정합니다.
- API timestamp는 ISO-8601 UTC 절대 시각으로 교환합니다.
- 날짜·랭킹·알림 스케줄의 비즈니스 경계는 `Asia/Seoul`을 사용합니다.

## 인증·회원

| ID | Method · Path | 권한 | 요청 | 성공 응답 | 주요 오류 |
|---|---|---|---|---|---|
| `AUTH-001` | `GET /auth/login-id/check` | 공개 | query `loginId` | `200 available` | `INVALID_REQUEST` |
| `AUTH-002` | `POST /auth/signup` | 공개 | `loginId`, `password`, `name`, `birthDate`, `gender` | `201 userId`, `loginId`, `name`, `createdAt` | `LOGIN_ID_DUPLICATED` |
| `AUTH-003` | `POST /auth/login` | 공개 | `loginId`, `password` | `200 tokenType`, `accessToken`, `refreshToken`, `user` | `INVALID_CREDENTIALS`, `ACTIVE_SESSION_EXISTS`, `LOGIN_RATE_LIMITED` |
| `AUTH-004` | `POST /auth/reissue` | Refresh Token | `refreshToken` | `200 accessToken`, `refreshToken` | `INVALID_REFRESH_TOKEN` |
| `AUTH-005` | `POST /auth/logout` | 토큰 소유자 | `refreshToken` | `204` | `UNAUTHORIZED`, `FORBIDDEN` |
| `USERS-001` | `GET /users/me` | 본인 | 없음 | `200 loginId`, `name`, `birthDate`, `gender`, `profileImageUrl` | `UNAUTHORIZED`, `FORBIDDEN` |
| `USERS-002` | `PATCH /users/me` | 본인 | `name`, `loginId`, `birthDate`, `gender`, `profileImageUrl` | `200 id`, `name`, `updatedAt` | `LOGIN_ID_DUPLICATED` |
| `USERS-003` | `DELETE /users/me` | 본인 | 없음 | `204` | `MANAGER_TRANSFER_REQUIRED` |

로그인 ID는 5~15자의 ASCII 영문 대·소문자와 숫자만 허용하며 대소문자를 구분합니다. 비밀번호는 8~16자의 ASCII 영문·숫자 조합이어야 합니다.

## 그룹·구성원

| ID | Method · Path | 권한 | 요청 | 성공 응답 | 주요 오류 |
|---|---|---|---|---|---|
| `GROUPS-001` | `GET /groups` | 인증 사용자 | 없음 | `200 groups[]`, `joinRequests[]` | 공통 오류 |
| `GROUPS-002` | `POST /groups` | 인증 사용자 | `name`, `myRole` | `201 groupId`, `managerMemberId`, `inviteCode`, `createdAt` | 공통 오류 |
| `GROUPS-003` | `POST /join-requests/by-code` | 인증 사용자 | `inviteCode` | `201 joinRequestId`, `groupId`, `groupName`, `status` | `INVITE_CODE_INVALID`, `ALREADY_GROUP_MEMBER`, `JOIN_REQUEST_ALREADY_EXISTS` |
| `GROUPS-004` | `GET /groups/{groupId}` | 활성 구성원 | path `groupId` | `200 id`, `name`, `managerMemberId`, 구성원 수 | 공통 오류 |
| `GROUPS-005` | `GET /groups/{groupId}/members` | 활성 구성원 | query `role?` | `200 members[]` | 공통 오류 |
| `GROUPS-006` | `PATCH /groups/{groupId}` | 그룹 관리자 | `name` | `200 id`, `name`, `updatedAt` | 공통 오류 |
| `GROUPS-007` | `GET /groups/{groupId}/invite-code` | 활성 구성원 | path `groupId` | `200 inviteCode` | 공통 오류 |
| `GROUPS-008` | `GET /groups/{groupId}/join-requests` | 그룹 관리자 | query `status` | `200 joinRequests[]` | `NOT_GROUP_MANAGER` |
| `GROUPS-009` | `PATCH /groups/{groupId}/join-requests/{joinRequestId}` | 그룹 관리자 | `decision`, 승인 시 `assignedRole` | `200 joinRequestId`, `status`, `memberId`, `assignedRole` | `INVALID_JOIN_REQUEST_DECISION`, `ASSIGNED_ROLE_REQUIRED`, `JOIN_REQUEST_ALREADY_PROCESSED` |
| `GROUPS-010` | `PATCH /groups/{groupId}/members/{memberId}/role` | 그룹 관리자 | `role` | `200 groupId`, `memberId`, `role` | `GROUP_MEMBER_NOT_FOUND`, `GROUP_MEMBER_ALREADY_LEFT` |
| `GROUPS-011` | `PATCH /groups/{groupId}/manager` | 그룹 관리자 | `newManagerMemberId` | `200 groupId`, `managerMemberId` | `GROUP_MEMBER_NOT_FOUND`, `GROUP_MEMBER_ALREADY_LEFT` |
| `GROUPS-012` | `DELETE /groups/{groupId}/members/{memberId}` | 그룹 관리자 | path `memberId` | `204` | `CANNOT_REMOVE_SELF`, `GROUP_MEMBER_ALREADY_LEFT` |
| `GROUPS-013` | `DELETE /groups/{groupId}/leave` | 활성 구성원 본인 | 없음 | `204` | `MANAGER_TRANSFER_REQUIRED` |
| `GROUPS-014` | `DELETE /groups/{groupId}` | 그룹 관리자 | `confirmationName` | `204` | `GROUP_HAS_ACTIVE_MEMBERS`, `GROUP_NAME_MISMATCH` |
| `GROUPS-015` | `GET /groups/{groupId}/members/{memberId}` | 활성 구성원 | path `memberId` | `200 memberId`, `displayName`, `age`, `gender` | `NOT_GROUP_MEMBER`, `GROUP_MEMBER_NOT_FOUND` |
| `ALIASES-001` | `PUT /groups/{groupId}/members/{targetMemberId}/alias` | 활성 구성원 본인 | `alias` | `200 targetMemberId`, `alias` | 공통 오류 |
| `INTERESTS-001` | `GET /groups/{groupId}/members/{memberId}/interests` | 본인 또는 같은 그룹 보호자 | path `memberId` | `200 memberId`, `interests[]` | 공통 오류 |
| `INTERESTS-002` | `PUT /groups/{groupId}/members/{memberId}/interests` | 피보호자 본인 | `interests[]` | `200 memberId`, `interests[]` | 공통 오류 |

그룹 데이터는 해당 그룹의 활성 구성원만 접근할 수 있습니다. 피보호자는 동시에 하나의 그룹에서만 활성 상태가 될 수 있습니다.

## 파일·피드

| ID | Method · Path | 권한 | 요청 | 성공 응답 | 주요 오류 |
|---|---|---|---|---|---|
| `FILES-001` | `POST /files/presigned-urls` | 인증 사용자 | `purpose`, `files[{fileName,contentType,sizeBytes}]` | `201 uploads[{uploadUrl,fileUrl,headers,expiresAt}]` | `INVALID_REQUEST` |
| `POSTS-001` | `GET /groups/{groupId}/posts` | 활성 구성원 | query `page?`, `size?` | `200 content[]`, `hasNext` | 공통 오류 |
| `POSTS-002` | `GET /posts/{postId}` | 활성 구성원 | path `postId` | `200 게시글·작성자·미디어·반응·댓글 수` | 공통 오류 |
| `POSTS-003` | `GET /groups/{groupId}/archive` | 활성 구성원 | query `date?`, `type?`, `memberId?`, `page?`, `size?` | `200 dates[]`, `hasNext` | `INVALID_REQUEST` |
| `POSTS-004` | `POST /posts` | 대상 그룹 활성 구성원 | `groupIds[]`, `content`, `mediaType`, `media[]` | `201 posts[{postId,groupId}]`, `createdAt` | 공통 오류 |
| `POSTS-005` | `PATCH /posts/{postId}` | 작성자 본인 | `content`, `mediaType`, `media[]` | `200 id`, `updatedAt` | 공통 오류 |
| `POSTS-007` | `DELETE /posts/{postId}` | 작성자 본인 | path `postId` | `204` | 공통 오류 |
| `COMMENTS-001` | `GET /posts/{postId}/comments` | 활성 구성원 | query `page?`, `size?` | `200 content[]`, `hasNext` | 공통 오류 |
| `COMMENTS-002` | `POST /posts/{postId}/comments` | 활성 구성원 | `content` | `201 id`, `postId`, `content`, `createdAt` | 공통 오류 |
| `COMMENTS-003` | `PATCH /comments/{commentId}` | 작성자 본인 | `content` | `200 id`, `content`, `updatedAt` | 공통 오류 |
| `COMMENTS-004` | `DELETE /comments/{commentId}` | 작성자 본인 | path `commentId` | `204` | 공통 오류 |
| `REACTIONS-001` | `PUT /posts/{postId}/reaction` | 활성 구성원 | `reactionType` | `200 postId`, `reactionType`, `counts` | 공통 오류 |

`FILES-001`의 `purpose`는 `post-media` 또는 `profile-image`입니다. 게시글 미디어는 이미지 1~4개 또는 MP4 영상 1개만 허용하며 Presigned URL은 10분 동안 유효합니다.

## 일정

| ID | Method · Path | 권한 | 요청 | 성공 응답 | 주요 오류 |
|---|---|---|---|---|---|
| `CALENDAR-001` | `GET /groups/{groupId}/events` | 활성 구성원 | query `startDate`, `endDate` | `200 events[]` | 공통 오류 |
| `CALENDAR-002` | `GET /events/{eventId}` | 활성 구성원 | path `eventId` | `200 일정 상세·참여자` | 공통 오류 |
| `CALENDAR-003` | `POST /groups/{groupId}/events` | 활성 구성원 | `title`, `description`, 날짜·시간, `participantMemberIds` | `201 eventId`, `createdAt` | 공통 오류 |
| `CALENDAR-004` | `PATCH /events/{eventId}` | 활성 구성원 | 일정 전체 필드 세트 | `200 id`, `lastEditorMemberId`, `updatedAt` | 공통 오류 |
| `CALENDAR-005` | `DELETE /events/{eventId}` | 작성자 또는 관리자 | path `eventId` | `204` | 공통 오류 |

날짜 일정은 `eventDate`와 `endDate`, 시간 일정은 `startAt`과 `endAt`을 사용합니다. 목록은 조회 구간과 하루라도 겹치는 일정을 반환합니다.

## AI 통화

> 통화 API의 JSON 필드는 다른 제품 API와 달리 `snake_case`를 사용합니다.

| ID | Method · Path | 권한 | 요청 | 성공 응답 | 주요 오류 |
|---|---|---|---|---|---|
| `CALLS-001` | `POST /call-sessions` | 피보호자 본인 | `persona_id`, `sdp_offer` | `201 call_session_id`, `sdp_answer` | `ACTIVE_CALL_EXISTS`, `AI_CONNECTION_FAILED` |
| `CALLS-002` | `POST /call-sessions/{callSessionId}/connection-result` | 통화 당사자 | `result`, 실패 시 `error_code` | `200 call_session_id` | `CALL_SESSION_NOT_FOUND`, `INVALID_CALL_STATUS` |
| `CALLS-003` | `POST /call-sessions/{callSessionId}/end` | 통화 당사자 | `termination_type?` | `202 call_session_id` | `CALL_SESSION_NOT_FOUND` |

종료 요청은 멱등하게 처리합니다. 최초 종결 상태와 종료 시각을 보존하고, 중복 요청에도 동일한 성공 응답을 반환합니다.

## 리포트·카네이션

| ID | Method · Path | 권한 | 요청 | 성공 응답 | 주요 오류 |
|---|---|---|---|---|---|
| `REPORTS-001` | `GET /groups/{groupId}/care-receivers/{memberId}/reports/calendar` | 같은 그룹 보호자 | query `year`, `month` | `200 yearMonth`, `reportDates[]`, `latestReportDate` | 공통 오류 |
| `REPORTS-002` | `GET /groups/{groupId}/members/{memberId}/reports/daily/{reportDate}` | 같은 그룹 보호자 | path `reportDate` | `200 generationStatus`, `dailyReport`, `calls[]` | 공통 오류 |
| `REPORTS-003` | `GET /call-sessions/{callSessionId}/report` | 같은 그룹 보호자 | path `callSessionId` | `200 summary`, `guardianMessage`, `createdAt` | `CALL_REPORT_NOT_READY` |
| `REPORTS-004` | `GET /call-sessions/{callSessionId}/report/status` | 같은 그룹 보호자 | path `callSessionId` | `200 status` | 공통 오류 |
| `REPORTS-005` | `POST /groups/{groupId}/members/{memberId}/reports/daily/generation-requests` | 같은 그룹 보호자 | body 없음 | `202 GENERATING` 또는 `200 READY` | `DAILY_REPORT_INPUT_NOT_READY`, `DAILY_REPORT_GENERATION_BUSY` |
| `CARNATION-001` | `GET /groups/{groupId}/grass` | 활성 구성원 | query `startDate?`, `endDate?` | `200 weekStart`, `weekEnd`, `rankings[]` | `INVALID_REQUEST` |
| `CARNATION-002` | `GET /groups/{groupId}/members/{memberId}/carnations` | 활성 구성원 | query `startDate`, `endDate` | `200 memberId`, `earnedDates[]` | 공통 오류 |

일일 리포트 상태는 `NOT_READY`, `AVAILABLE`, `GENERATING`, `READY`입니다. 카네이션 날짜와 주간 랭킹은 KST 기준이며 주는 월요일에 시작합니다.

## 알림·기기 토큰

| ID | Method · Path | 권한 | 요청 | 성공 응답 | 주요 오류 |
|---|---|---|---|---|---|
| `NOTIFICATIONS-001` | `POST /device-tokens` | 본인 | `token`, `deviceType` | 신규 `201`, 재등록 `200 id`, `deviceType`, `active` | 공통 오류 |
| `NOTIFICATIONS-002` | `GET /notifications/unread-count` | 본인 | 없음 | `200 unreadCount` | 공통 오류 |
| `NOTIFICATIONS-003` | `GET /notifications` | 본인 | query `page?`, `size?` | `200 content[]`, `hasNext` | 공통 오류 |
| `NOTIFICATIONS-004` | `PATCH /notifications/{notificationId}/read` | 본인 | path `notificationId` | `200 id`, `readAt` | 공통 오류 |
| `NOTIFICATIONS-005` | `PATCH /notifications/read-all` | 본인 | 없음 | `200 updatedCount`, `readAt` | 공통 오류 |
| `NOTIFICATIONS-006` | `GET /notification-settings` | 본인 | 없음 | `200 settings[]` | 공통 오류 |
| `NOTIFICATIONS-007` | `PUT /notification-settings` | 본인 | 알림 유형 7종의 `settings[]` | `200 updatedAt` | 공통 오류 |
| `NOTIFICATIONS-008` | `DELETE /device-tokens` | 본인 | `token` | `204` | 공통 오류 |
| `NOTIFICATIONS-009` | `DELETE /notifications/{notificationId}` | 본인 | path `notificationId` | `204` | `FORBIDDEN` |
| `NOTIFICATIONS-010` | `DELETE /notifications` | 본인 | 없음 | `204` | 공통 오류 |

`deviceType`은 현재 `ANDROID`만 허용합니다. `enabled=false`는 FCM 푸시만 차단하며 앱 내부 알림 레코드는 계속 생성합니다.

---

이 문서는 포트폴리오에서 API 경계와 권한 정책을 빠르게 확인하기 위한 명세입니다. 실제 실행 코드의 요청·응답 DTO와 데이터베이스 스키마는 `backend/`의 Java 코드와 Flyway 마이그레이션을 기준으로 합니다.
