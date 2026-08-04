# 데이터 모델 계약

> 상태: 일부 확정
> 기준: 2026-07-31 최신 확정 ERD와 승인된 도메인 이벤트 알림 계약 기준·관계·테이블·제약 문서
> 데이터베이스: PostgreSQL

이 문서는 현재 사용하는 22개 테이블과 컬럼·Enum·제약의 로컬 계약이다.
모든 시각 컬럼은 별도 언급이 없으면
`TIMESTAMPTZ`이고 UTC 절대 시각으로 저장한다. API timestamp와 서버 로그도
UTC를 사용한다. 사용자 화면, 상대 날짜 해석, 일정 알림과 매일 22시 리포트
스케줄 같은 비즈니스 규칙에만 `Asia/Seoul`을 적용한다.

## 소유권

| 테이블 | 실행·쓰기 경계 |
|---|---|
| `users`, `family_groups`, `group_members`, `group_join_requests`, `member_aliases`, `member_interests`, `posts`, `post_media`, `comments`, `post_reactions`, `post_analyses`, `calendar_events`, `event_participants`, `call_sessions`, `call_transcript_events`, `call_transcripts`, `call_report_generation_requests`, `call_reports`, `daily_reports`, `daily_report_generation_claims`, `carnations`, `notifications`, `notification_settings`, `device_tokens` | Spring Boot가 공개 API, 내부 AI 오케스트레이션과 모든 DB 읽기·쓰기를 소유한다. |

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
  `summary VARCHAR(500) NULL`, `analyzed_at NULL`,
  `attempt_count INTEGER` NOT NULL DEFAULT `0`, `next_attempt_at TIMESTAMPTZ NULL`,
  `last_failure_code VARCHAR(50) NULL`, `last_failed_at TIMESTAMPTZ NULL`,
  `input_updated_at TIMESTAMPTZ NULL`, `claim_token UUID NULL`,
  `claim_expires_at TIMESTAMPTZ NULL`,
  `created_at` NOT NULL
- 상태는 `PENDING`, `SUCCESS`, `FAILED`다.
- `PENDING`: `summary=NULL`, `analyzed_at=NULL`
- `SUCCESS`: 요약과 완료 시각을 저장한다.
- `FAILED`: `summary=NULL`, `analyzed_at=NULL`. 재시도 가능한 실패는
  `next_attempt_at`을 가지며, 영구 실패 또는 총 3회 도달 시 `NULL`이다.
- claim을 획득할 때 `attempt_count`를 증가시키고 90초 뒤의
  `claim_expires_at`, 대상 게시글의 `input_updated_at`, 임의 `claim_token`을
  저장한다. 완료·실패 저장은 같은 token과 게시글 버전을 가진 실행만
  허용하고 claim 필드를 비운다.
- 마지막 실패 분류와 시각은 `last_failure_code`, `last_failed_at`에 보존한다.
- 재분석할 때 새 행을 추가하지 않고 게시글의 기존 한 행을 `PENDING`으로
  갱신한다.
- 게시글을 하드 삭제하면 미디어·댓글·반응·분석도 함께 정리한다.

## 공유 일정

### `calendar_events`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `creator_member_id -> group_members.id`,
  `last_editor_member_id -> group_members.id`
- 컬럼: `title VARCHAR(20)`, `event_date DATE`, `end_date DATE`, `created_at`,
  `updated_at`, `reminder_schedule_updated_at TIMESTAMPTZ` NOT NULL;
  `participants_specified BOOLEAN` NOT NULL;
  `description VARCHAR(50) NULL`,
  `start_at TIMESTAMPTZ NULL`, `end_at TIMESTAMPTZ NULL`
- `reminder_schedule_updated_at`은 일정 등록 시각 또는 날짜·시각 쌍을 마지막으로
  바꾼 시각이다. 제목·설명·참여자만 바꿀 때는 갱신하지 않으며, 이미 지난
  일정 시작 알림을 즉시 보내지 않을 때 사용한다.
- 날짜 쌍: `event_date`는 시작 날짜, `end_date`는 종료 날짜이며 날짜 일정과
  시간 일정 모두 항상 채운다. 하루짜리 일정은 두 값이 같다. 특정 날짜와
  겹치는 일정은 `event_date <= :date AND end_date >= :date`로 조회한다.
