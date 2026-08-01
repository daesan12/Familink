# 2-유저 에뮬레이터 QA 시나리오

Jira: [S15P11B104-222] · 작성일 2026-08-02 · 상태: 실행 전

에뮬레이터 2대로 로컬 환경에서 전 도메인을 검증하고, 기능 실행마다 PostgreSQL·Redis를 직접 조회해 데이터 정합성을 확인한다. 목적은 출시 전 기획·사용 흐름상의 문제점과 엣지 케이스를 도출하는 것이다.

## 1. 환경 전제

| 항목 | 값 |
|---|---|
| User1 | emulator-5554, 계정 `testuser`(users.id=2), **보호자(GUARDIAN)·그룹 관리자** |
| User2 | emulator-5556, QA 중 신규 가입, **피보호자(CARE_RECEIVER)** |
| 백엔드 | `local` 프로필 `.\gradlew.bat bootRun`, `http://localhost:8080` (에뮬레이터에서 `http://10.0.2.2:8080`) |
| 인프라 | `docker compose --env-file .env -f compose.local.yml up -d` (PostgreSQL 16, Redis) |
| Metro | 1개(8081) 공용, 기기별 `adb -s <serial> reverse tcp:8081 tcp:8081` |

### 선행 조건 (완료 후 QA 시작)

1. **[S15P11B104-214]** 운영 JWT actor resolver 구현 — 미구현이면 AI 통화 API가 무조건 401이라 Phase 5·6이 전부 Blocked.
2. **[S15P11B104-223]** `backend/.env`에 `GMS_API_KEY` 추가(리포트·게시글 분석). AWS 자격증명은 미디어 QA를 할 때만.
3. 백엔드 재기동(위 두 변경 반영).

### 검증 명령

```bash
# 화면 상태
android layout --device emulator-5554   # 또는 5556
# DB (자격증명은 컨테이너 env 참조 — 값을 출력하지 않는다)
docker exec s15p11b104-local-postgres-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "<SQL>"'
# Redis
docker exec s15p11b104-local-redis-1 sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning <cmd>'
```

## 2. 판정 규칙

- 판정: **Pass** / **Fail** / **Blocked**(선행 조건·환경 문제로 실행 불가) / **N/A**(범위 제외)
- 결함 등급: **P0** 크래시·데이터 유실·보안 / **P1** 핵심 흐름 차단 / **P2** 우회 가능한 기능 결함 / **P3** UX·문구·사소한 표시 문제
- 스펙의 `미결정 사항`과 `docs/spec-changes/pending/`의 미승인 제안(11건) 영역은 **Fail로 판정하지 않고 관찰(Obs)로 기록**한다.
- 오류 `message` 문구로 판정하지 않는다 — HTTP 상태와 `code`만 기준(API.md 공통 경계).

## 3. 시나리오

### Phase 1. 계정·온보딩 (User2)

| ID | 시나리오 | 기대 결과 | 판정 |
|---|---|---|---|
| P1-01 | loginId 4자 / 16자 / 한글 / 특수문자 입력 | 클라이언트 검증 실패 또는 400 INVALID_REQUEST | |
| P1-02 | loginId `testuser` 중복 가입 | 중복 거부 | |
| P1-03 | loginId 대소문자 구분 — `Testuser`는 신규로 허용 | 스펙상 대소문자 구분·정규화 없음 | |
| P1-04 | 비밀번호 숫자만 / 영문만 / 7자 / 17자 | 거부 (8~16자, 영문+숫자 각 1자 이상) | |
| P1-05 | 이름 1자 / 11자 | 거부 (2~10자) | |
| P1-06 | 비밀번호 확인 불일치 | 클라이언트에서 차단 (API 미전송) | |
| P1-07 | 정상 가입 → 로그인 | 그룹 없음 안내(A-10) 진입, 프로필 사진 건너뛰기 가능 | |

