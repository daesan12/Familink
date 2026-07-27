# API 계약

> 상태: 일부 확정
> 기준: 2026-07-26 조회, API 명세서 2차 수정본 60건

이 문서는 제품 구현에서 사용하는 유일한 로컬 API 계약이다. 아래 목록에는
2차 수정본의 모든 API ID, Method, Path, 처리 백엔드, 권한, 핵심 요청, 성공
결과와 원본에 명시된 오류만 옮겼다. 이전 API 경로·콜백 구조·필드·상태 코드를
섞지 않는다.

표의 성공 결과는 원본 성공 응답의 핵심 `data` 내용이다. 공통 응답 봉투의
세부 형태가 행에 적혀 있지 않다면 임의로 만들지 않는다. 오류가 “명시 없음”인
행에도 구현자가 관례적인 오류 코드를 추가해서는 안 되며, 먼저 계약을
확정해야 한다.

## 공통 경계

- 모든 API의 Method와 Path는 `API 명세서 2차 수정본`의 값을 그대로
  사용한다. 이 문서 표에 적힌 Path가 공식 구현 경로이며 `/api/v1`,
  `/internal/v1` 등의 별도 기본 경로를 앞에 추가하지 않는다.
- 이전 API 문서나 다른 개요 문서의 경로·콜백 구조를 혼합하지 않는다.
- Spring Boot: 인증, 계정, 그룹, 피드, 일정, 알림 및 리포트 조회 API를
  처리한다.
- FastAPI: `API-CALLS-001`~`003`과 내부 게시글 분석 요청
  `API-POSTS-006`을 처리한다.
- 인증이 필요한 요청은 Access Token을 사용한다. 재발급은 Refresh Token을
  사용한다.
- 그룹 데이터는 해당 그룹의 활성 구성원 범위에서만 접근한다.
- FastAPI 통화 API는 Access Token으로 사용자, 현재 그룹, 피보호자
  구성원과 권한을 확인한다. 클라이언트가 이 값을 별도 식별자로 보내지 않는다.