- 날짜 쌍 CHECK: `end_date >= event_date`이다.
- 시간 쌍 CHECK:
  - 날짜 일정은 `start_at`, `end_at`이 모두 NULL이다.
  - 시간 일정은 두 값이 모두 존재하고 `end_at >= start_at`이다.
- 날짜 쌍과 시각 쌍의 정합성은 CHECK로 강제하지 않는다. `AT TIME ZONE`이
  `STABLE` 함수라 CHECK 제약과 생성 컬럼에서 거부되므로, 시간 일정의
  `event_date`·`end_date`를 서버가 `start_at`·`end_at`의 `Asia/Seoul`
  날짜로 파생하는 단일 경로로 보장한다.
- 삭제는 하드 삭제이며 참여자를 함께 정리한다.
- `participants_specified`는 사용자가 참여자를 명시적으로 지정한 일정인지
  나타낸다. 지정 참여자가 모두 이탈해 연결 행이 0개가 되어도 true를
  유지하며, 사용자가 일정 편집에서 참여자를 모두 해제할 때 false가 된다.

### `event_participants`

- PK: `id BIGINT`
- FK: `event_id -> calendar_events.id`,
  `group_member_id -> group_members.id`
- Unique: `(event_id, group_member_id)`
- Index: `(group_member_id)` — 멤버십 이탈 시 모든 일정 참여자 연결을
  범위 제한해 삭제하는 데 사용한다.
- 그룹 나가기·관리자 내보내기·회원 탈퇴 시 해당 멤버십을 참조하는 행을
  같은 트랜잭션에서 삭제한다. 재가입은 삭제된 행을 복원하지 않는다.
- 일정 알림은 `notifications`에 저장한다.

## AI 통화·리포트

### `call_sessions`

- PK: `id BIGINT`
- FK: `group_id -> family_groups.id`,
  `care_receiver_member_id -> group_members.id`
- 컬럼: `persona_id BIGINT`, `status CALL_STATUS`,
  `transcript_integrity_status TRANSCRIPT_INTEGRITY_STATUS`,
  `transcript_revision BIGINT`, `created_at` NOT NULL; `started_at NULL`,
  `ended_at NULL`, `lease_expires_at TIMESTAMPTZ NULL`,
  `transcript_finalized_at TIMESTAMPTZ NULL`
- 시간 의미:
  - `created_at`: Spring Boot가 통화 시작 요청을 접수한 시각
  - `started_at`: WebRTC 연결 성공 결과를 받은 시각
  - `ended_at`: 종료·취소·실패 처리를 완료한 시각
  - `lease_expires_at`: `CONNECTING`·`IN_PROGRESS` 세션의 활성 lease 만료
    시각. 살아 있는 Sideband 세션은 30초마다 90초 lease로 갱신하며 종결
    상태에서는 `NULL`이다.
- stale 복구: lease가 없거나 만료된 활성 행은 잠금 후 `CONNECTING ->
  FAILED`, `IN_PROGRESS -> INCOMPLETE`로 원자 전환하고 `ended_at`을 기록한다.
- 전사 무결성은 통화 상태와 분리한다. 신규 세션은 `COLLECTING`, 전사 원장의
  모든 항목이 반영되고 drain이 끝난 세션만 `COMPLETE`, 누락·불일치·최종
	실패가 있는 세션은 `RECONCILIATION_REQUIRED`다. 최초 `RESERVED`, 새
	`READY` payload·이상 상태, `APPLIED`처럼 입력 또는 저장 완결성이 실제로
	바뀌는 트랜잭션마다 `transcript_revision`을 증가시킨다. 정상 drain이면
	`transcript_finalized_at`을 기록하고 미해결 원장이 모두 `APPLIED`가 된 뒤
	`COMPLETE`로 승격한다. drain 실패 시 finalization 시각은 `NULL`로 유지한다.

### `call_transcript_events`

- PK: `id BIGINT`
- FK·삭제: `call_session_id -> call_sessions.id ON DELETE CASCADE`
- 컬럼: `openai_item_id VARCHAR(100)`, `speaker SPEAKER_TYPE`, `sequence INT`,
  `status TRANSCRIPT_INGEST_STATUS`, `attempt_count INT`, `content TEXT NULL`,
  `content_hash VARCHAR(64)`, `next_attempt_at TIMESTAMPTZ NULL`,
  `claim_token UUID NULL`, `claim_expires_at TIMESTAMPTZ NULL`,
  `failure_code VARCHAR(80) NULL`, `created_at`, `updated_at`, `ready_at NULL`,
  `applied_at NULL`