DB/Redis 검증:
```sql
SELECT id, login_id, name, birth_date, gender, left(password_hash,7) AS hash_prefix FROM users ORDER BY id;
-- hash_prefix가 $2a$/$2b$(bcrypt)인지, 평문이 아닌지
```
```
TTL refresh:<User2 id>   -- ≈ 1209600 (14일)
```

### Phase 2. 그룹 생성·가입·승인 (2인 핵심 흐름)

| ID | 시나리오 | 기대 결과 | 판정 |
|---|---|---|---|
| P2-01 | User1 그룹 생성(역할 GUARDIAN 선택), 그룹명 10자 경계 | 201, 생성자가 관리자. 11자는 거부 | |
| P2-02 | 초대 코드 확인 | 6자 코드 표시 | |
| P2-03 | User2 잘못된 코드 입력 | 400 INVITE_CODE_INVALID 오류 표시 | |
| P2-04 | User2 정상 코드 → 가입 신청 | PENDING, 대기 카드 표시 | |
| P2-05 | User2 같은 그룹 재신청 | 409 JOIN_REQUEST_ALREADY_EXISTS | |
| P2-06 | User1 인앱 알림 확인 | GROUP_JOIN_REQUEST 알림 수신 | |
| P2-07 | User1 승인(역할 CARE_RECEIVER 지정) | 200, User2에 승인 알림 | |
| P2-08 | 역할별 하단 탭 | User2: 피드/캘린더/**AI전화**/그룹정보/프로필, User1: 피드/캘린더/**일일리포트**/그룹정보/프로필 | |
| P2-09 | User2 관심사 설정(0~10개, 전체 교체) | 저장은 피보호자 본인만, 보호자는 조회만 | |
| P2-10 | User1이 User2에게 호칭 설정 | 설정자(User1) 화면에만 반영, User2 화면은 실제 이름 | |

DB 검증:
```sql
SELECT id, name, length(invite_code) AS code_len FROM family_groups;
SELECT id, group_id, user_id, role, is_manager, joined_at, left_at FROM group_members;
SELECT id, status, assigned_role, processed_at FROM group_join_requests;
SELECT receiver_user_id, type, title, source_event_key, read_at FROM notifications ORDER BY id;
SELECT * FROM member_interests; SELECT * FROM member_aliases;
```

### Phase 3. 피드·반응·댓글·카네이션

| ID | 시나리오 | 기대 결과 | 판정 |
|---|---|---|---|
| P3-01 | User1 텍스트 게시글 140자 / 141자 | 140자 허용, 141자 거부 | |
| P3-02 | User2 피드 반영 + NEW_POST 알림 | 작성자(User1) 본인에게는 알림 없음 | |
| P3-03 | User2 댓글 작성 → User1 POST_ACTIVITY 알림 | 게시글 작성자에게만, 대댓글 없음 | |
| P3-04 | User2 반응 HEART → LAUGH → LAUGH | 교체 → 해제 (1인 1반응) | |
| P3-05 | 타인 게시글 수정·삭제 진입점 | 상세(D-3)의 본인 글에만 `···` 노출 | |
| P3-06 | User1 게시글 작성일 카네이션 적립 | 1일 1개(같은 날 2번째 글 미적립) | |
| P3-07 | User2(피보호자) 게시글 작성 | 카네이션 미적립 | |
| P3-08 | 주간 랭킹 화면 | 월요일 시작 주, 카네이션 수 표시 | |
| P3-09 | 보관함 date/type/memberId 필터 | AND 적용, 타 그룹 memberId는 400 | |
| P3-10 | 사진 첨부 게시글 (AWS 키 있을 때만) | presigned 발급→PUT→게시. 키 없으면 오류 UX 관찰(크래시·무한로딩이면 결함) | |
| P3-11 | 게시글 분석 (GMS 키) | 생성 ~10분 후 post_analyses SUCCESS·summary(≤500자). 화면 노출은 미결정 → DB만 | |

