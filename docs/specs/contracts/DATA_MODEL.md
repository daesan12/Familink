# 데이터 모델 계약

> 상태: 일부 확정
> 기준: 2026-07-28 최신 확정 ERD 기준·관계·테이블·제약 문서
> 데이터베이스: PostgreSQL

이 문서는 현재 사용하는 21개 테이블과 컬럼·Enum·제약의 로컬 계약이다.
모든 시각 컬럼은 별도 언급이 없으면
`TIMESTAMPTZ`이고 UTC 절대 시각으로 저장한다. API timestamp와 서버 로그도
UTC를 사용한다. 사용자 화면, 상대 날짜 해석, 일정 알림과 매일 22시 리포트
스케줄 같은 비즈니스 규칙에만 `Asia/Seoul`을 적용한다.

## 소유권

| 테이블 | 실행·쓰기 경계 |
|---|---|
| `users`, `family_groups`, `group_members`, `group_join_requests`, `member_aliases`, `member_interests`, `posts`, `post_media`, `comments`, `post_reactions`, `post_analyses`, `calendar_events`, `event_participants`, `call_sessions`, `call_transcripts`, `call_reports`, `daily_reports`, `carnations`, `notifications`, `notification_settings`, `device_tokens` | Spring Boot가 공개 API, 내부 AI 오케스트레이션과 모든 DB 읽기·쓰기를 소유한다. |

- Spring Boot 단일 백엔드가 DB 읽기·쓰기를 담당한다.
- `persona_id`는 Spring Boot가 관리하는 고정 페르소나 번호(1~6)이며 DB
  외래 키가 아니다. 별도 `personas` 테이블을 사용하지 않는다.

## 회원·그룹

### `users`

- PK: `id BIGINT`
- 컬럼:
  - `login_id VARCHAR(15) NULL UNIQUE`
  - `password_hash VARCHAR(255) NULL`
  - `name VARCHAR(10) NULL`
  - `birth_date DATE NULL`
  - `gender USER_GENDER NULL`
  - `profile_image_url VARCHAR(500) NULL`
  - `created_at`, `updated_at` NOT NULL
  - `withdrawn_at NULL`
- 활성 조건: `withdrawn_at IS NULL`
- 활성 계정 제약: 로그인 ID는 5~15자의 ASCII 영문 대·소문자와
  숫자(`[A-Za-z0-9]`)만 허용한다. 대소문자를 구분하고 소문자로 정규화하지
  않으며 입력값 그대로 저장·비교한다. 이름은 2~10자이며 필수 회원정보는
  NULL일 수 없다. 원문 비밀번호는 API에서 8~16자의 ASCII 영문 대·소문자와
  숫자만 허용하고 영문·숫자를 각각 최소 1자 포함하도록 검증하며 해시만
  저장한다.
- 로그인 ID 문자 규칙은 신규 가입과 로그인 ID 변경에 적용하며 기존 저장
  계정을 일괄 변환하거나 마이그레이션하지 않는다.
- 탈퇴 시 `login_id`, `password_hash`, `name`, `birth_date`, `gender`,
  `profile_image_url`을 NULL로 바꾸고 `withdrawn_at`을 기록한다.

### `family_groups`

- PK: `id BIGINT`
- 컬럼: `name VARCHAR(10)`, `invite_code VARCHAR(6) UNIQUE`,
  `created_at`, `updated_at`; 모두 NOT NULL

### `group_members`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`, `user_id -> users.id`
- 컬럼: `role GROUP_ROLE`, `is_manager BOOLEAN`, `joined_at`, `created_at`,
  `updated_at` NOT NULL; `left_at NULL`
- Unique: `(group_id, user_id)`
- 활성 조건: `left_at IS NULL`
- 부분 Unique:
  - 그룹마다 활성 관리자 한 명:
    `uq_group_active_manager(group_id) WHERE is_manager = true AND left_at IS NULL`
  - 한 사용자는 활성 피보호자로 한 그룹에만 속함:
    `uq_user_active_care_receiver(user_id) WHERE role = 'CARE_RECEIVER' AND left_at IS NULL`
- `role`과 `is_manager`는 서로 독립된 축이다.
- 관리자 판정은 `left_at IS NULL AND is_manager = true`이며, 그룹 생성·위임·나가기 트랜잭션 완료 시 활성 관리자 1명을 유지한다. 이 규칙을 별도 DB `CHECK`로 추가한다고 확정하지 않는다.
- 그룹 API의 `managerMemberId`는 활성 관리자
  `group_members.id`이며 `users.id`가 아니다. 활성 관리자가 없으면
  `null`을 반환하고 별도 `family_groups` 컬럼을 추가하지 않는다.
