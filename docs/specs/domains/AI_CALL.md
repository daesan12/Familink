# [AI_CALL] AI 전화

> 상태: 일부 확정
> 기준: 2026-07-28, 최신 확정 Notion·요구사항·AI Tool Calling 결정·활성 API 명세

## AI 작업 컨텍스트

- 목적: 피보호자와 AI의 WebRTC 통화를 시작·진행·종료하고, 통화 중 필요한 가족 맥락과 일정을 안전하게 조회한다.
- 포함 범위: 페르소나 선택, 세션 생성, WebRTC 연결, 실시간 자막, Tool Calling, 통화 상태·종료, 내부 저장 경계.
- 제외 범위: 장기 기억(MVP 제외), 통화 녹음 재생, 보호자에게 전문 제공, 확장 검색 Tool.
- 핵심 규칙: AI 전화 화면과 통화 엔진만 Kotlin 네이티브 모듈로
  구현하고, 모든 서비스 API·인증·AI 오케스트레이션·DB 접근은 Spring Boot가
  담당한다. 현재 그룹·현재 피보호자 권한 범위만 사용한다.
- 완료 조건: 세션 상태 전이와 비노출 원칙을 지키고, `API-CALLS-001`~`API-CALLS-003` API 계약과 충돌하지 않는다.

## 확정된 동작

1. 피보호자는 자동 발신 시간이나 횟수 제한 없이 원할 때 AI 전화 탭에서
   페르소나를 선택하고 예시 발화를 확인한 뒤 통화를 시작한다.
2. AI 전화 전용 Kotlin 모듈은 고정 페르소나 번호 `persona_id`(1~6),
   Access Token, `sdp_offer`를 Spring Boot의 세션 생성 경로로 전달한다.
   AI 전화를 제외한 모바일 화면과 기능은 React Native로 구현한다.
3. Spring Boot는 토큰·현재 그룹 소속·피보호자 권한을 검증하고 OpenAI
   Realtime과 SDP를 교환한 뒤 동일 통화에 Sideband WebSocket으로
   연결한다. OpenAI API 키는 Spring Boot 서버에서만 보관한다.
4. 세션 생성 성공 결과로 `call_session_id`와 `sdp_answer`를 받아 WebRTC 연결을 완료한다.
5. 음성은 Kotlin 모듈과 OpenAI Realtime이 WebRTC로 직접 주고받고
   Spring Boot를 경유하지 않는다. Spring Boot는 Sideband WebSocket으로
   세션 설정, Tool Calling, 전사 완료, 오류와 종료 이벤트를 처리한다.
6. 통화 화면에는 통화 시간, 음소거, 통화 종료, 스피커 제어와 AI 발화 실시간 자막을 제공한다.
7. AI 발화 자막은 항상 표시한다. 사용자 발화 자막과 자막 끄기 기능은 제공하지 않는다. 자막 delta는 화면 표시용이고, 완료된 발화 단위 텍스트만 내부 처리와 리포트 생성에 사용한다.
8. Spring Boot는 현재 그룹의 저장된 관심사, 가족 구성원 맥락과 당일
   게시글 분석 결과를 통화 시작 프롬프트에 주입한다. 가족 구성원 맥락은
   DB ID를 노출하지 않는 세션 전용 `personKey`, `users.name`의 실제 이름인
   `name`, 피보호자가 설정한 별칭인 `displayName`으로 구성한다. 별칭이
   없으면 `displayName`은 `name`과 같다. 당일 게시글 분석 결과 주입은
   Tool Calling이 아니다. 당일 게시글 중 현재 피보호자 본인이 작성한
   게시글은 주입하지 않고, 같은 현재 그룹의 다른 가족 구성원이 작성한
   당일 게시글만 주입한다. 본인 게시글을 제외한 뒤 남은 당일 게시글 중
   최신 최대 10건을 주입하며, 제외 전 10건을 먼저 선택하지 않는다.