## 인증·회원

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-AUTH-001` | `GET /auth/login-id/check` | Spring Boot · 공개 | query `loginId` | `200`: `available` | `400 INVALID_REQUEST` |
| `API-AUTH-002` | `POST /auth/signup` | Spring Boot · 공개 | `loginId`, `password`, `name`, `birthDate`, `gender` | `201`: `userId`, `loginId`, `name`, `createdAt` | `400 INVALID_REQUEST`; `409 LOGIN_ID_DUPLICATED` |
| `API-AUTH-003` | `POST /auth/login` | Spring Boot · 공개 | `loginId`, `password` | `200`: `tokenType`, `accessToken`, `accessTokenExpiresIn`, `refreshToken`, `user{id,name}` | `400 INVALID_REQUEST`; `401 INVALID_CREDENTIALS` |
| `API-AUTH-004` | `POST /auth/reissue` | Spring Boot · Refresh Token | `refreshToken` | `200`: `tokenType`, `accessToken`, `accessTokenExpiresIn`, `refreshToken` | `400 INVALID_REQUEST`; `401 INVALID_REFRESH_TOKEN` |
| `API-AUTH-005` | `POST /auth/logout` | Spring Boot · 토큰 소유자 | `refreshToken` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-USERS-001` | `GET /users/me` | Spring Boot · 본인 | 없음 | `200`: `loginId`, `name`, `birthDate`, `gender`, `profileImageUrl` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-USERS-002` | `PATCH /users/me` | Spring Boot · 본인 | `name`, `loginId`, `birthDate`, `gender`, `profileImageUrl` | `200`: `id`, `name`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 LOGIN_ID_DUPLICATED` |
| `API-USERS-003` | `DELETE /users/me` | Spring Boot · 본인 | 없음 | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 MANAGER_TRANSFER_REQUIRED` |

## 그룹·구성원·관심사

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-GROUPS-001` | `GET /groups` | Spring Boot · 인증 사용자 본인 | 없음 | `200`: `groups[{id,name,myMemberId,myRole,memberCount,isManager}]`, `joinRequests[{joinRequestId,groupId,groupName,status,requestedAt,processedAt}]` | 명시 없음 |
| `API-GROUPS-002` | `POST /groups` | Spring Boot · 인증 사용자 | `name`, `myRole` | `201`: `groupId`, `managerMemberId`, `inviteCode`, `createdAt` | 명시 없음 |
| `API-GROUPS-003` | `POST /join-requests/by-code` | Spring Boot · 인증 사용자 | `inviteCode` | `201`: `joinRequestId`, `groupId`, `groupName`, `status=PENDING_ADMIN` | `400 INVITE_CODE_INVALID`; `409 ALREADY_GROUP_MEMBER`; `409 JOIN_REQUEST_ALREADY_EXISTS` |
| `API-GROUPS-005` | `GET /groups/{groupId}` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId` | `200`: `id`, `name`, `managerMemberId`, `isManager`, `guardianCount`, `careReceiverCount`, `memberCount` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-GROUPS-006` | `GET /groups/{groupId}/members` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; optional query `role` | `200`: `members[{memberId,userId,displayName,role,isManager}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-GROUPS-007` | `PATCH /groups/{groupId}` | Spring Boot · 그룹 관리자 | `name` | `200`: `id`, `name`, `updatedAt` | 명시 없음 |
| `API-GROUPS-008` | `GET /groups/{groupId}/invite-code` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId` | `200`: `inviteCode` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-GROUPS-010` | `GET /groups/{groupId}/join-requests` | Spring Boot · 그룹 관리자 | path `groupId`; query `status` | `200`: `joinRequests[{joinRequestId,applicantUserId,applicantName,profileImageUrl,status,assignedRole,processedAt,createdAt}]` | `403 NOT_GROUP_MANAGER` |
| `API-GROUPS-011` | `PATCH /groups/{groupId}/join-requests/{joinRequestId}/approve` | Spring Boot · 그룹 관리자 | `assignedRole` | `200`: `joinRequestId`, `status`, `memberId`, `assignedRole` | `403 NOT_GROUP_MANAGER`; `404 JOIN_REQUEST_NOT_FOUND`; `409 JOIN_REQUEST_ALREADY_PROCESSED`; `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP` |
| `API-GROUPS-012` | `PATCH /groups/{groupId}/join-requests/{joinRequestId}/reject` | Spring Boot · 그룹 관리자 | body 없음 | `204 No Content` | `403 NOT_GROUP_MANAGER`; `404 JOIN_REQUEST_NOT_FOUND`; `409 JOIN_REQUEST_ALREADY_PROCESSED` |
| `API-GROUPS-013` | `PATCH /groups/{groupId}/members/{memberId}/role` | Spring Boot · 그룹 관리자 | `role` | `200`: `groupId`, `memberId`, `role` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 GROUP_MEMBER_NOT_FOUND`; `409 GROUP_MEMBER_ALREADY_LEFT`; `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP` |
| `API-GROUPS-014` | `PATCH /groups/{groupId}/manager` | Spring Boot · 그룹 관리자 | `newManagerMemberId` | `200`: `groupId`, `managerMemberId` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 GROUP_MEMBER_NOT_FOUND`; `409 GROUP_MEMBER_ALREADY_LEFT` |
| `API-GROUPS-015` | `DELETE /groups/{groupId}/members/{memberId}` | Spring Boot · 그룹 관리자 | path `groupId`, `memberId` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 GROUP_MEMBER_NOT_FOUND`; `409 GROUP_MEMBER_ALREADY_LEFT`; `409 CANNOT_REMOVE_SELF` |
| `API-GROUPS-016` | `POST /groups/{groupId}/leave` | Spring Boot · 해당 그룹 활성 구성원 본인 | body 없음 | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 MANAGER_TRANSFER_REQUIRED` |
| `API-GROUPS-017` | `DELETE /groups/{groupId}` | Spring Boot · 그룹 관리자 | `confirmationName` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 GROUP_HAS_ACTIVE_MEMBERS`; `409 GROUP_NAME_MISMATCH` |
| `API-ALIASES-001` | `PUT /groups/{groupId}/members/{targetMemberId}/alias` | Spring Boot · 해당 그룹 활성 구성원 본인 | `alias` | `200`: `targetMemberId`, `alias` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-INTERESTS-002` | `GET /groups/{groupId}/members/{memberId}/interests` | Spring Boot · 대상 피보호자 본인 또는 같은 그룹 활성 보호자 | path `groupId`, `memberId` | `200`: `memberId`, `interests[]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-INTERESTS-003` | `PUT /groups/{groupId}/members/{memberId}/interests` | Spring Boot · 피보호자 본인 | `interests[]` | `200`: `memberId`, `interests[]` | 명시 없음 |