DB 검증:
```sql
SELECT id, author_member_id, length(content) AS len, media_type FROM posts ORDER BY id;
SELECT post_id, member_id, reaction_type FROM post_reactions;
SELECT member_id, earned_date FROM carnations;
SELECT post_id, status, left(summary,50) FROM post_analyses;
```

### Phase 4. 캘린더·알림

| ID | 시나리오 | 기대 결과 | 판정 |
|---|---|---|---|
| P4-01 | 하루종일 일정 생성/수정/삭제 | startAt/endAt 없음, eventDate·endDate 쌍 | |
| P4-02 | 시간 일정 기본값 | 현재 정시~+1시간. 23시대에는 23:00~23:59 제한 | |
| P4-03 | 여러 날 일정 | endDate > eventDate 허용, 구간 겹침 조회 | |
| P4-04 | User1 생성(참여자 User2) → EVENT_CHANGED | User2만 수신(행위자 제외) | |
| P4-05 | User2 일정 수정 → 참여자 합집합 알림 | 수정 전·후 참여자 합집합, 행위자 제외 | |
| P4-06 | User2 작성 일정을 User1(관리자)이 수정·삭제 | 허용 (작성자 또는 관리자) | |
| P4-07 | 시작 알림(EVENT_REMINDER) | 전날 09:00 / 1시간 전 스케줄 — 세션 내 즉시 검증 불가, N/A 처리 | N/A |

DB 검증:
```sql
SELECT id, title, event_date, end_date, start_at, end_at FROM calendar_events;  -- UTC 저장 확인
SELECT * FROM event_participants;
SELECT receiver_user_id, type, title FROM notifications WHERE type LIKE 'EVENT%';
```

### Phase 5. AI 통화 (피보호자 User2 · 사용자 육성 발화 필요)

전제: 214 구현 반영, 에뮬레이터 마이크=호스트 오디오 입력. AI는 먼저 말을 걸지 않으므로(server VAD) 연결 후 사용자가 발화해야 대화가 시작된다.

| ID | 시나리오 | 기대 결과 | 판정 |
|---|---|---|---|
| P5-01 | User2 페르소나 선택 → 발신 | 201 생성, CONNECTING→IN_PROGRESS(started_at) | |
| P5-02 | 발화("요즘 가족들 소식 뭐 있어?") | AI 자막 표시, Tool Calling으로 게시글 요약 응답 | |
| P5-03 | 음소거 토글 | 트랙만 비활성, 연결 유지 | |
| P5-04 | 통화 중 재발신(또는 curl 중복 생성) | 409 ACTIVE_CALL_EXISTS | |
| P5-05 | 정상 종료 | COMPLETED, ended_at. 종료 재요청도 202(멱등, 최초 상태 보존) | |
| P5-06 | 통화 후 리포트 | call_transcripts(USER/ASSISTANT), call_reports 생성(Gemini), User1에 CALL_REPORT 알림 | |
| P5-07 | RECORD_AUDIO 권한 거부 | 즉시 FAILED, 서버 세션 미생성 | |
| P5-08 | 통화 중 네트워크 차단(비행기 모드) | INCOMPLETE 또는 FAILED 정리 | |
| P5-09 | 무음 통화 후 종료 | COMPLETED이나 transcript 0건 → 리포트 미생성 | |
| P5-10 | **User1(보호자)로 통화 시도** | 403 FORBIDDEN (역할 위반 — 214 검증) | |
| P5-11 | 일정 조회 Tool(`get_calendar_events_by_date`) | 미구현([S15P11B104-211]) — N/A, 스펙-코드 불일치 기록 | N/A |

DB 검증:
```sql
SELECT id, care_receiver_member_id, persona_id, status, started_at, ended_at FROM call_sessions ORDER BY id;
SELECT call_session_id, sequence, speaker_type, left(content,40) FROM call_transcripts ORDER BY call_session_id, sequence;
SELECT call_session_id, emotion_category, emotion_subcategory, left(summary,50), guardian_message FROM call_reports;
```

