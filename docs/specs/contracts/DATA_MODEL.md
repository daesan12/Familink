# 데이터 모델 계약

> 상태: 일부 확정
> 기준: 2026-07-23 최신 확정 ERD 기준·관계·테이블·제약 문서
> 데이터베이스: PostgreSQL

이 문서는 현재 사용하는 21개 테이블의 로컬 계약이다. 예전 내장 DBML, 삭제된
컬럼·Enum·테이블은 구현 기준이 아니다. 모든 시각 컬럼은 별도 언급이 없으면
`TIMESTAMPTZ`이고, 제품의 날짜 해석 기준 시간대는 `Asia/Seoul`이다.
Notion 원본은 2026-07-26에 다시 읽었으며, 이 시각은 조회 스냅샷이지 문서의
최종 수정 시각을 뜻하지 않는다.

## 소유권

| 근거 수준 | 테이블 | 실행·쓰기 경계 |
|---|---|---|
| 아키텍처·API 실행 책임 확정, 테이블별 물리 쓰기 선언은 없음 | `users`, `family_groups`, `group_members`, `group_join_requests`, `member_aliases`, `member_interests`, `posts`, `post_media`, `comments`, `post_reactions`, `calendar_events`, `event_participants`, `carnations`, `notifications`, `notification_settings`, `device_tokens` | Spring Boot가 대응하는 사용자-facing 업무 API를 처리하고 게시글 `updated_at`을 관리한다. ERD는 각 테이블의 물리적 쓰기 소유자를 별도로 명시하지 않았다. |
| 직접 쓰기 확정 | `post_analyses`, `call_sessions`, `call_transcripts`, `call_reports`, `daily_reports` | FastAPI가 AI 분석·통화·리포트 결과를 직접 생성·변경한다. |

- Spring Boot는 화면과 공개 API 제공을 위해 FastAPI 소유 결과를 읽을 수 있다.
- FastAPI는 인증·권한 검증과 AI 컨텍스트 구성을 위해 필요한 일반 업무
  데이터를 읽을 수 있다.
- FastAPI가 위 일반 업무 테이블의 새로운 쓰기 경로를 맡거나 Spring Boot가
  AI 결과 테이블을 대신 쓰도록 바꾸려면 먼저 스펙 변경 승인이 필요하다.
- `persona_id`는 FastAPI의 고정 페르소나 번호이며 DB 외래 키가 아니다.

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
- 활성 계정 제약: 아이디 5~15자, 이름 2~10자이며 필수 회원정보는 NULL일
  수 없다. 원문 비밀번호는 API에서 8~16자로 검증하고 해시만 저장한다.
- 탈퇴 시 `login_id`, `password_hash`, `name`, `birth_date`, `gender`,
  `profile_image_url`을 NULL로 바꾸고 `withdrawn_at`을 기록한다.

### `family_groups`

- PK: `id BIGINT`
- 컬럼: `name VARCHAR(10)`, `invite_code VARCHAR(6) UNIQUE`,
  `created_at`, `updated_at`; 모두 NOT NULL
- `image`, `description`, `batch_id`와 같은 과거 컬럼은 사용하지 않는다.

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
- `batch_id`는 사용하지 않는다.

### `post_media`

- PK: `id BIGINT`
- FK: `post_id -> posts.id`
- 컬럼: `media_type MEDIA_TYPE`, `file_url VARCHAR(500)`,
  `display_order INT` NOT NULL; `thumbnail_url VARCHAR(500) NULL`
- Unique: `(post_id, display_order)`
- 한 게시글은 이미지 1~4장 또는 영상 1개만 가질 수 있고 이미지와 영상을
  섞지 않는다. 저장 URL은 최적화 파일 기준이다.

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
- 컬럼: `status VARCHAR(20)` NOT NULL,
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
  NOT NULL; `description VARCHAR(50) NULL`, `start_at NULL`, `end_at NULL`
- 시간 쌍 CHECK:
  - 날짜 일정은 `start_at`, `end_at`이 모두 NULL이다.
  - 시간 일정은 두 값이 모두 존재하고 `end_at >= start_at`이다.
- 삭제는 하드 삭제이며 참여자를 함께 정리한다.

