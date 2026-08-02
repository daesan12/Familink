# 2-유저 에뮬레이터 QA 시나리오

Jira: [S15P11B104-222] · 작성일 2026-08-02 · 상태: 실행 완료 (2026-08-02, Phase 1~6)

실행 결과: User1=`testuser`(id=2, GUARDIAN·관리자), User2=`user2qa`(id=4, CARE_RECEIVER, 1960-05-01생/FEMALE). Phase 1~6 전 항목 실행(일부 미실행·N/A 표시). Phase 7은 이번 세션에서 미실행 — 필요 시 별도 세션에서 이어서 진행.

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
| P1-01 | loginId 4자 / 16자 / 한글 / 특수문자 입력 | 클라이언트 검증 실패 또는 400 INVALID_REQUEST | 부분 Pass — 4자는 다음 비활성으로 확인. 한글/특수문자·16자는 adb 텍스트 입력 제약으로 미실행 |
| P1-02 | loginId `testuser` 중복 가입 | 중복 거부 | Pass — "사용이 불가능한 아이디입니다" |
| P1-03 | loginId 대소문자 구분 — `Testuser`는 신규로 허용 | 스펙상 대소문자 구분·정규화 없음 | Pass — "사용 가능한 아이디입니다" |
| P1-04 | 비밀번호 숫자만 / 영문만 / 7자 / 17자 | 거부 (8~16자, 영문+숫자 각 1자 이상) | Pass — 숫자만/영문만 8자 모두 "다음" 비활성. 단 위반 이유 미안내(F-6) |
| P1-05 | 이름 1자 / 11자 | 거부 (2~10자) | Pass — 1자 시 "다음" 비활성, 인라인 오류 문구 없음 |
| P1-06 | 비밀번호 확인 불일치 | 클라이언트에서 차단 (API 미전송) | Pass — "비밀번호가 일치하지 않습니다" 빨간 인라인 오류 |
| P1-07 | 정상 가입 → 로그인 | 그룹 없음 안내(A-10) 진입, 프로필 사진 건너뛰기 가능 | Pass — users 행 생성(bcrypt), 로그인 후 refresh 토큰 TTL 정상, 알림 권한 허용 시 device_tokens 등록, A-10 도착 |

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
| P2-01 | User1 그룹 생성(역할 GUARDIAN 선택), 그룹명 10자 경계 | 201, 생성자가 관리자. 11자는 거부 | Pass — 11자 입력 시 클라이언트가 10자로 컷, GUARDIAN·is_manager=true 자동 부여 |
| P2-02 | 초대 코드 확인 | 6자 코드 표시 | Pass — invite_code 6자(`3E37GA`), 그룹정보>그룹 코드 메뉴로 재확인 가능 |
| P2-03 | User2 잘못된 코드 입력 | 400 INVITE_CODE_INVALID 오류 표시 | Pass — "초대 코드를 확인하고 다시 시도해주세요." |
| P2-04 | User2 정상 코드 → 가입 신청 | PENDING, 대기 카드 표시 | Pass — PENDING_ADMIN, B-3에 대기 카드, 관리자에게 GROUP_JOIN_REQUEST 알림(source_event_key로 멱등 확인) |
| P2-05 | User2 같은 그룹 재신청 | 409 JOIN_REQUEST_ALREADY_EXISTS | 부분 Pass — 서버가 중복 차단(요청 1건 유지)했으나 오류 문구가 잘못된 코드(400)와 동일해 사용자는 원인을 구분 못함(F-10) |
| P2-06 | User1 인앱 알림 확인 | GROUP_JOIN_REQUEST 알림 수신 | Pass — 알림 목록에 요청 표시, 인라인 승인/거부 버튼 노출 |
| P2-07 | User1 승인(역할 CARE_RECEIVER 지정) | 200, User2에 승인 알림 | Pass(정식 경로: 그룹정보>가입 승인 대기) — APPROVED·멤버십 생성·승인 알림 확인. **알림 화면의 인라인 승인/거부는 결함(F-11, F-12)이라 정식 경로로 우회** |
| P2-08 | 역할별 하단 탭 | User2: 피드/캘린더/**AI전화**/그룹정보/프로필, User1: 피드/캘린더/**일일리포트**/그룹정보/프로필 | Pass — 승인 후 앱 재시작 시 양쪽 모두 스펙대로 반영 |
| P2-09 | User2 관심사 설정(0~10개, 전체 교체) | 저장은 피보호자 본인만, 보호자는 조회만 | Pass — 칩 2개 선택 저장 → member_interests 2행. 마이페이지 만 나이(66세) 계산도 정확 |
| P2-10 | User1이 User2에게 호칭 설정 | 설정자(User1) 화면에만 반영, User2 화면은 실제 이름 | Pass — "Mother" 저장 후 User1 화면에만 반영, User2 화면은 "User2" 그대로. 단 편집 UI 결함 있음(F-14) |

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
| P3-01 | User1 텍스트 게시글 140자 / 141자 | 140자 허용, 141자 거부 | Pass — 141자 입력 시 카운터가 140/140에서 컷 |
| P3-02 | User2 피드 반영 + NEW_POST 알림 | 작성자(User1) 본인에게는 알림 없음 | Pass — 최신순 반영, NEW_POST가 작성자 제외하고만 발송(양방향 확인) |
| P3-03 | User2 댓글 작성 → User1 POST_ACTIVITY 알림 | 게시글 작성자에게만, 대댓글 없음 | Pass — 댓글 50자 제한, comments 저장, POST_ACTIVITY가 작성자에게만 |
| P3-04 | User2 반응 HEART → LAUGH → LAUGH | 교체 → 해제 (1인 1반응) | Pass — 5종(사랑해요/웃겨요/놀랐어요/슬퍼요/응원해요) 노출, 교체·해제 모두 DB 일치 |
| P3-05 | 타인 게시글 수정·삭제 진입점 | 상세(D-3)의 본인 글에만 `···` 노출 | Pass — 본인 글 상세에만 "게시글 수정 및 삭제 메뉴" 존재, 타인 글 0건 |
| P3-06 | User1 게시글 작성일 카네이션 적립 | 1일 1개(같은 날 2번째 글 미적립) | Pass — 같은 날 2번째 글 작성 후에도 carnations 1행 유지 |
| P3-07 | User2(피보호자) 게시글 작성 | 카네이션 미적립 | Pass — 피보호자 게시글 작성 후에도 carnations 변화 없음 |
| P3-08 | 주간 랭킹 화면 | 월요일 시작 주, 카네이션 수 표시 | Pass — "2026년 7월 27일 ~ 8월 2일"(월~일) 표기, 1위 표시 |
| P3-09 | 보관함 date/type/memberId 필터 | AND 적용, 타 그룹 memberId는 400 | 부분 Pass — 날짜 그룹핑·구성원 필터 UI 확인. 필터 AND 조합·타 그룹 memberId 400은 데이터 부족으로 미실행 |
| P3-10 | 사진 첨부 게시글 (AWS 키 있을 때만) | presigned 발급→PUT→게시. 키 없으면 오류 UX 관찰(크래시·무한로딩이면 결함) | Blocked — AWS 자격증명 미확보. 키 수령 후 별도 실행 |
| P3-11 | 게시글 분석 (GMS 키) | 생성 ~10분 후 post_analyses SUCCESS·summary(≤500자). 화면 노출은 미결정 → DB만 | Pass — 게시글 3건 모두 SUCCESS, 한국어 요약 생성 확인 |

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
| P4-01 | 하루종일 일정 생성/수정/삭제 | startAt/endAt 없음, eventDate·endDate 쌍 | Pass — start_at/end_at NULL, 삭제 시 "삭제한 일정은 다시 복구할 수 없어요" 확인창 후 삭제 |
| P4-02 | 시간 일정 기본값 | 현재 정시~+1시간. 23시대에는 23:00~23:59 제한 | Pass — 기기가 GMT여도 KST 기준 정시~+1h(02:00~03:00) 적용, UTC 저장(17:00~18:00Z)·KST 파생 날짜 확인. 23시대 경계는 미실행 |
| P4-03 | 여러 날 일정 | endDate > eventDate 허용, 구간 겹침 조회 | 미실행 — 표시 규칙이 미승인 제안(CHG-180) 영역 |
| P4-04 | User1 생성(참여자 User2) → EVENT_CHANGED | User2만 수신(행위자 제외) | Pass — 참여자 지정 시 참여자만, 미지정 시 전원, 행위자 제외 (양방향 확인) |
| P4-05 | User2 일정 수정 → 참여자 합집합 알림 | 수정 전·후 참여자 합집합, 행위자 제외 | 부분 Pass — 수정·삭제 알림의 행위자 제외는 확인. 참여자 합집합 케이스는 미실행 |
| P4-06 | User2 작성 일정을 User1(관리자)이 수정·삭제 | 허용 (작성자 또는 관리자) | Pass — 관리자가 타인 일정 제목 수정 성공, EVENT_CHANGED 알림 발송 |
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
| P5-01 | User2 페르소나 선택 → 발신 | 201 생성, CONNECTING→IN_PROGRESS(started_at) | Pass — '사랑스러운 딸' 선택 후 발신, CONNECTING→IN_PROGRESS 전이·started_at 기록 확인 |
| P5-02 | 발화("요즘 가족들 소식 뭐 있어?") | AI 자막 표시, Tool Calling으로 게시글 요약 응답 | **Pass** — 사용자 육성 발화 9턴 전사. "우리 애가 요즘 SNS에 뭐 올렸는지 아니?"에 AI가 "요청하신 분의 게시글을 확인해볼게요" 후 실제 게시글 2건을 정확히 요약 → Tool Calling 정상 |
| P5-03 | 음소거 토글 | 트랙만 비활성, 연결 유지 | 미실행 |
| P5-04 | 통화 중 재발신(또는 curl 중복 생성) | 409 ACTIVE_CALL_EXISTS | 미실행 |
| P5-05 | 정상 종료 | COMPLETED, ended_at. 종료 재요청도 202(멱등, 최초 상태 보존) | Pass — COMPLETED·ended_at 기록. 종료 멱등(202 반복)은 미실행 |
| P5-06 | 통화 후 리포트 | call_transcripts(USER/ASSISTANT), call_reports 생성(Gemini), User1에 CALL_REPORT 알림 | **Pass** — transcripts 9건(USER/ASSISTANT 교대), call_reports 생성(emotion JOY/즐거움 및 만족, guardian_message 포함), User1에 CALL_REPORT 알림 |
| P5-07 | RECORD_AUDIO 권한 거부 | 즉시 FAILED, 서버 세션 미생성 | 부분 Pass — 권한 미허용 상태의 첫 시도가 FAILED로 정리됨. 단 서버 세션이 생성된 뒤 FAILED 처리되어 "세션 미생성" 기대와는 차이(관찰) |
| P5-08 | 통화 중 네트워크 차단(비행기 모드) | INCOMPLETE 또는 FAILED 정리 | 미실행 |
| P5-09 | 무음 통화 후 종료 | COMPLETED이나 transcript 0건 → 리포트 미생성 | Pass — 무음 통화 세션이 COMPLETED이나 transcript 0건 → call_reports 미생성, 화면에도 "리포트 준비 중" |
| P5-10 | **User1(보호자)로 통화 시도** | 403 FORBIDDEN (역할 위반 — 214 검증) | Pass(사전 검증) — 그룹 없는 사용자 JWT로 `POST /call-sessions` 호출 시 403 FORBIDDEN 확인(214 스모크). 앱 UI 경로는 보호자에게 AI 전화 탭 자체가 없어 미실행 |
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
| P6-01 | 일일 리포트 탭 — 건별 리포트 표시 | 당일 건별 목록 시간순, 요약 ≤100자 | Pass — "오늘의 통화" 목록에 두 통화가 시간순 표시, 상세 팝업의 통화 내용·전달하신 말씀이 DB summary·guardian_message와 정확히 일치 |
| P6-02 | guardian_message가 null인 리포트 | 보호자 메시지 영역 전체 비표시 | Pass(대체 확인) — 리포트 자체가 없는 무음 통화는 "리포트 준비 중"으로 열람 불가 처리. guardian_message만 null인 케이스는 데이터 부재로 미실행 |
| P6-03 | 일일 리포트 | KST 22:00 스케줄 — 22시 이전엔 미생성이 정상. 빈 상태 UI 확인, 필요 시 22시 후 재확인 또는 SQL 시드로 표시 검증 | Pass — "아직 일간 리포트가 생성되지 않았어요 / 오늘의 통화가 모이면 일간 리포트로 정리해드려요" 빈 상태 정상 |
| P6-04 | 리포트 달력 | reportDates·latestReportDate 표시 | 미실행 — 달력 아이콘 진입 미수행 |