- 탈퇴·내보내기는 `left_at`을 기록하고, 재가입은 기존 행의 `left_at`을
  NULL로 되돌린 뒤 역할과 가입 시각을 갱신한다.

### `group_join_requests`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `applicant_user_id -> users.id`
- 컬럼: `assigned_role GROUP_ROLE NULL`,
  `status JOIN_REQUEST_STATUS`, `created_at` NOT NULL,
  `processed_at NULL`
- 부분 Unique:
  `(group_id, applicant_user_id) WHERE status = 'PENDING_ADMIN'`
- `assigned_role`은 승인 시 관리자가 정하며 그 전에는 NULL일 수 있다.

### `member_aliases`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `owner_member_id -> group_members.id`,
  `target_member_id -> group_members.id`
- 컬럼: `alias VARCHAR(10)`, `created_at`, `updated_at` NOT NULL
- Unique: `(group_id, owner_member_id, target_member_id)`
- CHECK: `owner_member_id <> target_member_id` — 자기 자신에게는 별칭을
  붙일 수 없다. 본인 표시 이름을 바꾸려면 별칭이 아니라 이름을 수정한다.

### `member_interests`

- PK: `id BIGINT`
- FK: `care_receiver_member_id -> group_members.id`
- 컬럼: `interest_text VARCHAR(10)`, `created_at` NOT NULL
- Unique: `(care_receiver_member_id, interest_text)`
- 한 피보호자당 최대 10개를 애플리케이션에서 보장한다.

## 가족 피드

### `posts`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `author_member_id -> group_members.id`
- 컬럼: `content VARCHAR(140)`, `created_at`, `updated_at` NOT NULL

### `post_media`

- PK: `id BIGINT`
- FK: `post_id -> posts.id`
- 컬럼: `media_type MEDIA_TYPE`, `file_url VARCHAR(500)`,
  `display_order INT` NOT NULL; `thumbnail_url VARCHAR(500) NULL`
- Unique: `(post_id, display_order)`
- 한 게시글은 이미지 1~4장 또는 영상 1개만 가질 수 있고 이미지와 영상을
  섞지 않는다. 저장 URL은 최적화 파일 기준이다.
- MIME은 컬럼으로 저장하지 않는다. 게시글 분석 시 허용된 저장소
  메타데이터의 `Content-Type`을 조회하며 URL 확장자로 추측하지 않는다.

### `comments`

- PK: `id BIGINT`
- FK: `post_id -> posts.id`,
  `author_member_id -> group_members.id`
- 컬럼: `content VARCHAR(50)`, `created_at`, `updated_at` NOT NULL
- 대댓글 관계는 없고 삭제는 하드 삭제다.

### `post_reactions`

- PK: `id BIGINT`
- FK: `post_id -> posts.id`,
  `group_member_id -> group_members.id`
- 컬럼: `reaction_type REACTION_TYPE`, `created_at`, `updated_at` NOT NULL
- Unique: `(post_id, group_member_id)`

### `post_analyses`

- PK: `id BIGINT`
- FK·Unique: `post_id -> posts.id`
- 컬럼: `status ANALYSIS_STATUS` NOT NULL,
  `summary VARCHAR(500) NULL`, `analyzed_at NULL`, `created_at` NOT NULL
- 상태는 `PENDING`, `SUCCESS`, `FAILED`다.
- `PENDING`: `summary=NULL`, `analyzed_at=NULL`
- `SUCCESS`: 요약과 완료 시각을 저장한다.
- `FAILED`: `summary=NULL`, `analyzed_at=NULL`
- 재분석할 때 새 행을 추가하지 않고 게시글의 기존 한 행을 `PENDING`으로
  갱신한다.
- 게시글을 하드 삭제하면 미디어·댓글·반응·분석도 함께 정리한다.

## 공유 일정

### `calendar_events`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `creator_member_id -> group_members.id`,
  `last_editor_member_id -> group_members.id`
- 컬럼: `title VARCHAR(20)`, `event_date DATE`, `created_at`, `updated_at`
  NOT NULL; `description VARCHAR(50) NULL`, `start_at TIMESTAMPTZ NULL`,
  `end_at TIMESTAMPTZ NULL`