### `event_participants`

- PK: `id BIGINT`
- FK: `event_id -> calendar_events.id`,
  `group_member_id -> group_members.id`
- Unique: `(event_id, group_member_id)`
- 별도 `event_reminders` 테이블은 사용하지 않는다.

## AI 통화·리포트

### `call_sessions`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `care_receiver_member_id -> group_members.id`
- 컬럼: `persona_id BIGINT`, `status CALL_STATUS`, `created_at` NOT NULL;
  `started_at NULL`, `ended_at NULL`
- 시간 의미:
  - `created_at`: FastAPI가 통화 시작 요청을 접수한 시각
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
  `guardian_message TEXT NULL`

### `daily_reports`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `care_receiver_member_id -> group_members.id`
- 컬럼: `report_date DATE`, `summary VARCHAR(200)`,
  `emotion_category EMOTION_CATEGORY`,
  `emotion_subcategory VARCHAR(50)`, `created_at` NOT NULL;
  `guardian_message TEXT NULL`
- Unique: `(care_receiver_member_id, report_date)`

## 활동·알림

### `carnations`

- PK: `id BIGINT`
- FK: `group_member_id -> group_members.id`
- 컬럼: `earned_date DATE`, `created_at` NOT NULL
- Unique: `(group_member_id, earned_date)`
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
- 컬럼: `type NOTIFICATION_TYPE`, `title VARCHAR(100)`,
  `body VARCHAR(300)`, `created_at` NOT NULL; `read_at NULL`
- 일정 시작 알림 중복 방지 부분 Unique:
  `(receiver_user_id, related_event_id, type)
  WHERE type = 'EVENT_REMINDER' AND related_event_id IS NOT NULL`
- `title`, `body`는 스냅샷으로 유지한다. 관련 대상 삭제 시 해당 FK를
  NULL로 바꾸거나 스냅샷만 유지한다는 원칙까지만 확정되어 있다.

### `notification_settings`

- PK: `id BIGINT`
- FK: `user_id -> users.id`
- 컬럼: `notification_type NOTIFICATION_TYPE`,
  `is_enabled BOOLEAN`, `updated_at` NOT NULL
- Unique: `(user_id, notification_type)`
- 설정은 사용자·유형 단위이며 `group_id`는 사용하지 않는다.
- 이 값은 앱 내부 알림 생성 여부가 아니라 푸시 허용 여부다.

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
| `JOIN_REQUEST_STATUS` | `PENDING_ADMIN`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `MEDIA_TYPE` | `IMAGE`, `VIDEO` |
| `REACTION_TYPE` | `HEART`, `LAUGH`, `SURPRISE`, `SAD`, `SUPPORT` |
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
- 게시글·일정·댓글: 위 각 테이블에 명시된 방식으로 하드 삭제한다.
- 푸시 성공·실패 전송 이력은 현재 저장하지 않는다.

## 미결정·충돌

- `daily_reports.guardian_message`는 단일 `TEXT`이지만 API 2차 수정본의 일일
  리포트 성공 결과는 통화별 `guardianMessages` 배열이다. 저장값과 응답 배열의
  매핑 규칙은 확정되지 않았다.
- 리포트 설계의 감정 세부분류 최대 30자와 최신 ERD·API의 최대 50자가
  충돌한다. 구현자는 임의로 하나를 고르지 않는다.
- `notifications`의 관련 일정 등 대상이 삭제될 때 “FK를 NULL 처리”와
  “스냅샷만 유지” 중 정확한 FK 동작은 확정되지 않았다.
- `notification_settings.is_enabled`의 최초 기본값은 확정되지 않았다.
- `openai_item_id`에 Unique를 둘지는 검토 중이다.
- 통화 전사 보존 기간과 삭제 시점은 확정되지 않았다.
- 그룹 API의 `managerMemberId`는 `family_groups` 컬럼이 아니다.
  `group_members.is_manager`에서 응답을 구성하는 정확한 규칙은 확정되지 않았다.
- 일반 업무 테이블의 Spring Boot API 실행 책임은 확정되어 있으나, 최신 ERD는
  각 테이블의 물리적 쓰기 소유자를 별도 속성으로 선언하지 않았다.