9. Spring Boot는 같은 현재 그룹·현재 피보호자의 완료된 통화 중 가장 최근
   5건까지의 `call_reports.summary`와 각 통화 종료일을 최신순으로 통화 시작
   프롬프트에 주입한다. 감정 분류와 보호자 전달 메시지는 포함하지 않는다.
   리포트가 5건보다 적으면 존재하는 항목만 사용하고, 없으면 최근 통화
   요약이 없음을 명시한다. 과거 요약은 참고 정보이며 현재 사용자 발화와
   다르면 확인한 뒤 현재 발화를 우선한다.
10. 통화 중 사용할 Tool은 다음 두 가지다.
   - `get_person_recent_post_summaries`: 필수 입력은 세션 전용
     `person_key`다. 현재 그룹에서 해당 인물의 분석 완료 게시글 요약을
     최신 최대 5개 반환하며 원문 본문과 미디어는 반환하지 않는다.
   - `get_calendar_events_by_date`: 필수 입력은 사용자의 원문 날짜 표현인
     `date_expression`이다. 서버가 `Asia/Seoul` 기준 단일 날짜로 해석한 뒤
     그 날짜와 겹치는 현재 그룹의 모든 일정을 반환한다. 여러 날에 걸친
     일정은 시작 날짜와 종료 날짜 사이에 그 날짜가 포함되면 겹치는 것으로
     본다. `keyword`와 임의 기간 조회는 사용하지 않으며 결과가 없으면 빈
     배열을 반환할 수 있다.
11. 모델은 세션 컨텍스트에서 `person_key`를 선택하고 날짜 표현을
    `date_expression`으로 추출한다. 서버 Tool 로직은 세션·권한·현재 시각·
    시간대를 검증·주입하고, 날짜가 모호하거나 해석되지 않으면 조회하지
    않고 확인에 필요한 상태를 반환한다.
12. 서버가 사용자·그룹·세션·권한·시간대 컨텍스트와 `person_key` 매핑을
    주입하며, 모델이 이 값을 사용자 입력으로 받아 신뢰하지 않는다.
13. 연결 결과는 `CONNECTED` 또는 `FAILED`로 처리한다. 세션 상태는 `CONNECTING`, `IN_PROGRESS`, `COMPLETED`, `INCOMPLETE`, `CANCELLED`, `FAILED`를 사용한다. 종료 원인 `termination_type`은 `USER_REQUESTED` 또는 `CONNECTION_LOST`를 사용하며, 요청 body나 값이 없으면 `USER_REQUESTED`로 처리한다. `CONNECTING` 중 연결 성공은 `IN_PROGRESS`, `USER_REQUESTED`는 `CANCELLED`, 연결 오류 또는 `CONNECTION_LOST`는 `FAILED`가 된다. `IN_PROGRESS` 중 `USER_REQUESTED`는 `COMPLETED`, `CONNECTION_LOST`는 `INCOMPLETE`가 된다.
14. `COMPLETED` 통화는 전사 무결성 상태가 `COMPLETE`이고 finalization이 끝난
    경우에만 건별 리포트를 생성한다. `INCOMPLETE`는 충분한 transcript가
    있고 전사 무결성 상태가 `COMPLETE`일 때만 생성할 수 있으며, 충분함의
    기준이 미결정인 동안 자동 생성 대상에 포함하지 않는다. `CANCELLED`·
    `FAILED`는 리포트를 생성하지 않는다.
15. 통화 종료 요청은 비동기로 접수한다. 클라이언트와 Sideband의 종료 처리가
    겹치면 먼저 확정된 종결 상태와 최초 `endedAt`을 보존하고, 이후 요청에도
    같은 `202` 성공을 반환한다. Sideband remote close 뒤 최대 2초 동안 남은
    callback을 drain하고 영속 전사 원장에 미해결 항목이 없을 때만 전사를
    finalization한다. drain timeout·미해결 항목·저장 실패가 있으면
    `RECONCILIATION_REQUIRED`로 닫아 리포트를 차단한다.
