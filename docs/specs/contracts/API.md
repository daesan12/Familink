# API 계약

> 상태: 일부 확정
> 기준: 2026-07-31, Notion 활성 API 명세 59건과 승인된 알림 API 응답 계약

이 문서는 제품 구현에서 사용하는 유일한 로컬 API 계약이다. 아래 목록에는
Notion 활성 API 59건의 ID, Method, Path, 처리 백엔드, 권한, 핵심 요청,
성공 결과와 원본에 명시된 오류를 옮겼다.

표의 성공 결과는 원본 성공 응답의 핵심 `data` 내용이다. 오류가 “명시
없음”인 행에도 구현자가 관례적인 오류 코드를 추가해서는 안 되며, 먼저
계약을 확정해야 한다.

## 공통 경계

- 본문이 있는 성공 응답은 최상위에 `success=true`, API별 성공 문구인
  `message`, 표의 성공 결과로 구성한 객체인 `data`를 둔다.
- 실패 응답은 최상위에 `success=false`, 표의 명시 오류 문자열인 `code`,
  오류 문구인 `message`, 필드 검증 실패 목록인 `errors`를 두며 `data`를
  포함하지 않는다. 필드별 오류는 `field`, `message`로 구성하고 필드 단위
  원인이 없으면 `errors`는 빈 배열이다.
- `204 No Content` 성공 응답은 공통 응답 봉투를 포함하지 않는다.
- 확인된 성공 문구는 `API-AUTH-001`의 `로그인 아이디 중복 확인 성공`,
  `API-AUTH-002`의 `회원가입 성공`, `API-AUTH-003`의 `로그인 성공`,
  `API-AUTH-004`의 `토큰 재발급 성공`, `API-NOTIFICATIONS-001`의
  `기기 토큰 등록 성공`, `API-NOTIFICATIONS-002`의
  `읽지 않은 알림 개수 조회 성공`, `API-NOTIFICATIONS-003`의
  `알림 목록 조회 성공`, `API-NOTIFICATIONS-004`의
  `알림 읽음 처리 성공`, `API-NOTIFICATIONS-005`의
  `전체 알림 읽음 처리 성공`, `API-NOTIFICATIONS-006`의
  `푸시 알림 설정 조회 성공`, `API-NOTIFICATIONS-007`의
  `푸시 알림 설정 저장 성공`, `API-CALLS-001`의 `AI 통화 세션 생성 성공`,
  `API-CALLS-002`의 `AI 통화 연결 결과 처리 성공`, `API-CALLS-003`의
  `AI 통화 종료 요청 접수 성공`이다. 다른 API의 성공 문구는 각 API의
  확정 원본이나 별도 결정을 따른다.
- 확인된 오류 문구는 `INVALID_REQUEST`의 `요청 형식 또는 검증 실패`,
  `LOGIN_ID_DUPLICATED`의 `이미 사용 중인 로그인 아이디`,
  `INVALID_CREDENTIALS`의 `아이디 또는 비밀번호가 일치하지 않습니다.`다.
- 모든 API의 Method와 Path는 이 문서 표의 값을 사용한다. 표에 적힌 Path가
  공식 구현 경로이며 `/api/v1`,
  `/internal/v1` 등의 별도 기본 경로를 앞에 추가하지 않는다.
- Spring Boot가 활성 API 59건 전체와 AI 오케스트레이션, DB 읽기·쓰기를
  처리한다.
- 게시글 분석은 Spring Scheduler가 대상을 선별한 뒤 Spring Boot 내부
  서비스 호출로 수행한다.
- 인증이 필요한 요청은 Access Token을 사용한다. 재발급은 Refresh Token을
  사용한다.
- 회원가입과 로그인은 `loginId`와 `password`를 사용한다. 이메일
  회원가입·로그인·인증은 지원하지 않는다.
- `API-AUTH-001`·`API-AUTH-002`·`API-USERS-002`의 `loginId`는
  5~15자의 ASCII 영문 대·소문자와 숫자(`[A-Za-z0-9]`)만 허용한다.
  한글·공백·특수문자는 `400 INVALID_REQUEST`로 거부한다. 로그인 ID는
  대소문자를 구분하고 소문자로 정규화하지 않으며 입력값 그대로 저장·
  비교한다. `API-AUTH-003` 로그인도 같은 대소문자 구분으로 조회한다.