- 시간 쌍 CHECK:
  - 날짜 일정은 `start_at`, `end_at`이 모두 NULL이다.
  - 시간 일정은 두 값이 모두 존재하고 `end_at >= start_at`이다.
- 삭제는 하드 삭제이며 참여자를 함께 정리한다.

### `event_participants`

- PK: `id BIGINT`
- FK: `event_id -> calendar_events.id`,
  `group_member_id -> group_members.id`
- Unique: `(event_id, group_member_id)`
- 일정 알림은 `notifications`에 저장한다.

## AI 통화·리포트

### `call_sessions`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `care_receiver_member_id -> group_members.id`
- 컬럼: `persona_id BIGINT`, `status CALL_STATUS`, `created_at` NOT NULL;
  `started_at NULL`, `ended_at NULL`
- 시간 의미:
  - `created_at`: Spring Boot가 통화 시작 요청을 접수한 시각
  - `started_at`: WebRTC 연결 성공 결과를 받은 시각
  - `ended_at`: 종료·취소·실패 처리를 완료한 시각

### `call_transcripts`

- PK: `id BIGINT`
- FK: `call_session_id -> call_sessions.id`
- 컬럼: `speaker SPEAKER_TYPE`, `content TEXT`, `sequence INT`,
  `created_at` NOT NULL; `openai_item_id VARCHAR(100) NULL`
- Unique: `(call_session_id, sequence)`
- Index: `(call_session_id, sequence)`
- 사용자와 AI의 전사 완료 이벤트를 발화 단위로 저장한다. 실시간 `delta`는
  자막에 쓸 수 있지만 영구 저장 기준이 아니다.
- `UNIQUE(openai_item_id)`는 검토 가능한 선택지일 뿐 현행 확정 제약이 아니다.

### `call_reports`

- PK: `id BIGINT`
- FK·Unique: `call_session_id -> call_sessions.id`
- 컬럼: `summary VARCHAR(100)`, `emotion_category EMOTION_CATEGORY`,
  `emotion_subcategory VARCHAR(50)`, `created_at` NOT NULL;
  `guardian_message VARCHAR(100) NULL`

### `daily_reports`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `care_receiver_member_id -> group_members.id`
- 컬럼: `report_date DATE`, `summary VARCHAR(200)`,
  `emotion_category EMOTION_CATEGORY`,
  `emotion_subcategory VARCHAR(50)`, `created_at` NOT NULL;
  `guardian_message VARCHAR(200) NULL`
- `report_date=D`는 `Asia/Seoul` 기준 `[D-1 22:00, D 22:00)` 집계
  구간의 기준일이다. 구간 시작은 포함하고 종료는 제외하며, 종료 시각
  조건은 UTC `Instant`로 변환해 `call_sessions.ended_at`을 조회한다.
- Unique: `(care_receiver_member_id, report_date)`

## 활동·알림

### `carnations`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `group_member_id -> group_members.id`
- 컬럼: `earned_date DATE`, `created_at` NOT NULL
- Unique: `(group_member_id, earned_date)`
- Index: `(group_id, earned_date)`
- `earned_date`는 KST 기준이다.

### `notifications`

- PK: `id BIGINT`
- 필수 FK: `receiver_user_id -> users.id`
- 선택 FK:
  - `actor_user_id -> users.id`
  - `group_id -> family_groups.id`
  - `related_join_request_id -> group_join_requests.id`
  - `related_post_id -> posts.id`
  - `related_event_id -> calendar_events.id`
  - `related_call_report_id -> call_reports.id`
  - `related_daily_report_id -> daily_reports.id`
- 컬럼: `type NOTIFICATION_TYPE`, `title TEXT`,
  `body TEXT`, `created_at` NOT NULL; `read_at NULL`,
  `reminder_slot NULL` (`DAY_BEFORE` | `HOUR_BEFORE`,
  `EVENT_REMINDER` 알림에만 사용하고 그 외에는 NULL)
- 일정 시작 알림 중복 방지 부분 Unique:
  `(receiver_user_id, related_event_id, type, reminder_slot)
  WHERE type = 'EVENT_REMINDER' AND related_event_id IS NOT NULL`
- `title`, `body`는 스냅샷으로 유지한다. 관련 대상 삭제 시 해당 FK를
  `ON DELETE SET NULL`로 바꾸고 스냅샷은 유지한다.