### Phase 7. 그룹 관리·파괴적 시나리오 (맨 마지막)

> 이번 세션 미실행. 아래 항목은 다음 QA 세션에서 진행한다. 현재 데이터(Family1, User1 관리자, User2 피보호자)를 그대로 이어 쓸 수 있다.

가상 유저3은 에뮬레이터 없이 curl로 수행(회원가입→로그인→가입 신청).

| ID | 시나리오 | 기대 결과 | 판정 |
|---|---|---|---|
| P7-01 | 관리자(User1) 그룹 이탈 시도 | 409 MANAGER_TRANSFER_REQUIRED | 미실행 |
| P7-02 | 관리자 자기 자신 내보내기 | 409 CANNOT_REMOVE_SELF | 미실행 |
| P7-03 | User1 두 번째 그룹 생성 → User2 가입·승인 시도 | 409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP | 미실행 |
| P7-04 | 보호자(User1) 다중 그룹·그룹 전환 토글 | 허용, 좌상단 토글로 전환 | 미실행 |
| P7-05 | 유저3(보호자) 가입 → 관리자 위임 → 내보내기 | is_manager 단일 제약 유지 | 미실행 |
| P7-06 | 유저3 회원 탈퇴 | users 익명화(NULL)·withdrawn_at 기록, device_tokens 비활성. 작성물 보존 | 미실행 |
| P7-07 | 관리자 상태에서 탈퇴 시도 | 409 MANAGER_TRANSFER_REQUIRED | 미실행 |

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
| F-2 | P1 | 사전 | AI 통화 운영 인증 경로 미구현 — UnavailableCallActorResolver 401 하드코딩 | [S15P11B104-214] 재오픈·구현 완료 |
| F-3 | Obs | 사전 | AI_CALL_README가 "임시 Web UI"라 기술하나 실제로는 Kotlin 모듈 완성 — 문서 최신성 | 미등록 |
| F-4 | Obs | 사전 | 401 응답 봉투 이원화 (Security 공통 봉투 vs call 도메인 `{"error":{...}}`) | 미등록 |
| F-5 | P3 | P1 | 형식 미달 아이디로 중복확인 탭 시 완전 무반응 — 오류·토스트 없어 버튼 고장으로 오인 | 미등록 |
| F-6 | P3 | P1 | 비밀번호 "영문+숫자 각 1자 이상" 규칙이 화면에 안내되지 않고, 위반 시 "다음"만 비활성 (placeholder는 "영문·숫자 8~16자") | 미등록 |
| F-7 | P3 | P1 | 생년월일 휠 기본값이 당해(2026) — 고령 피보호자는 60~70년 스크롤 필요 | 미등록 |
| F-8 | P3 | P1 | 가입 완료 후 자동 로그인 없이 랜딩으로 복귀 — 방금 만든 계정을 다시 입력해야 함 | 미등록 |
| F-9 | **P2** | P1 | 로그인 바텀시트에서 BACK 키가 키보드보다 시트를 먼저 닫아 입력값 유실 (표준: BACK 1회 = 키보드 닫기) | 미등록 |
| F-10 | P3 | P2 | 중복 가입 신청(409)이 잘못된 코드(400)와 동일한 문구로 표시되어 원인 구분 불가 | 미등록 |
| F-11 | **P2** | P2 | 알림 화면 역할 지정 팝업(`NotificationDecisionModal`)이 신청자 실명 대신 하드코딩된 "수호 / [손수호]"를 표시 | 미등록 |
| F-12 | **P1** | P2 | 알림 화면의 인라인 승인/거부가 API에 연결되지 않음 — 승인 API 미호출인데 알림만 읽음 처리되어 사라짐. 관리자는 처리 완료로 착각하고 신청자는 무기한 대기. 정식 경로(그룹정보>가입 승인 대기)는 정상 | 미등록 |
| F-13 | P3 | P2 | 가입 승인 직후 그룹정보 구성원 목록이 갱신되지 않음 (탭 재진입 시에만 반영) | 미등록 |
| F-14 | **P1** | P2 | 호칭 편집 모드에서 저장 버튼이 역할 토글에 가려지고, 역할 토글은 확인 절차 없이 즉시 변경을 실행 → 오터치 한 번으로 구성원 역할이 바뀜 (실측: 저장 탭이 User2를 GUARDIAN으로 변경, 수동 원복) | 미등록 |
| F-15 | **P2** | P4 | 캘린더가 세션 중 재조회하지 않음 — 타 구성원이 만든 일정이 탭 재진입·날짜 재선택에도 안 보이고 앱 재시작 후에야 표시 | 미등록 |
| F-16 | P3 | P4 | 일정 수정 저장 시 상세 팝업이 중첩으로 쌓여(3겹 실측) 닫기를 여러 번 눌러야 함 | 미등록 |
| F-17 | Obs | P5 | (환경) 에뮬레이터 가상 오디오 HAL이 `pcm_readi failed: I/O error`를 반복하며 마이크 입력이 완전히 끊김 → 콜드 부팅으로 해소. AI 통화 QA 시 이 실패 모드를 먼저 의심할 것 | 미등록 |
| F-18 | **P2** | P6 | 리포트 탭도 F-15와 동일하게 탭 재진입만으로 갱신되지 않고 앱 재시작 후에야 최신 리포트·알림 배지 반영 → F-13·F-15와 공통 근본 원인(전역 캐시/재조회 정책) 가능성 | 미등록 |

### 우선 등록 권고

- **P1 3건**: F-12(가입 승인 무동작), F-14(역할 오변경), F-1(백지 화면, 이미 224 등록됨)
- **P2 4건**: F-9, F-11, F-15, F-18 — 특히 F-13/F-15/F-18은 하나의 티켓으로 묶어 "화면 재진입 시 재조회 정책"으로 다루는 편이 효율적

## 6. 다음 세션 인계 사항

- Phase 7(그룹 관리·파괴적 시나리오) 전체 미실행 — 현재 데이터 그대로 이어서 진행 가능
- P3-10(미디어 업로드): AWS 자격증명 수령 후 실행
- P5-03/04/08(음소거·재발신 409·네트워크 차단), P6-04(리포트 달력) 미실행
- 일일 리포트 실제 생성은 KST 22:00 이후 재확인 필요