- `API-AUTH-002`의 `password`는 8~16자의 ASCII 영문 대·소문자와
  숫자만 허용하며 영문과 숫자를 각각 최소 1자 포함해야 한다.
  한글·공백·특수문자 또는 한 종류만 사용한 값은
  `400 INVALID_REQUEST`로 거부한다.
- 로그인 ID 문자 규칙은 신규 가입과 `API-USERS-002`의 로그인 ID 변경에
  적용한다. 기존 저장 계정은 일괄 변환하지 않으며 로그인 시 입력값 그대로
  대소문자를 구분해 비교한다.
- 그룹 데이터는 해당 그룹의 활성 구성원 범위에서만 접근한다.
- Spring Boot 통화 API는 Access Token으로 사용자, 현재 그룹, 피보호자
  구성원과 권한을 확인한다. 클라이언트가 이 값을 별도 식별자로 보내지 않는다.
- `API-POSTS-001`, `API-COMMENTS-001`, `API-NOTIFICATIONS-003`의 목록
  query는 `page`, `size`만 지원한다. `page`는 0부터 시작하며 기본값은
  `0`이다. `size`의 기본값은 `20`, 허용 범위는 `1`~`100`이다. 성공
  결과는 `content[]`, `hasNext`를 포함한다. 음수 `page`, 허용 범위 밖의
  `size`, 지원하지 않는 `sort` query는 `400 INVALID_REQUEST`로 거부한다.
- 목록 정렬은 `API-POSTS-001`이 `createdAt DESC, id DESC`,
  `API-COMMENTS-001`이 `createdAt ASC, id ASC`,
  `API-NOTIFICATIONS-003`이 `createdAt DESC, id DESC`로 고정된다.
- API timestamp는 ISO-8601 UTC 절대 시각으로 교환한다. 사용자 화면과
  비즈니스 스케줄에 필요한 경우에만 `Asia/Seoul`로 변환한다.