### Phase 6. 리포트 (보호자 User1)

| ID | 시나리오 | 기대 결과 | 판정 |
|---|---|---|---|
| P6-01 | 일일 리포트 탭 — 건별 리포트 표시 | 당일 건별 목록 시간순, 요약 ≤100자 | |
| P6-02 | guardian_message가 null인 리포트 | 보호자 메시지 영역 전체 비표시 | |
| P6-03 | 일일 리포트 | KST 22:00 스케줄 — 22시 이전엔 미생성이 정상. 빈 상태 UI 확인, 필요 시 22시 후 재확인 또는 SQL 시드로 표시 검증 | |
| P6-04 | 리포트 달력 | reportDates·latestReportDate 표시 | |

### Phase 7. 그룹 관리·파괴적 시나리오 (맨 마지막)

가상 유저3은 에뮬레이터 없이 curl로 수행(회원가입→로그인→가입 신청).

| ID | 시나리오 | 기대 결과 | 판정 |
|---|---|---|---|
| P7-01 | 관리자(User1) 그룹 이탈 시도 | 409 MANAGER_TRANSFER_REQUIRED | |
| P7-02 | 관리자 자기 자신 내보내기 | 409 CANNOT_REMOVE_SELF | |
| P7-03 | User1 두 번째 그룹 생성 → User2 가입·승인 시도 | 409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP | |
| P7-04 | 보호자(User1) 다중 그룹·그룹 전환 토글 | 허용, 좌상단 토글로 전환 | |
| P7-05 | 유저3(보호자) 가입 → 관리자 위임 → 내보내기 | is_manager 단일 제약 유지 | |
| P7-06 | 유저3 회원 탈퇴 | users 익명화(NULL)·withdrawn_at 기록, device_tokens 비활성. 작성물 보존 | |
| P7-07 | 관리자 상태에서 탈퇴 시도 | 409 MANAGER_TRANSFER_REQUIRED | |

DB 검증:
```sql
SELECT id, login_id, name, withdrawn_at FROM users;   -- 탈퇴자 익명화 확인
SELECT group_id, user_id, role, is_manager, left_at FROM group_members ORDER BY group_id, id;
```

## 4. 범위 제외와 근거

| 항목 | 근거 |
|---|---|
| OS 푸시 배너 | 서버 `PUSH_ENABLED` 기본 false, Firebase 서비스 계정 키 없음 → 인앱 알림 목록으로 대체 검증 |
| EVENT_REMINDER 실수신 | 전날 09:00·1시간 전 고정 스케줄 — 세션 내 재현 불가 |
| 일정 조회 Tool | 미구현 ([S15P11B104-211]) |
| INCOMPLETE 통화 리포트 생성 | 스펙에 있으나 미구현 — 스펙-코드 불일치로 기록 |
| 첫 사용 온보딩, 오류 문구, 감정 표시명 등 | 스펙 `미결정 사항` |
| 영상 업로드 상세(코덱·재생시간) | 미승인 변경 제안(CHG-20260730) 영역 |

## 5. 발견 사항 기록

> 실행 중 아래 표에 추가한다. 재현 절차는 별도 섹션으로.

| # | 등급 | Phase | 요약 | 상태 |
|---|---|---|---|---|
| F-1 | P1 | 사전 | 세션 복원 retryableError 시 백지 화면 (재시도 UI 부재) | [S15P11B104-224] 등록 |
| F-2 | P1 | 사전 | AI 통화 운영 인증 경로 미구현 — UnavailableCallActorResolver 401 하드코딩 | [S15P11B104-214] 재오픈 |
| F-3 | Obs | 사전 | AI_CALL_README가 "임시 Web UI"라 기술하나 실제로는 Kotlin 모듈 완성 — 문서 최신성 | 미등록 |
| F-4 | Obs | 사전 | 401 응답 봉투 이원화 (Security 공통 봉투 vs call 도메인 `{"error":{...}}`) | 미등록 |