16. 활성 통화 세션에는 90초 lease를 부여하고, 살아 있는 Sideband 세션을
    소유한 백엔드 인스턴스가 30초마다 자신의 세션 lease를 갱신한다. lease가
    만료된 `CONNECTING`은 `FAILED`, 만료된 `IN_PROGRESS`는 `INCOMPLETE`로
    원자 전환하고 `ended_at`을 기록한다. 이 복구는 애플리케이션 시작 시,
    주기 작업과 같은 피보호자의 새 통화 생성 직전에 수행한다.
17. 녹음 원본은 저장하지 않는다. 보호자에게 전체 통화 전문·원본 음성을 노출하지 않고 건별 요약과 보호자 전달 메시지만 제공한다.
18. Spring Boot는 Sideband의 유효한 발화 item을 영속 원장에 먼저
    `RESERVED`로 커밋하고, 완료 전사와 해시를 `READY`로 별도 커밋한 뒤
    `call_transcripts`에 반영해 `APPLIED`로 만든다. 원장과 전사는
    `(call_session_id, openai_item_id)` 및 `(call_session_id, sequence)`로
    멱등 처리한다. 순번은 세션 행을 잠근 상태에서 기존 원장·전사의 최대
    순번 다음 값으로 할당하므로 프로세스 재시작 뒤에도 재사용하지 않는다.
19. 종료 후 건별 리포트의 Gemini 호출은 30초 총 제한시간과 공용 AI
    bounded executor(최대 동시 2개·대기열 20개)를 사용한다. 입력 전사 조회와
    결과 저장은 각각 짧은 트랜잭션으로 수행하고 Gemini 호출 중에는 DB
    트랜잭션을 유지하지 않는다. 건별 리포트 자동 재시도는 이번 범위에
    포함하지 않는다.
20. 전사 무결성 상태는 통화 상태와 분리한 `COLLECTING`, `COMPLETE`,
	`RECONCILIATION_REQUIRED`를 사용한다. 최초 `RESERVED`, 새 `READY`
	payload·이상 상태, `APPLIED`처럼 입력 또는 저장 완결성이 실제로 바뀌는
	트랜잭션마다 `transcript_revision`을 단조 증가시킨다. 정상 drain 뒤에는
	`transcript_finalized_at`을 기록하고, 미해결 원장이 있으면
	`RECONCILIATION_REQUIRED`로 기다렸다가 모두 `APPLIED`가 된 트랜잭션에서
	`COMPLETE`와 최종 revision을 함께 확정한다. drain 실패 시에는 finalization
	시각을 기록하지 않으며, finalization 뒤의 정상 이벤트는 허용하지 않는다.
21. live handler와 1분 주기 복구 작업은 같은 materialization 경로를 사용한다.
    복구 작업은 batch 20, 최대 3회, 1분·2분 backoff와 `FOR UPDATE SKIP
    LOCKED`를 사용한다. 최종 실패는 원장을 `FAILED`, 세션을
    `RECONCILIATION_REQUIRED`로 전환한다.
22. 애플리케이션 시작과 1분 주기 watchdog은 `ended_at`이 90초 이상 지난
	terminal `COLLECTING` 세션 중 아직 finalization되지 않은 항목을
    `RECONCILIATION_REQUIRED`로 전환한다. malformed event, item ID 누락,
    예약 불일치, provider 전사 실패, close drain timeout과 원장 기록 실패도
    fail-closed한다.
23. `COMPLETE` finalization과 같은 트랜잭션에서 건별 리포트 generation
    request를 `PENDING`으로 한 번만 만든다. 공용 executor가 거부해도
    `PENDING`을 유지하며 1분 주기 batch 20 복구가 다시 접수한다. worker는
    90초 single-flight claim을 사용하고, 명시적인 Gemini 실패는
    `GEMINI_FAILED`로 남겨 자동 재시도하지 않는다.
24. 배포 중 이전 버전 인스턴스가 새 무결성 컬럼을 읽지 않더라도 부분
    리포트를 저장하지 못하도록 DB가 `call_reports` 쓰기 시 무결성
    `COMPLETE`, finalization 완료와 미해결 원장 없음 조건을 강제한다.