## 인증·회원

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-AUTH-001` | `GET /auth/login-id/check` | Spring Boot · 공개 | query `loginId` | `200`: `available` | `400 INVALID_REQUEST` |
| `API-AUTH-002` | `POST /auth/signup` | Spring Boot · 공개 | `loginId`, `password`, `name`, `birthDate`, `gender` | `201`: `userId`, `loginId`, `name`, `createdAt` | `400 INVALID_REQUEST`; `409 LOGIN_ID_DUPLICATED` |
| `API-AUTH-003` | `POST /auth/login` | Spring Boot · 공개 | `loginId`, `password` | `200`: `tokenType=Bearer`, `accessToken`, `accessTokenExpiresIn=1800`, `refreshToken`, `user{id,name}` | `400 INVALID_REQUEST`; `401 INVALID_CREDENTIALS` |
| `API-AUTH-004` | `POST /auth/reissue` | Spring Boot · Refresh Token | `refreshToken` | `200`: `tokenType=Bearer`, `accessToken`, `accessTokenExpiresIn=1800`, `refreshToken` | `400 INVALID_REQUEST`; `401 INVALID_REFRESH_TOKEN` |
| `API-AUTH-005` | `POST /auth/logout` | Spring Boot · 토큰 소유자 | `refreshToken` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-USERS-001` | `GET /users/me` | Spring Boot · 본인 | 없음 | `200`: `loginId`, `name`, `birthDate`, `gender`, `profileImageUrl` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-USERS-002` | `PATCH /users/me` | Spring Boot · 본인 | `name`, `loginId`, `birthDate`, `gender`, `profileImageUrl` | `200`: `id`, `name`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 LOGIN_ID_DUPLICATED` |
| `API-USERS-003` | `DELETE /users/me` | Spring Boot · 본인 | 없음 | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 MANAGER_TRANSFER_REQUIRED` |

- `API-AUTH-004`는 현재 Redis에 저장된 Refresh Token과 요청 토큰이 같을
  때만 새 Token Pair로 원자적으로 회전한다. 성공하면 기존 Refresh Token은
  즉시 무효화되고 새 Refresh Token의 유효 기간은 기본 14일로 다시 시작한다.
- `API-AUTH-005`는 인증에 사용한 Access Token을 남은 만료 시간 동안
  블랙리스트에 등록하고, 요청 Refresh Token이 현재 저장값일 때 사용자별
  Refresh Token 키를 삭제한다.
- 일반 로그아웃은 인증이 유효한 동안 현재 기기의 FCM token으로
  `API-NOTIFICATIONS-008`을 먼저 호출한 뒤 `API-AUTH-005`를 호출한다.
  인증이 유효한 상태에서 OS 알림 권한을 철회할 때도 현재 또는 직전에
  발급받아 보관 중인 token으로 `API-NOTIFICATIONS-008`을 호출한다.
  `API-AUTH-005` 요청에 기기 token을 추가하지 않으며 서버가
  Access/Refresh Token만으로 기기를 추측하지 않는다.
- 프로필 이미지는 `API-FILES-001`에 `purpose=profile-image`와 이미지
  1개를 보내 받은 URL에 응답 `headers`를 그대로 사용해 PUT한 뒤, 반환된
  `fileUrl`을 `API-USERS-002.profileImageUrl`로 전달한다.
- `API-USERS-002.profileImageUrl`은 요청에서 생략하면 기존 값을 유지하고,
  명시적 `null`이면 삭제하며, 문자열이면 새 이미지로 교체한다. 문자열은
  설정된 S3 또는 허용 CDN 호스트이며 object key가 `profile-image/` 아래인
  URL만 허용한다. Spring Boot는 저장 전 스토리지 메타데이터의 이미지
  MIME과 10 MiB 제한을 다시 검증한다.
- DB에는 만료되지 않는 안정적인 `fileUrl`을 저장한다. `API-USERS-001`은
  접근 가능한 CDN URL 또는 다운로드용 서명 URL을 `profileImageUrl`로
  반환한다. 교체·삭제된 과거 객체와 고아 객체의 정리는 별도 수명주기
  작업이며, 그 정리 실패로 프로필 수정 성공을 막지 않는다.
- `API-USERS-003`은 회원 탈퇴 트랜잭션에서 해당 사용자의 모든
  `device_tokens`를 비활성화한다.

## 그룹·구성원·관심사

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-GROUPS-001` | `GET /groups` | Spring Boot · 인증 사용자 본인 | 없음 | `200`: `groups[{id,name,myMemberId,myRole,memberCount,isManager}]`, `joinRequests[{joinRequestId,groupId,groupName,status,requestedAt,processedAt}]` | 명시 없음 |
| `API-GROUPS-002` | `POST /groups` | Spring Boot · 인증 사용자 | `name`, `myRole` | `201`: `groupId`, `managerMemberId`, `inviteCode`, `createdAt` | 명시 없음 |
| `API-GROUPS-003` | `POST /join-requests/by-code` | Spring Boot · 인증 사용자 | `inviteCode` | `201`: `joinRequestId`, `groupId`, `groupName`, `status=PENDING_ADMIN` | `400 INVITE_CODE_INVALID`; `409 ALREADY_GROUP_MEMBER`; `409 JOIN_REQUEST_ALREADY_EXISTS` |
| `API-GROUPS-004` | `GET /groups/{groupId}` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId` | `200`: `id`, `name`, `managerMemberId`, `isManager`, `guardianCount`, `careReceiverCount`, `memberCount` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-GROUPS-005` | `GET /groups/{groupId}/members` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; optional query `role` | `200`: `members[{memberId,userId,displayName,role,isManager}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-GROUPS-006` | `PATCH /groups/{groupId}` | Spring Boot · 그룹 관리자 | `name` | `200`: `id`, `name`, `updatedAt` | 명시 없음 |
| `API-GROUPS-007` | `GET /groups/{groupId}/invite-code` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId` | `200`: `inviteCode` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-GROUPS-008` | `GET /groups/{groupId}/join-requests` | Spring Boot · 그룹 관리자 | path `groupId`; query `status` | `200`: `joinRequests[{joinRequestId,applicantUserId,applicantName,profileImageUrl,status,assignedRole,processedAt,createdAt}]` | `403 NOT_GROUP_MANAGER` |
| `API-GROUPS-009` | `PATCH /groups/{groupId}/join-requests/{joinRequestId}` | Spring Boot · 그룹 관리자 | `decision=APPROVE\|REJECT`; 승인 시 `assignedRole` | `200`: `joinRequestId`, `status`, `memberId`, `assignedRole` | `400 INVALID_JOIN_REQUEST_DECISION`; `400 ASSIGNED_ROLE_REQUIRED`; `403 NOT_GROUP_MANAGER`; `404 JOIN_REQUEST_NOT_FOUND`; `409 JOIN_REQUEST_ALREADY_PROCESSED`; `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP` |
| `API-GROUPS-010` | `PATCH /groups/{groupId}/members/{memberId}/role` | Spring Boot · 그룹 관리자 | `role` | `200`: `groupId`, `memberId`, `role` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 GROUP_MEMBER_NOT_FOUND`; `409 GROUP_MEMBER_ALREADY_LEFT`; `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP` |
| `API-GROUPS-011` | `PATCH /groups/{groupId}/manager` | Spring Boot · 그룹 관리자 | `newManagerMemberId` | `200`: `groupId`, `managerMemberId` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 GROUP_MEMBER_NOT_FOUND`; `409 GROUP_MEMBER_ALREADY_LEFT` |
| `API-GROUPS-012` | `DELETE /groups/{groupId}/members/{memberId}` | Spring Boot · 그룹 관리자 | path `groupId`, `memberId` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 GROUP_MEMBER_NOT_FOUND`; `409 GROUP_MEMBER_ALREADY_LEFT`; `409 CANNOT_REMOVE_SELF` |
| `API-GROUPS-013` | `DELETE /groups/{groupId}/leave` | Spring Boot · 해당 그룹 활성 구성원 본인 | body 없음 | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 MANAGER_TRANSFER_REQUIRED` |
| `API-GROUPS-014` | `DELETE /groups/{groupId}` | Spring Boot · 그룹 관리자 | `confirmationName` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 GROUP_HAS_ACTIVE_MEMBERS`; `409 GROUP_NAME_MISMATCH` |
| `API-GROUPS-015` | `GET /groups/{groupId}/members/{memberId}` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`, `memberId` | `200`: `memberId`, `displayName`, `age`, `gender` | `403 NOT_GROUP_MEMBER`; `404 GROUP_MEMBER_NOT_FOUND` |
| `API-ALIASES-001` | `PUT /groups/{groupId}/members/{targetMemberId}/alias` | Spring Boot · 해당 그룹 활성 구성원 본인 | `alias` | `200`: `targetMemberId`, `alias` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-INTERESTS-001` | `GET /groups/{groupId}/members/{memberId}/interests` | Spring Boot · 대상 피보호자 본인 또는 같은 그룹 활성 보호자 | path `groupId`, `memberId` | `200`: `memberId`, `interests[]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-INTERESTS-002` | `PUT /groups/{groupId}/members/{memberId}/interests` | Spring Boot · 피보호자 본인 | `interests[]` | `200`: `memberId`, `interests[]` | 명시 없음 |

- `API-GROUPS-009`는 요청 명령에 `decision`을 사용한다. `APPROVE`이면
  `assignedRole`이 필수이고, `REJECT`이면 `assignedRole`을 생략하거나
  `null`로 전달한다.
- 승인 시 `group_join_requests.status=APPROVED`, 거절 시
  `status=REJECTED`와 `processed_at`을 기록한다. 거절 시 `assigned_role`은
  `NULL`로 유지하며 `group_members`는 생성하거나 변경하지 않는다.
- `API-GROUPS-002`·`API-GROUPS-004`의 `managerMemberId`는 해당 그룹에서
  `left_at IS NULL AND is_manager = true`인 `group_members.id`다.
  `users.id`가 아니며 활성 관리자가 없으면 `null`을 반환한다.
  `API-GROUPS-002`에서는 생성자의 새 멤버십 ID를 반환한다.
  `API-GROUPS-004`의 `isManager`는 조회 요청자 본인의 활성 멤버십
  `is_manager` 값으로 별도 계산한다.
- 관심사는 0~10개를 허용한다. 각 값은 trim 후 1~10자이며 공백만 있는
  값은 거부하고, trim 후 중복 문자열은 한 번만 저장한다.

## 파일·피드·댓글·반응

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-FILES-001` | `POST /files/presigned-urls` | Spring Boot · Access Token 로그인 사용자 | `purpose`, `files[{fileName,contentType,sizeBytes}]` | `201`: `uploads[{uploadUrl,fileUrl,headers,expiresAt}]` | `400 INVALID_REQUEST` |
| `API-POSTS-001` | `GET /groups/{groupId}/posts` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; 선택 query `page`, `size` | `200`: `content[{id,author,content,media,reactionCounts,myReaction,commentCount,createdAt}]`, `hasNext` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-002` | `GET /posts/{postId}` | Spring Boot · 해당 그룹 활성 구성원 | path `postId` | `200`: `id`, `groupId`, `author`, `content`, `media`, `reactions`, `commentCount`, `createdAt`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-003` | `GET /groups/{groupId}/archive` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; 선택 query `date`, `type`, `memberId`(`group_members.id`) | `200`: `dates[{date,items[{postId,type,thumbnailUrl,contentPreview}]}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-004` | `POST /posts` | Spring Boot · 대상 그룹의 활성 구성원 | `groupIds[]`, `content`, `mediaType`, `media[{fileUrl,thumbnailUrl,displayOrder}]` | `201`: `posts[{postId,groupId}]`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-005` | `PATCH /posts/{postId}` | Spring Boot · 작성자 본인 | `content`, `mediaType`, `media[{fileUrl,thumbnailUrl?,displayOrder}]` | `200`: `id`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-POSTS-007` | `DELETE /posts/{postId}` | Spring Boot · 작성자 본인 | path `postId` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-COMMENTS-001` | `GET /posts/{postId}/comments` | Spring Boot · 해당 그룹 활성 구성원 | path `postId`; 선택 query `page`, `size` | `200`: `content[{id,author,content,createdAt,updatedAt}]`, `hasNext` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-COMMENTS-002` | `POST /posts/{postId}/comments` | Spring Boot · 해당 그룹 활성 구성원 | `content` | `201`: `id`, `postId`, `content`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-COMMENTS-003` | `PATCH /comments/{commentId}` | Spring Boot · 작성자 본인 | `content` | `200`: `id`, `content`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-COMMENTS-004` | `DELETE /comments/{commentId}` | Spring Boot · 작성자 본인 | path `commentId` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-REACTIONS-001` | `PUT /posts/{postId}/reaction` | Spring Boot · 해당 그룹 활성 구성원 | `reactionType` | `200`: `postId`, `reactionType`, `counts` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |

구현 규칙:

- `API-POSTS-004`는 선택한 각 그룹에 독립된 `posts` 행을 만든다.
- `API-POSTS-003`의 `memberId`는 해당 그룹의 활성
  `group_members.id`만 허용한다. 생략하면 작성자의 현재 활성 여부와
  관계없이 조회 가능한 모든 보관함 게시글을 반환하고, 지정하면 작성자
  구성원이 일치하는 게시글만 반환한다. `date`, `type`, `memberId`를 함께
  전달하면 모든 조건을 AND로 적용한다. 존재하지 않거나 비활성 또는 다른
  그룹의 `memberId`는 `400 INVALID_REQUEST`로 거부한다.
- `API-POSTS-005`의 `media`는 요청에 포함된 항목으로 기존 미디어 전체를
  교체한다. 미디어 항목에서 `thumbnailUrl`을 생략하면 해당 썸네일은
  `null`로 저장한다.
- 보호자의 게시글 작성에 따른 카네이션은 KST 날짜·그룹 기준 하루 최대
  한 번 적립한다.
- `API-FILES-001.purpose`는 정확히 `post-media`, `profile-image`만
  허용한다. 서버는 UUID 기반 object key를 각각 `post-media/`,
  `profile-image/` 아래에 만든다.
- `post-media`는 이미지 1~4개 또는 영상 정확히 1개만 허용하고 둘을 섞지
  않는다. 이미지는 파일당 최대 10 MiB(10,485,760 bytes)이며
  `image/jpeg`, `image/png`, `image/webp`만 허용한다. 영상은 파일당 최대
  100 MiB(104,857,600 bytes)이며 `video/mp4`만 허용한다.
  `profile-image`는 위 이미지 MIME과 10 MiB 제한을 적용한 이미지 정확히
  1개만 허용한다.
- 각 `fileName`은 공백이 아닌 1~255자이며 경로 구분자와 제어 문자를
  허용하지 않는다. `sizeBytes`는 0보다 크고 해당 목적·MIME의 최대 크기
  이하여야 한다. 빈 `files`, 개수 초과, 미디어 혼합, 알 수 없는
  `purpose`, 허용하지 않는 MIME과 잘못된 필드는 `400 INVALID_REQUEST`다.
  필드 단위 원인이 있으면 공통 실패 봉투의 `errors[{field,message}]`에
  기록한다.
- Spring Boot는 `contentType`의 공백·대소문자·선택 매개변수를 정규화해
  표준 MIME으로 검증하고, 같은 값을 PUT 서명과 응답의
  `headers.Content-Type`에 사용한다. PUT의 `Content-Type`은 필수이며
  클라이언트는 반환된 모든 헤더 이름과 값을 그대로 사용한다.
  `expiresAt`은 발급 시각 10분 뒤의 ISO-8601 UTC 절대 시각이다. 반환
  헤더가 빠졌거나 값이 다른 업로드는 성공으로 간주하지 않는다.
- 게시글에는 최적화본 URL만 저장한다.
- Spring Scheduler가 마지막 `updated_at` 이후 10분간 변경이 없는 게시글을
  찾고 Spring 내부 `PostAnalysisService`를 호출한다.

## 일정

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-CALENDAR-001` | `GET /groups/{groupId}/events` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; query `startDate`, `endDate` | `200`: `events[{id,title,eventDate,endDate,startAt,endAt}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CALENDAR-002` | `GET /events/{eventId}` | Spring Boot · 해당 그룹 활성 구성원 | path `eventId` | `200`: `id`, `groupId`, `title`, `description`, `eventDate`, `endDate`, `startAt`, `endAt`, `creatorMemberId`, `participantMemberIds` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CALENDAR-003` | `POST /groups/{groupId}/events` | Spring Boot · 해당 그룹 활성 구성원 | `title`, `description`, `eventDate`, `endDate`, `startAt`, `endAt`, `participantMemberIds` | `201`: `eventId`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CALENDAR-004` | `PATCH /events/{eventId}` | Spring Boot · 작성자 또는 그룹 관리자 | `title`, `description`, `eventDate`, `endDate`, `startAt`, `endAt`, `participantMemberIds` | `200`: `id`, `lastEditorMemberId`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CALENDAR-005` | `DELETE /events/{eventId}` | Spring Boot · 작성자 또는 그룹 관리자 | path `eventId` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |

- 모든 일정은 시작 날짜 전날 09:00 KST에 알림을 생성하고, 시간 일정은
  추가로 시작 1시간 전에 생성한다.
- `eventDate`는 일정의 시작 날짜, `endDate`는 종료 날짜다. 하루짜리 일정도
  두 값을 모두 보내고 받으며 이때 두 값은 같다.
- 하루종일(날짜) 일정은 `startAt`, `endAt`을 보내지 않거나 null로 보내고
  `eventDate`와 `endDate`로 날짜 범위를 지정한다. `endDate`를 생략하면
  `eventDate`와 같은 하루짜리 일정으로 저장한다.
- 시간 일정은 서버가 `startAt`·`endAt`의 `Asia/Seoul` 날짜로 `eventDate`·
  `endDate`를 파생하며 요청에 담긴 날짜 값을 무시한다.
- `API-CALENDAR-001`의 query `startDate`·`endDate`는 조회 구간이며, 그
  구간과 하루라도 겹치는 일정을 반환한다. 같은 이름이지만 응답의
  `endDate`(일정 종료 날짜)와는 의미가 다르다.
- `API-CALENDAR-004`는 핵심 요청의 전체 필드 세트를 보내는 전체 갱신이며,
  `startAt`·`endAt`이 없거나 null이면 날짜 일정으로 저장한다.
- 일정 삭제 시 참여자를 삭제한다. 기존 알림은 `title`, `body` 스냅샷을
  유지하며 관련 FK 처리의 세부 방식은 데이터 계약의 미결정 사항을 따른다.

## AI 통화

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-CALLS-001` | `POST /call-sessions` | Spring Boot · 피보호자 본인 | `persona_id`, `sdp_offer` | `201`: `call_session_id`, `sdp_answer` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 ACTIVE_CALL_EXISTS`; `502 AI_CONNECTION_FAILED` |
| `API-CALLS-002` | `POST /call-sessions/{callSessionId}/connection-result` | Spring Boot · 통화 당사자 본인 | `result=CONNECTED\|FAILED`; `FAILED`일 때 `error_code` | `200`: `call_session_id`; `CONNECTING`에서 `IN_PROGRESS` 또는 `FAILED`로 전이 | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 CALL_SESSION_NOT_FOUND`; `409 INVALID_CALL_STATUS` |
| `API-CALLS-003` | `POST /call-sessions/{callSessionId}/end` | Spring Boot · 통화 당사자 본인 | 선택 `termination_type=USER_REQUESTED\|CONNECTION_LOST`; body 또는 값이 없으면 `USER_REQUESTED` | `202`: `call_session_id`; `USER_REQUESTED`는 `CONNECTING -> CANCELLED`, `IN_PROGRESS -> COMPLETED`; `CONNECTION_LOST`는 `CONNECTING -> FAILED`, `IN_PROGRESS -> INCOMPLETE`; 먼저 확정된 종결 상태를 보존하고 중복 요청도 동일 성공 응답; 마지막 전사·리포트는 접수 후 처리 | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 CALL_SESSION_NOT_FOUND` |

- 통화 API의 JSON 필드는 `snake_case`를 사용하고 Path는 위 표의
  `{callSessionId}` 형태를 유지한다. 클라이언트는 `groupId`, 서버가
  관리하는 현재 세션 `status`, 내부 사용자·멤버십 ID를 추가로 보내지
  않는다. 계약에 정의된 연결 결과 `result`와 종료 원인
  `termination_type`은 그대로 전달한다.
- 잘못된 JSON, 필수 필드 누락, enum 값 오류, SDP 또는 필드 검증 실패는
  `400 INVALID_REQUEST`다. Access Token 누락·만료·서명 실패는
  `401 UNAUTHORIZED`, 유효한 사용자지만 피보호자 역할 또는 해당 통화
  당사자 권한이 없으면 `403 FORBIDDEN`이다.
- 존재하지 않는 세션은 `API-CALLS-002`·`003`에서
  `404 CALL_SESSION_NOT_FOUND`다. 활성 통화 중 새 세션 생성은
  `API-CALLS-001`에서 `409 ACTIVE_CALL_EXISTS`, 연결 결과를 받을 수 없는
  세션 상태는 `API-CALLS-002`에서 `409 INVALID_CALL_STATUS`다. OpenAI
  Realtime 연결 생성 또는 SDP 교환 실패는 `API-CALLS-001`에서
  `502 AI_CONNECTION_FAILED`다.
- `API-CALLS-003`의 중복 종료는 오류가 아니다. 최초 종결 상태와
  `endedAt`을 보존하고 후속 요청에도 같은 `202` 성공을 반환하며, 마지막
  전사 정리와 리포트 생성은 한 번만 접수한다. 중복 종료에는 `409`를
  사용하지 않는다.
- 위 결정은 HTTP 상태와 오류 `code` 매핑을 고정한다. 별도로 문구가 확정되지
  않은 통화 오류의 `message`는 클라이언트 분기 기준으로 사용하지 않으며,
  정확한 문구는 미결정이다.

## 리포트·카네이션

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-REPORTS-001` | `GET /groups/{groupId}/care-receivers/{memberId}/reports/calendar` | Spring Boot · 같은 그룹 활성 보호자 | path `groupId`, `memberId`; query `year`, `month` | `200`: `yearMonth`, `reportDates[]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-REPORTS-002` | `GET /groups/{groupId}/members/{memberId}/reports/daily/{reportDate}` | Spring Boot · 같은 그룹 활성 보호자 | path `groupId`, `memberId`, `reportDate` | `200`: `date`, `dailyReport{id,summary,emotionCategory,emotionSubcategory,guardianMessageSummary}` 또는 `dailyReport=null`, `calls[{callSessionId,startedAt,reportAvailable}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-REPORTS-003` | `GET /call-sessions/{callSessionId}/report` | Spring Boot · 같은 그룹 활성 보호자 | path `callSessionId` | `200`: `callSessionId`, `summary`, `guardianMessage`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 CALL_REPORT_NOT_READY` |
| `API-CARNATION-001` | `GET /groups/{groupId}/grass` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`; 선택 query `startDate`, `endDate`(둘 다 지정하거나 둘 다 생략) | `200`: `weekStart`, `weekEnd`, `rankings[{memberId,displayName,carnationCount,previousWeekWinner}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-CARNATION-002` | `GET /groups/{groupId}/members/{memberId}/carnations` | Spring Boot · 해당 그룹 활성 구성원 | path `groupId`, `memberId`; query `startDate`, `endDate` | `200`: `memberId`, `startDate`, `endDate`, `earnedDates[]` | 명시 없음 |