- Unique: `(call_session_id, openai_item_id)`, `(call_session_id, sequence)`
- 상태: 유효 item을 먼저 `RESERVED`, 완료 payload·해시를 별도 커밋하면
  `READY`, 전사 반영을 마치면 `APPLIED`, provider 실패·불일치·최대 시도
  초과는 `FAILED`다. 동일 item의 화자·순번·해시가 같을 때만 no-op이다.
- materialization은 세션 행 뒤 원장 행 순서로 잠그고, live handler와 복구
  작업이 같은 경로를 사용한다. 복구 claim은 `FOR UPDATE SKIP LOCKED`, batch
  20, 최대 3회와 1분·2분 backoff를 사용한다.
- `APPLIED` 또는 최대 시도 초과 시 `content`를 즉시 지우고 해시와 진단
  메타데이터만 남긴다. 24시간이 지난 non-APPLIED payload cleanup은 매시간
  batch 100으로 실행한다. 이 payload는 공개 API·로그에 노출하지 않는다.

### `call_transcripts`

- PK: `id BIGINT`
- FK: `call_session_id -> call_sessions.id`
- 컬럼: `speaker SPEAKER_TYPE`, `content TEXT`, `sequence INT`,
  `created_at` NOT NULL; `openai_item_id VARCHAR(100) NULL`
- Unique: `(call_session_id, sequence)`
- Unique: `(call_session_id, openai_item_id)` where `openai_item_id IS NOT NULL`
- Index: `(call_session_id, sequence)`
- 사용자와 AI의 전사 완료 이벤트를 발화 단위로 저장한다. 실시간 `delta`는
  자막에 쓸 수 있지만 영구 저장 기준이 아니다.
- item ID Unique는 세션 범위이며 전역 Unique가 아니다.

### `call_reports`

- PK: `id BIGINT`
- FK·Unique: `call_session_id -> call_sessions.id`
- 컬럼: `summary VARCHAR(100)`, `emotion_category EMOTION_CATEGORY`,
  `emotion_subcategory VARCHAR(50)`, `created_at` NOT NULL;
  `guardian_message VARCHAR(100) NULL`
- DB 쓰기 gate: 참조 세션의 전사 무결성이 `COMPLETE`,
  `transcript_finalized_at IS NOT NULL`이고 미해결 전사 원장이 없을 때만
  insert/update를 허용한다. 애플리케이션 target·결과 저장 검사와 별도로
  강제해 롤링 배포 중 이전 버전의 우회를 막는다.

### `call_report_generation_requests`

- PK·FK·삭제: `call_session_id -> call_sessions.id ON DELETE CASCADE`
- 컬럼: `status CALL_REPORT_GENERATION_STATUS`, `input_revision BIGINT`,
  `claim_token UUID NULL`, `claim_expires_at TIMESTAMPTZ NULL`,
  `last_failure_code VARCHAR(50) NULL`, `last_failed_at TIMESTAMPTZ NULL`,
  `created_at`, `updated_at`
- 세션마다 한 행만 존재한다. finalization 트랜잭션이 무결성 `COMPLETE`
  세션에만 없는 행을 `PENDING`으로 만들며 기존 `PENDING`은 유지하고
  `GEMINI_FAILED`·`DONE`은 되돌리지 않는다.
- worker는 90초 `CLAIMED` 소유권과 입력 revision을 획득하고 외부 호출 뒤
  같은 token·revision과 최신 무결성을 재검사한다. 성공은 `DONE`, 명시적
  Gemini 실패는 `GEMINI_FAILED`다. 1분 주기 batch 20 복구는 `PENDING`과
  만료 `CLAIMED`만 다시 접수한다.

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

### `daily_report_generation_claims`

- PK: `id BIGINT`
- FK·삭제: `care_receiver_member_id -> group_members.id ON DELETE CASCADE`
- 컬럼: `report_date DATE`, `claim_token UUID`, `claim_expires_at TIMESTAMPTZ`,
  `input_report_count INTEGER`, `input_latest_report_id BIGINT`, `created_at` NOT NULL