## 파일·피드·댓글·반응

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-FILES-001` | `POST /files/presigned-urls` | Spring Boot · Access Token 로그인 사용자 | `purpose`, `files[{fileName,contentType,sizeBytes}]` | `201`: `uploads[{uploadUrl,fileUrl,headers,expiresAt}]` | 명시 없음 |
| `API-POSTS-001` | `GET /groups/{groupId}/posts` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; 원본의 페이지 query | `200`: `content[{id,author,content,media,reactionCounts,myReaction,commentCount,createdAt}]`, `hasNext` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-002` | `GET /posts/{postId}` | Spring Boot · 해당 그룹 활성 구성원 | path `postId` | `200`: `id`, `groupId`, `author`, `content`, `media`, `reactions`, `commentCount`, `createdAt`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-003` | `GET /groups/{groupId}/archive` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; query `date`, `type` | `200`: `dates[{date,items[{postId,type,thumbnailUrl,contentPreview}]}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-004` | `POST /posts` | Spring Boot · 대상 그룹의 활성 구성원 | `groupIds[]`, `content`, `mediaType`, `media[{fileUrl,thumbnailUrl,displayOrder}]` | `201`: `posts[{postId,groupId}]`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-005` | `PATCH /posts/{postId}` | Spring Boot · 작성자 본인 | `content`, `mediaType`, `media[{fileUrl,displayOrder}]` | `200`: `id`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-006` | `POST /internal/posts/{postId}/analysis` | FastAPI · 내부 서버 인증 | body 없음; path `postId` | `202`: `post_id`, `status=PENDING`; 비동기 처리 후 `post_analyses` 갱신 | `400 EMPTY_CONTENT`; `404 POST_NOT_FOUND`; `409 ANALYSIS_IN_PROGRESS` |
| `API-POSTS-007` | `DELETE /posts/{postId}` | Spring Boot · 작성자 본인 | path `postId` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-COMMENTS-001` | `GET /posts/{postId}/comments` | Spring Boot · 해당 그룹 활성 구성원 | path `postId`; 원본의 페이지 query | `200`: `content[{id,author,content,createdAt,updateAt}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-COMMENTS-002` | `POST /posts/{postId}/comments` | Spring Boot · 해당 그룹 활성 구성원 | `content` | `201`: `id`, `postId`, `content`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-COMMENTS-003` | `PATCH /comments/{commentId}` | Spring Boot · 작성자 본인 | `content` | `200`: `id`, `content`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-COMMENTS-004` | `DELETE /comments/{commentId}` | Spring Boot · 작성자 본인 | path `commentId` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-REACTIONS-001` | `PUT /posts/{postId}/reaction` | Spring Boot · 해당 그룹 활성 구성원 | `reactionType` | `200`: `postId`, `reactionType`, `counts` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |

구현 규칙:

- `API-POSTS-004`는 각 그룹에 독립된 `posts` 행을 만들며 `batch_id`를
  사용하지 않는다.
- 보호자의 게시글 작성에 따른 카네이션은 KST 날짜·그룹 기준 하루 최대
  한 번 적립한다.
- `API-FILES-001`의 `purpose`별 MIME 허용 목록과 최대 크기는 미결정이다.
  서버가 UUID 기반 object key를 만들며 제품 DB에는 최적화본 URL만 저장한다.
- `API-POSTS-006`은 Spring Boot가 마지막 `updated_at` 이후 10분간
  변경이 없음을 확인한 다음 호출한다.

## 일정

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-CALENDAR-001` | `GET /groups/{groupId}/events` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; query `startDate`, `endDate` | `200`: `events[{id,title,eventDate,startAt,endAt}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CALENDAR-002` | `GET /events/{eventId}` | Spring Boot · 해당 그룹 활성 구성원 | path `eventId` | `200`: `id`, `groupId`, `title`, `description`, `eventDate`, `startAt`, `endAt`, `creatorMemberId`, `participantMemberIds` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CALENDAR-003` | `POST /groups/{groupId}/events` | Spring Boot · 해당 그룹 활성 구성원 | `title`, `description`, `eventDate`, `startAt`, `endAt`, `participantMemberIds` | `201`: `eventId`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CALENDAR-004` | `PATCH /events/{eventId}` | Spring Boot · 작성자 또는 그룹 관리자 | `title`, `description`, `eventDate`, `startAt`, `endAt`, `participantMemberIds` | `200`: `id`, `lastEditorMemberId`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CALENDAR-005` | `DELETE /events/{eventId}` | Spring Boot · 작성자 또는 그룹 관리자 | path `eventId` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |

- 날짜 일정 알림은 전날 09:00 KST, 시간 일정 알림은 시작 1시간 전에
  생성한다.
- 일정 삭제 시 참여자를 삭제한다. 기존 알림은 `title`, `body` 스냅샷을
  유지하며 관련 FK 처리의 세부 방식은 데이터 계약의 미결정 사항을 따른다.

## AI 통화

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-CALLS-001` | `POST /call-sessions` | FastAPI · 피보호자 본인 | `persona_id`, `sdp_offer` | `201`: `call_session_id`, `sdp_answer` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 ACTIVE_CALL_EXISTS`; `502 AI_CONNECTION_FAILED` |
| `API-CALLS-002` | `POST /call-sessions/{callSessionId}/connection-result` | FastAPI · 통화 당사자 본인 | `result=CONNECTED\|FAILED`; `FAILED`일 때 `error_code` | `200`: `call_session_id`; `CONNECTING`에서 `IN_PROGRESS` 또는 `FAILED`로 전이 | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 CALL_SESSION_NOT_FOUND`; `409 INVALID_CALL_STATUS` |
| `API-CALLS-003` | `POST /call-sessions/{callSessionId}/end` | FastAPI · 통화 당사자 본인 | body 없음 | `202`: `call_session_id`; `CONNECTING -> CANCELLED`, `IN_PROGRESS -> COMPLETED`; 마지막 전사·리포트는 접수 후 처리 | `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 CALL_SESSION_NOT_FOUND`; `409 INVALID_CALL_STATUS` |

## 리포트·카네이션

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-REPORTS-001` | `GET /groups/{groupId}/care-receivers/{memberId}/reports/calendar` | Spring Boot · 같은 그룹 활성 보호자 | path `groupId`, `memberId`; query `yearMonth` | `200`: `yearMonth`, `reportDates[]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-REPORTS-002` | `GET /groups/{groupId}/members/{memberId}/reports/daily/{reportDate}` | Spring Boot · 같은 그룹 활성 보호자 | path `groupId`, `memberId`, `reportDate` | `200`: `date`, `dailyReport{id,summary,emotionCategory,emotionSubcategory,guardianMessages[]}` 또는 `dailyReport=null`, `calls[{callSessionId,startedAt,reportAvailable}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-REPORTS-003` | `GET /call-sessions/{callSessionId}/report` | Spring Boot · 같은 그룹 활성 보호자 | path `callSessionId` | `200`: `callSessionId`, `summary`, `guardianMessage`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 CALL_REPORT_NOT_READY` |
| `API-CARNATION-001` | `GET /groups/{groupId}/grass` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; 원본의 기간 query | `200`: `weekStart`, `weekEnd`, `rankings[{memberId,displayName,carnationCount,previousWeekWinner}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CARNATION-002` | `GET /groups/{groupId}/members/{memberId}/carnations` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`, `memberId`; query `startDate`, `endDate` | `200`: `memberId`, `startDate`, `endDate`, `earnedDates[]` | 명시 없음 |

- `API-REPORTS-002`의 `guardianMessages`는 건당 보호자 전달 메모 문자열
  배열이며 전달할 내용이 없으면 빈 배열이다.
- Spring Boot는 `daily_reports`와 `call_reports`를 직접 읽어 리포트 응답을
  구성한다.
- 카네이션 날짜와 주간 랭킹 경계는 KST이며 주는 월요일에 시작한다.
  공동 순위를 허용한다.

## 알림·기기 토큰

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-NOTIFICATIONS-001` | `POST /device-tokens` | Spring Boot · 본인 | `token`, `deviceType` | `201`: `id`, `deviceType`, `active` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-002` | `GET /notifications/unread-count` | Spring Boot · 본인 | 없음 | `200`: `unreadCount` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-003` | `GET /notifications` | Spring Boot · 본인 | 원본의 페이지 query | `200`: `content[{id,type,title,body,groupId,actor,relatedJoinRequestId,relatedPostId,relatedEventId,relatedCallReportId,relatedDailyReportId,readAt,createdAt}]`, `hasNext` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-004` | `PATCH /notifications/{notificationId}/read` | Spring Boot · 본인 | path `notificationId` | `200`: `id`, `readAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-005` | `PATCH /notifications/read-all` | Spring Boot · 본인 | 없음 | `200`: `updatedCount`, `readAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-006` | `GET /notification-settings` | Spring Boot · 본인 | 없음 | `200`: 알림 유형 7종의 `settings[{notificationType,enabled}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-007` | `PUT /notification-settings` | Spring Boot · 본인 | 알림 유형 7종의 `settings[{notificationType,enabled}]` | `200`: `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-008` | `DELETE /device-tokens` | Spring Boot · 본인 | `token` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |

- `enabled=false`는 해당 유형의 푸시만 차단한다. 앱 내부 알림 레코드는
  계속 생성한다.
- 푸시는 해당 유형이 활성이고 수신자에게 활성 기기 토큰이 있을 때만
  시도한다.
- 토큰은 전역 Unique다. 동일 토큰 재등록 시 갱신 정책은 미결정이다.

## 계약상 미결정

- `API-FILES-001`의 `purpose` 값, MIME 허용 목록과 파일별 최대 크기
- 동일 기기 토큰을 다시 등록할 때 기존 행을 갱신하는 세부 정책
- `API-REPORTS-002.guardianMessages[]`와
  `daily_reports.guardian_message TEXT`의 저장·응답 매핑
- 22시 이후 종료된 통화를 어느 날짜의 일일 리포트에 포함할지
- `API-GROUPS-002`·`005`의 `managerMemberId`를
  `group_members.is_manager`에서 구성하는 정확한 규칙
- `API-GROUPS-011`은 409 상황을 명시하지만 본문의 “추가 협의 필요” 문구와
  오류 표의 도메인 오류명 사이에 불일치가 있어 최종 오류명을 임의 확정하지 않는다.