확정된 예외:

- 조건: Tool의 대상 인물이 모호함
  - 처리: 반환된 후보를 바탕으로 사용자의 확인을 받는다.
- 조건: 연결 결과가 실패하거나 사용자가 취소함
  - 처리: 최종 상태를 `FAILED` 또는 `CANCELLED`로 기록하고 건별 리포트를 만들지 않는다.
- 조건: `INCOMPLETE` 상태에서 transcript가 리포트 기준에 부족함
  - 처리: 건별 리포트를 만들지 않는다.

## 구현 규칙

- 권한: AI 전화는 피보호자만 사용한다. Spring Boot가 Access Token,
  현재 그룹, 피보호자 권한을 검증한다.
- `persona_id`는 1~6의 고정 번호로 검증하고, 페르소나 테이블이나 DB
  외래 키를 사용하지 않는다.
- 고정 페르소나 매핑:

  | `persona_id` | 표시명 | OpenAI 음성 | 말투 |
  |---:|---|---|---|
  | 1 | 사랑스러운 아들 | `ash` | 부모 호칭과 `-요` 존댓말 |
  | 2 | 사랑스러운 딸 | `sage` | 부모 호칭과 `-요` 존댓말 |
  | 3 | 남자 비서 | `cedar` | 사용자 역할 호칭과 격식 높은 존댓말 |
  | 4 | 여자 비서 | `marin` | 사용자 역할 호칭과 격식 높은 존댓말 |
  | 5 | 친구 학수 | `verse` | 반말과 약한 경상도 사투리 |
  | 6 | 친구 복희 | `ballad` | 반말과 약한 전라도 사투리 |

- 자식 페르소나는 계정 성별이 `MALE`이면 `아빠`, `FEMALE`이면 `엄마`,
  비서 페르소나는 `MALE`이면 `회장님`, `FEMALE`이면 `사모님`이라고
  부른다. Spring Boot가 성별을 최종 호칭으로 변환하며 모델에는 성별을
  전달하지 않는다.
- 친구 페르소나는 고정 직함 없이 동년배처럼 대화한다. 사투리는 한 응답에
  최대 한 번만 사용하고 매 응답에 강제하지 않는다.
- 모든 페르소나는 관계형 말투만 사용하며 실제 가족·지인·고용인이라고
  주장하지 않는다. 정체를 물으면 해당 말투로 AI 말동무임을 밝힌다.
- 페르소나 프롬프트는 `Persona`, `Identity Boundary`, `Address`,
  `Speech Style`, `Dialect`, `Variety`, `Sample Phrases`로 구분하고,
  예시 발화는 그대로 반복하지 않고 말투 참고용으로만 사용한다.
- 통화 시작 프롬프트의 가족 구성원은 `personKey`, `name`,
  `displayName`을 함께 제공한다. 최근 통화 맥락은 현재 그룹·현재
  피보호자의 종료 통화 중 최신 5건까지만 사용하고, 새 리포트 생성
  파이프라인이나 장기 기억으로 확장하지 않는다.
- 개발용 `AICALL` fixture의 민지·준호 별칭은 각각 `딸`·`손자`로 두어
  실제 이름과 호칭을 분리한다.
- 상태와 전이: 위 확정 전이만 사용한다. `CANCELLED`는 연결 전 사용자 종료, `FAILED`는 연결 실패 또는 연결 전 비정상 단절, `INCOMPLETE`는 연결 후 비정상 단절을 구분한다.
- 활성 세션 lease: `CONNECTING`·`IN_PROGRESS`는 `lease_expires_at`을
  가지며, 90초 lease를 30초마다 갱신한다. 각 백엔드 인스턴스는 자신이
  소유한 Sideband 세션만 갱신하고, 만료된 행만 비관적 잠금 후 복구한다.
  종결 상태에서는 lease를 `NULL`로 만든다.