- Unique: `(care_receiver_member_id, report_date)`
- Gemini 호출 전에 90초 lease와 입력 건별 리포트의 개수·최대 ID를 저장하고,
  성공 리포트를 저장할 때 실행이 들고 있는 token·입력 개수·최대 ID가 claim
  행과 현재 입력에 모두 일치해야 한다. 현재 입력이 달라지면 오래된 결과를
  저장하지 않는다. claim 소유 실행만 기존 token·입력 버전을 조건으로 행의
  입력 버전·lease를 최신 값으로 원자 갱신하고 다시 생성하며, 다른 실행은
  활성 claim을 변경하지 않는다.
  만료 claim은 1분 주기 정리 후 새 실행이 다시 획득할 수 있으며, 이 테이블
  자체는 성공 리포트나 자동 재시도 이력이 아니다.

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
  `source_event_key VARCHAR(160) NULL`,
  `reminder_slot NULL` (`DAY_BEFORE` | `HOUR_BEFORE`,
  `EVENT_REMINDER` 알림에만 사용하고 그 외에는 NULL)
- 일정 시작 외 도메인 이벤트 알림 중복 방지 부분 Unique:
  `(receiver_user_id, source_event_key)
  WHERE source_event_key IS NOT NULL`
- `source_event_key`는
  `<도메인>:<원본 ID>:<행위>[:<변경 UUID>]` 형식이다. 같은 도메인
  이벤트를 여러 수신자에게 처리하거나 다시 처리할 때 처음 정한 키를
  재사용한다. 가입 요청·게시글·댓글·반응·리포트 생성과 가입 요청 결정은
  원본 ID와 행위로 고정하고, 일정 수정·삭제는 이벤트 생성 때 한 번 만든
  UUID를 함께 사용한다.
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
- 같은 `token` 문자열은 시스템 전체에서 한 행만 가지며, 활성 행은 동시에
  한 사용자만 소유한다.
- 등록은 Unique 제약과 행 잠금 또는 동등한 원자적 upsert로 처리한다. 같은
  사용자의 재등록·재활성화와 다른 사용자로의 소유권 이전 모두 기존 `id`를
  유지하고 `user_id`, `device_type`, `is_active`, `updated_at`을 현재
  등록 결과에 맞게 갱신한다.
- MVP의 `device_type` 값은 `ANDROID`다. 토큰 해제는 행 삭제가 아니라
  `is_active=false` 전환이다.

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
| `TRANSCRIPT_INTEGRITY_STATUS` | `COLLECTING`, `COMPLETE`, `RECONCILIATION_REQUIRED` |
| `TRANSCRIPT_INGEST_STATUS` | `RESERVED`, `READY`, `APPLIED`, `FAILED` |
| `CALL_REPORT_GENERATION_STATUS` | `PENDING`, `CLAIMED`, `GEMINI_FAILED`, `DONE` |
| `SPEAKER_TYPE` | `USER`, `ASSISTANT` |
| `EMOTION_CATEGORY` | `ANGER`, `SADNESS`, `ANXIETY`, `HURT`, `EMBARRASSMENT`, `JOY`, `NEUTRAL` |

`user_status`, `group_member_status`, `reminder_status`는 제거된 Enum이다.

## 공통 삭제·보존 규칙

- 회원 탈퇴: 개인정보를 익명화하고 `withdrawn_at`을 기록하며 같은
  트랜잭션에서 사용자의 모든 `device_tokens`를 비활성화한다. 게시글·댓글·
  일정과 과거 그룹 관계는 보존하되 종료되는 멤버십의
  `event_participants`는 삭제한다.
- 그룹 나가기·내보내기: `group_members.left_at`을 기록하고 해당 멤버십의
  `event_participants`를 같은 트랜잭션에서 삭제한다.
- 그룹 삭제: 관리자이면서 다른 활성 구성원이 없을 때만 하드 삭제할 수 있다.
  Spring Boot는 한 트랜잭션에서 `member_interests`, `member_aliases`, `posts`,
  `calendar_events`, `call_sessions`, `daily_reports`, `carnations`,
  `group_join_requests`, `group_members`, `family_groups` 순서로 명시적으로
  삭제한다. `post_media`, `comments`, `post_reactions`, `post_analyses`,
  `event_participants`, `call_transcript_events`, `call_transcripts`,
  `call_report_generation_requests`, `call_reports`,
  `daily_report_generation_claims`는 기존 FK의
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

- 통화 전사 보존 기간과 삭제 시점은 확정되지 않았다.