- `API-REPORTS-002`의 `guardianMessageSummary`는 일일 대표 보호자 전달
  메모 단일 문자열이며 전달할 내용이 없으면 `null`이다.
- Spring Boot는 `daily_reports`와 `call_reports`를 직접 읽어 리포트 응답을
  구성한다.
- Spring Scheduler는 `Asia/Seoul` 기준 매일 22시에 일일 리포트 생성을
  실행한다. `API-REPORTS-002`의 `reportDate=D`는
  `[D-1 22:00, D 22:00)` 구간의 Asia/Seoul 기준일이며 시작 시각은
  포함하고 종료 시각은 제외한다. 저장·로그·API timestamp와 종료 시각
  조회 조건은 UTC를 사용한다.
- 카네이션 날짜와 주간 랭킹 경계는 KST이며 주는 월요일에 시작한다.
  공동 순위를 허용한다.
- `API-CARNATION-001`은 `startDate`, `endDate`를 모두 생략하면 KST
  현재 주의 월요일부터 일요일까지 조회한다. 값을 지정할 때는 둘 다
  ISO-8601 날짜로 보내고 `startDate`가 월요일이며
  `endDate = startDate + 6일`이어야 한다. 한쪽만 전달하거나 이 범위를
  벗어나면 `400 INVALID_REQUEST`다. 과거 기록도 같은 주간 단위로 조회한다.