- API:
  - 처리 주체: Spring Boot 단일 백엔드
  - Method와 Path: `API-CALLS-001`~`API-CALLS-003`의 Method·Path·요청·결과는 [`../contracts/API.md`](../contracts/API.md)를 참조한다. 확인된 세션 생성 경로는 `POST /call-sessions`다.
  - 핵심 입력·결과: `persona_id`, `sdp_offer`, 연결 결과, 종료 원인 `termination_type`과 종료 상태를 계약에 맞게 교환한다.
  - 요청 JSON은 `snake_case`를 사용한다. 클라이언트는 현재 그룹이나
    서버가 관리하는 현재 세션 `status`, 내부 사용자·멤버십 ID를 보내지
    않는다. 계약 입력인 연결 결과 `result`와 종료 원인
    `termination_type`은 전달한다.
  - 잘못된 JSON·필수 필드·enum·SDP는 `400`, 인증 실패는 `401`, 역할·
    당사자 권한 실패는 `403`이다. 존재하지 않는 세션은 연결 결과·종료에서
    `404`, 활성 통화 중 생성은 `409 ACTIVE_CALL_EXISTS`, 허용하지 않는
    연결 결과 상태는 `409 INVALID_CALL_STATUS`, Realtime 연결·SDP 교환
    실패는 생성에서 `502 AI_CONNECTION_FAILED`를 사용한다.
  - 중복 종료는 오류나 `409`가 아니며 같은 `202` 성공을 반환한다.
  - 만료된 lease는 새 통화 생성 전에 위 상태 규칙으로 복구하며 활성 통화로
    보지 않는다. 아직 유효한 `CONNECTING`·`IN_PROGRESS`가 있을 때만
    `409 ACTIVE_CALL_EXISTS`를 반환한다.
- 데이터:
  - 관련 엔티티: `call_sessions`, `call_transcript_events`,
    `call_transcripts`, `call_report_generation_requests`, `call_reports`
  - 읽기·쓰기 소유자: Spring Boot가 세션·transcript·AI 결과를 직접
    기록한다. 테이블 제약은
    [`../contracts/DATA_MODEL.md`](../contracts/DATA_MODEL.md)를 따른다.
  - 주요 제약조건: 원본 음성·전체 전문과 전사 원장 payload를 보호자 조회
    데이터로 만들지 않는다. `call_sessions`에는 상세 disconnect reason 컬럼을
    두지 않으며 활성 lease와 전사 무결성·revision·finalization 정보만 둔다.
- AI 실행: 건별 리포트 작업은 게시글 분석·일일 리포트와 같은 bounded
  executor를 사용한다. 대기열 포화나 Gemini 실패를 이유로 종료 API의
  확정 상태를 되돌리지 않는다. `PENDING`·만료 `CLAIMED`의 실행 유실만
  자동 복구하고 `GEMINI_FAILED`는 자동 재시도하지 않으며, 수동 재처리 API나
  관리 화면은 별도 결정 전 추가하지 않는다.
- 화면:
  - 진입점: 피보호자 하단 `AI 전화` 탭, IA `F-1`~`F-3`
  - 사용자에게 표시할 결과: 페르소나 예시, 연결·통화 상태, 실시간 자막, 통화 제어, 종료 결과. 건별 감정과 전체 전문은 표시하지 않는다.

## 인수 조건

### AC-001

- Given: 승인된 현재 그룹의 피보호자가 페르소나를 선택했다.
- When: `API-CALLS-001` 계약으로 SDP offer를 제출한다.
- Then: Spring Boot가 권한을 확인하고 OpenAI Realtime 통화와 Sideband
  연결을 생성한 뒤 SDP answer를 반환한다.

### AC-002

- Given: 통화가 `IN_PROGRESS`다.
- When: AI가 발화하고 사용자가 음소거·스피커·종료 제어를 사용한다.
- Then: AI 발화 자막은 항상 갱신되고 사용자 발화 자막·자막 끄기 기능은 나타나지 않으며, 완료된 발화만 내부 transcript 처리에 사용된다.

### AC-003