### `notification_settings`

- PK: `id BIGINT`
- FK: `user_id -> users.id`
- 컬럼: `notification_type NOTIFICATION_TYPE`,
  `is_enabled BOOLEAN`, `updated_at` NOT NULL
- Unique: `(user_id, notification_type)`
- 설정은 사용자·유형 단위이며 `group_id`는 사용하지 않는다.
- 이 값은 앱 내부 알림 생성 여부가 아니라 푸시 허용 여부다.
- `is_enabled`의 최초 기본값은 `true`다.

### `device_tokens`

- PK: `id BIGINT`
- FK: `user_id -> users.id`
- 컬럼: `token VARCHAR(500) UNIQUE`, `device_type VARCHAR(20)`,
  `is_active BOOLEAN`, `created_at`, `updated_at` NOT NULL

## Enum

| Enum | 값 |
|---|---|
| `USER_GENDER` | `MALE`, `FEMALE` |
| `GROUP_ROLE` | `GUARDIAN`, `CARE_RECEIVER` |
| `JOIN_REQUEST_STATUS` | `PENDING_ADMIN`, `APPROVED`, `REJECTED` |
| `MEDIA_TYPE` | `IMAGE`, `VIDEO` |
| `REACTION_TYPE` | `HEART`, `LAUGH`, `SURPRISE`, `SAD`, `SUPPORT` |
| `ANALYSIS_STATUS` | `PENDING`, `SUCCESS`, `FAILED` |
| `NOTIFICATION_TYPE` | `NEW_POST`, `POST_ACTIVITY`, `EVENT_CHANGED`, `EVENT_REMINDER`, `CALL_REPORT`, `DAILY_REPORT`, `GROUP_JOIN_REQUEST` |
| `CALL_STATUS` | `CONNECTING`, `IN_PROGRESS`, `COMPLETED`, `INCOMPLETE`, `CANCELLED`, `FAILED` |
| `SPEAKER_TYPE` | `USER`, `ASSISTANT` |
| `EMOTION_CATEGORY` | `ANGER`, `SADNESS`, `ANXIETY`, `HURT`, `EMBARRASSMENT`, `JOY`, `NEUTRAL` |

`user_status`, `group_member_status`, `reminder_status`는 제거된 Enum이다.

## 공통 삭제·보존 규칙

- 회원 탈퇴: 개인정보를 익명화하고 `withdrawn_at`을 기록하되 게시글·댓글·
  일정과 과거 그룹 관계는 보존한다.
- 그룹 나가기·내보내기: `group_members.left_at`을 기록한다.
- 그룹 삭제: 관리자이면서 다른 활성 구성원이 없을 때만 하드 삭제할 수 있다.
  Spring Boot는 한 트랜잭션에서 `member_interests`, `member_aliases`, `posts`,
  `calendar_events`, `call_sessions`, `daily_reports`, `carnations`,
  `group_join_requests`, `group_members`, `family_groups` 순서로 명시적으로
  삭제한다. `post_media`, `comments`, `post_reactions`, `post_analyses`,
  `event_participants`, `call_transcripts`, `call_reports`는 기존 FK의
  `ON DELETE CASCADE`로 정리한다. `notifications`의 그룹 및 관련 대상 FK는
  기존 `ON DELETE SET NULL`을 유지하고 알림 스냅샷은 보존한다. 그 밖의
  `family_groups`·`group_members` 참조 FK는 기존 `NO ACTION`을 유지하며,
  애플리케이션이 참조 행을 먼저 삭제한다. `users`와 다른 그룹의 데이터는
  삭제하지 않는다.
- Flyway가 생성한 실제 PostgreSQL 스키마의 `information_schema`를 조회하는
  가드 테스트로 `family_groups`·`group_members` 참조 FK의 등록 목록,
  `delete_rule`과 정리 방식을 고정한다. 미등록 FK가 추가되거나
  `NO ACTION`·`CASCADE`·`SET NULL` 정책이 바뀌면 테스트가 실패해야 한다.
- 게시글·일정·댓글: 위 각 테이블에 명시된 방식으로 하드 삭제한다.
- 푸시 성공·실패 전송 이력은 현재 저장하지 않는다.

## 미결정·충돌

- `openai_item_id`에 Unique를 둘지는 검토 중이다.
- 통화 전사 보존 기간과 삭제 시점은 확정되지 않았다.