## 알림·기기 토큰

| API ID | Method · Path | 백엔드·권한 | 핵심 요청 | 성공 결과 | 명시 오류 |
|---|---|---|---|---|---|
| `API-NOTIFICATIONS-001` | `POST /device-tokens` | Spring Boot · 본인 | `token`, `deviceType` | 신규 `201`, 재등록·재활성화·소유권 이전 `200`: `id`, `deviceType`, `active=true` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED` |
| `API-NOTIFICATIONS-002` | `GET /notifications/unread-count` | Spring Boot · 본인 | 없음 | `200`: `unreadCount` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-003` | `GET /notifications` | Spring Boot · 본인 | 선택 query `page`, `size` | `200`: `content[{id,type,title,body,groupId,actor:{userId,name,profileImageUrl}\|null,relatedJoinRequestId,relatedPostId,relatedEventId,relatedCallReportId,relatedDailyReportId,readAt,createdAt}]`, `hasNext` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-004` | `PATCH /notifications/{notificationId}/read` | Spring Boot · 본인 | path `notificationId` | `200`: `id`, `readAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-005` | `PATCH /notifications/read-all` | Spring Boot · 본인 | 없음 | `200`: `updatedCount`, `readAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-006` | `GET /notification-settings` | Spring Boot · 본인 | 없음 | `200`: 알림 유형 7종의 `settings[{notificationType,enabled}]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-007` | `PUT /notification-settings` | Spring Boot · 본인 | 알림 유형 7종의 `settings[{notificationType,enabled}]` | `200`: `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
| `API-NOTIFICATIONS-008` | `DELETE /device-tokens` | Spring Boot · 본인 | `token` | `204 No Content` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |

- `API-NOTIFICATIONS-003.actor`는 행위자 참조가 없거나 삭제됐다면 `null`이다.
  actor가 있으면 `userId`는 필수이고, 회원 탈퇴 후 익명화될 수 있는
  `name`과 `profileImageUrl`은 nullable이다. `memberId`, `role`,
  `displayName`, `loginId`, 생년월일, 성별은 포함하지 않는다. 수신자별
  호칭을 적용한 과거 문구는 `title`·`body` 스냅샷을 사용한다.
- `enabled=false`는 해당 유형의 푸시만 차단한다. 앱 내부 알림 레코드는
  계속 생성한다.
- 푸시는 해당 유형이 활성이고 수신자에게 활성 기기 토큰이 있을 때만
  시도한다.
- `API-NOTIFICATIONS-001.token`은 공백이 아닌 최대 500자의 opaque
  문자열이다. 서버는 정규식, 대소문자 변경 또는 형식 변환을 적용하지
  않는다. MVP의 `deviceType` 허용값은 정확히 `ANDROID` 하나다.
- 토큰 문자열은 시스템 전체에서 한 행만 가지며 활성 토큰은 동시에 한
  사용자만 소유한다. Spring Boot는 Unique 제약과 행 잠금 또는 동등한
  원자적 upsert로 등록한다.
- 같은 사용자가 다시 등록하면 기존 `id`를 유지하면서 `active=true`로
  복구하고 `deviceType`, `updatedAt`을 갱신한다. 다른 사용자가 같은 토큰을
  등록하면 같은 행의 소유자를 새 인증 사용자에게 이전하고 동일하게
  갱신한다. 두 경우 모두 `200`이며 이전 사용자에게 해당 토큰으로 푸시를
  보내지 않는다.
- 소유권 이전에서는 인증 사용자가 정확한 opaque token을 제출한 사실을
  현재 기기의 token 보유 증명으로 본다. 이전 사용자의 추가 확인은 요구하지
  않는다.
- 처음 생성한 토큰은 `201`, 재등록·재활성화·소유권 이전은 `200`을
  반환한다. 모두 `기기 토큰 등록 성공` 문구와
  `data={id,deviceType,active=true}`를 사용한다.
- `API-NOTIFICATIONS-008`은 행을 삭제하지 않고 `active=false`로 바꾼다.
  본인 소유 토큰이 없거나 이미 비활성이면 `204 No Content`, 다른 사용자가
  소유한 토큰이면 `403 FORBIDDEN`이다.