- Given: 상대 날짜가 포함된 일정 질문이 있다.
- When: 모델이 날짜 표현을 `date_expression`으로 전달해 일정 Tool을 실행한다.
- Then: 서버가 `Asia/Seoul` 기준 하나의 날짜로 해석하고 그 날짜와 겹치는
  현재 그룹 일정을 조회하며, 날짜가 모호하면 조회하지 않는다. 여러 날에
  걸친 일정은 시작 날짜와 종료 날짜 사이에 그 날짜가 포함되면 겹친다.

### AC-004

- Given: 현재 그룹의 가족 구성원 별칭과 이전 통화 리포트가 존재한다.
- When: Spring Boot가 새 AI 통화의 시작 프롬프트를 구성한다.
- Then: 가족 구성원의 `personKey`·실제 이름·별칭과 현재 피보호자의 최신
  통화 요약 최대 5건이 권한 범위 안에서 주입되고, 감정 분류와 보호자
  전달 메시지는 포함되지 않는다.

### AC-005

- Given: 통화 생성·연결 결과·종료 요청이 실패하거나 종료 요청이 중복된다.
- When: Spring Boot가 요청 형식·인증·권한·세션·상태·AI 연결 결과를
  판정한다.
- Then: API 계약의 기존 오류 코드로 응답하고, 중복 종료는 최초 상태와
  시각을 보존한 같은 `202` 성공으로 처리한다.

### AC-006

- Given: 이전 백엔드 프로세스가 종료되어 `CONNECTING` 또는 `IN_PROGRESS`
  세션의 lease가 만료되었다.
- When: 애플리케이션 시작·주기 복구 또는 같은 피보호자의 새 통화 생성이
  수행된다.
- Then: `CONNECTING`은 `FAILED`, `IN_PROGRESS`는 `INCOMPLETE`로 한 번만
  전환되고 종료 시각이 기록되며, 해당 stale 세션 때문에 새 통화가
  `ACTIVE_CALL_EXISTS`로 차단되지 않는다.

### AC-007

- Given: 종료된 통화의 건별 리포트 Gemini 호출이 응답하지 않는다.
- When: 비동기 리포트 생성을 실행한다.
- Then: 호출은 30초 안에 실패하고 DB 트랜잭션과 공용 AI 실행 자원을
  반환하며, 이미 확정된 통화 종료 상태는 유지된다.

### AC-008

- Given: 발화 완료 전사가 영속 원장에 `READY`로 저장된 뒤
  `call_transcripts` 반영이 실패했다.
- When: live handler 또는 복구 작업이 같은 항목을 다시 처리한다.
- Then: 순번과 item ID가 같은 전사를 정확히 한 번 반영하고 revision을 한 번만
  증가시키며, 미해결 항목이 남은 동안에는 건별 리포트를 만들지 않는다.

### AC-009

- Given: 통화 종료 drain timeout, malformed event, provider 전사 실패 또는
  최대 materialization 실패가 발생했다.
- When: finalization 또는 watchdog이 세션을 검사한다.
- Then: 전사 무결성은 `RECONCILIATION_REQUIRED`가 되고 부분 전사를 입력으로
  건별 리포트를 만들지 않는다.

### AC-010

- Given: 전사 무결성 `COMPLETE` 세션의 generation request가 생성됐지만
  executor 거부 또는 worker 종료로 실행이 유실됐다.
- When: 1분 주기 복구 작업이 `PENDING` 또는 만료 `CLAIMED`를 찾는다.
- Then: 최신 revision을 다시 검증해 한 건의 리포트만 저장하고, 명시적인
  Gemini 실패는 자동 재시도하지 않는다.

## 미결정 사항

- 페르소나별 음성 예시 재생 방식과 AI 고지·동의 방식
- 통화 transcript 보존 기간과 삭제 정책
- 장기 기억의 도입 시점과 저장 범위
- 주제 기반 게시글 검색 Tool의 확장 계약
- 피보호자가 실제 가족과 직접 연락하고 싶다고 말했을 때 보호자에게 보내는
  확장 알림의 감지 기준과 대상 보호자 선정 규칙
