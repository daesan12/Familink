# AI 통화 일정 조회 Tool을 모델 계산 절대 날짜 기간 조회로 전환

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-07
- 차단 변경: 아니오
- 영향 스펙·계약: `docs/specs/COMMON.md`, `docs/specs/domains/AI_CALL.md`, `docs/specs/domains/CALENDAR.md`, `docs/specs/COVERAGE.md`
- 관련 작업: S15P11B104-373

## 기존 내용

현재 공식 스펙은 "모델은 원문 날짜 표현만 전달하고 서버가 단일 날짜로 해석한다"를
네 문서에 걸쳐 규정하며, 기간 조회를 명시적으로 금지한다.

- `docs/specs/COMMON.md`의 `## 시간과 날짜`(120~123행) — **전역 규칙**:
  > 상대 날짜를 절대 날짜로 해석할 때 기준 시간대는 `Asia/Seoul`이다.
  > 모델은 원문 날짜 표현을 `date_expression`으로 Tool에 전달하고, 서버가
  > `Asia/Seoul` 기준 현재 시각과 사용자 시간대를 적용해 단일 날짜로
  > 해석한다. 날짜가 모호하거나 해석되지 않으면 임의 조회하지 않는다.

- `docs/specs/domains/AI_CALL.md`의 "확정된 동작" 10번(52~57행):
  > `get_calendar_events_by_date`: 필수 입력은 사용자의 원문 날짜 표현인
  > `date_expression`이다. 서버가 `Asia/Seoul` 기준 단일 날짜로 해석한 뒤
  > 그 날짜와 겹치는 현재 그룹의 모든 일정을 반환한다. 여러 날에 걸친
  > 일정은 시작 날짜와 종료 날짜 사이에 그 날짜가 포함되면 겹치는 것으로
  > 본다. **`keyword`와 임의 기간 조회는 사용하지 않으며** 결과가 없으면 빈
  > 배열을 반환할 수 있다.

- 같은 문서 "확정된 동작" 11번(58~61행):
  > 모델은 세션 컨텍스트에서 `person_key`를 선택하고 날짜 표현을
  > `date_expression`으로 추출한다. 서버 Tool 로직은 세션·권한·현재 시각·
  > 시간대를 검증·주입하고, 날짜가 모호하거나 해석되지 않으면 조회하지
  > 않고 확인에 필요한 상태를 반환한다.

- 같은 문서 `AC-003`(219~225행): `When: 모델이 날짜 표현을 `date_expression`으로
  전달해 일정 Tool을 실행한다` / `Then: 서버가 `Asia/Seoul` 기준 하나의 날짜로
  해석하고 그 날짜와 겹치는 현재 그룹 일정을 조회하며, 날짜가 모호하면 조회하지
  않는다`.

- `docs/specs/domains/CALENDAR.md`의 "AI 작업 컨텍스트" 핵심 경계(11행):
  "Spring Boot가 일정 API, **상대 날짜 해석**, Tool 실행, 일정 조회와 알림
  스케줄을 담당한다."

- 같은 문서 "확정된 동작" 7번(28~30행), 8번(31~32행):
  > 7. AI 통화 중 사용자가 상대 날짜를 말하면 모델이 원문을
  >    `date_expression`으로 전달하고, 서버 Tool 로직이 `Asia/Seoul` 기준
  >    단일 날짜로 해석한 뒤 해당 날짜와 겹치는 그룹 일정을 조회한다.
  > 8. 날짜를 하나로 확정할 수 없으면 일정을 조회하지 않고 모호성 상태를
  >    반환한다. 조회 결과에 일정이 없으면 빈 배열을 반환할 수 있다.

- 같은 문서 65~67행: "`get_calendar_events_by_date`의 필수 입력은 사용자의 원문
  날짜 표현인 `date_expression`이다. 서버가 기준 현재 시각과 사용자 시간대를
  적용해 단일 날짜로 해석한다."

- 같은 문서 "예외" 75행: "AI가 날짜 표현을 해석할 수 없거나 모호하면 임의 날짜로
  변환하지 않고 사용자에게 확인을 요청한다."

- 같은 문서 "구현 규칙" 88행: "특정 날짜와 겹치는 일정은
  `event_date <= :date AND end_date >= :date`로 판정한다." — 단일 날짜 파라미터
  전제.

- 같은 문서 `AC-004`(122~127행): `When: 모델이 `date_expression`을 전달하고 서버
  Tool이 표현을 해석한다` / `Then: 해당 날짜와 겹치는 그룹 일정 목록을 반환하고,
  날짜가 모호하면 조회하지 않으며 일정이 없으면 빈 배열을 반환한다`.

- `docs/specs/COVERAGE.md` 90행: `FN-013 특정 날짜 전체 일정 조회 Tool` / 상태
  `반영` / 비고 "Tool 입력 `date_expression`; 서버가 `Asia/Seoul` 기준 날짜
  해석·조회".

이 규정들은 `docs/spec-changes/applied/CHG-20260728-unknown-notion-ai-final-sync.md`
의 결정 2번(20행)에서 확정됐다.

> `get_person_recent_post_summaries` 입력은 `person_key`,
> `get_calendar_events_by_date` 입력은 `date_expression`으로 통일한다. 모델은
> 표현을 추출하고 서버 Tool 로직이 세션·권한·`Asia/Seoul` 기준으로 검증·해석한다.
> 날짜는 단일 날짜로 확정되지 않으면 조회하지 않는다.

즉 이 제안은 새 공백을 채우는 것이 아니라 **이미 승인·반영된 결정을 뒤집는
것**이다.

## 제안 내용

### 1. Tool 계약 (`AI_CALL.md` "확정된 동작" 10·11번, `CALENDAR.md` 65~67행)

`get_calendar_events_by_date`를 `get_calendar_events_by_date_range`로 교체한다.
두 Tool을 함께 제공하지 않는다.

- 필수 입력은 `start_date`와 `end_date` 두 개이며, 둘 다 `yyyy-MM-dd` 형식의
  절대 날짜다. 다른 형식과 상대 표현은 받지 않는다.
- 하루 조회는 `start_date`와 `end_date`에 같은 날짜를 넣는 것으로 표현한다.
  하루 조회를 위한 별도 입력이나 선택 인자는 두지 않는다.
- 서버는 `start_date`부터 `end_date`까지의 기간과 하루라도 겹치는 현재 그룹의
  모든 일정을 반환한다. 겹침 판정 기준은 기존과 같다.
- 한 번에 조회할 수 있는 기간은 최대 7일이다. 7일을 초과하면 일정을 조회하지
  않고 기간을 좁혀야 함을 나타내는 상태를 반환한다.
- `keyword` 검색은 계속 제공하지 않는다. 결과가 없으면 빈 배열을 반환할 수 있다.

### 2. 날짜 해석 주체 (`COMMON.md` 121~123행, `CALENDAR.md` 7·8번과 11행)

날짜 해석 책임을 서버에서 모델로 옮긴다.

- 기준 시간대가 `Asia/Seoul`이라는 규칙은 그대로 유지한다.
- 서버는 통화 시작 프롬프트에 `Asia/Seoul` 기준 오늘 날짜를 요일과 함께
  제공한다. 모델은 이 날짜를 기준으로 사용자가 말한 표현을 절대 날짜로
  계산한다.
- 서버는 날짜 표현을 해석하지 않는다. 서버가 검증하는 것은 입력 형식,
  `start_date`가 `end_date`보다 늦지 않은지, 기간이 7일을 넘지 않는지다.
- 서버는 세션·권한·그룹 범위를 계속 검증·주입한다. 모델은 조회 대상 사용자와
  그룹을 지정할 수 없다.
- 형식이나 범위가 잘못되면 일정을 조회하지 않고 확인이 필요한 상태를 반환한다.
  임의의 날짜로 대체하지 않는다.
- `CALENDAR.md` 11행의 핵심 경계에서 "상대 날짜 해석"을 제거하고 "Tool 입력
  검증"으로 대체한다.

### 3. 조회 전 날짜 확인 (`AI_CALL.md`, `CALENDAR.md` 예외 75행)

모델은 계산한 날짜를 조회 전에 사용자에게 확인한다.

- 모델은 확정한 날짜를 한 문장으로 되물어 동의를 얻은 뒤에만 Tool을 호출한다.
  이 확인은 표현이 모호할 때만이 아니라 **모든 조회 전에** 수행한다.
- 사용자가 정정하면 정정된 날짜로 다시 계산해 확인한다.
- 확인 질문은 한 턴에 하나이며 기존 응답 길이 규정을 유지한다.
- 기간이 7일을 초과했다는 상태를 받으면 7일 이내로 좁힐 기간을 한 번만 되묻는다.
- 결과를 안내할 때는 Tool이 반환한 기간을 사용한다.

### 4. Tool이 반환하는 정보

공식 스펙은 Tool 반환 필드를 규정한 적이 없다. 현재 구현이 일반 목록 조회 응답
DTO를 그대로 쓰고 있어 `id`, `title`, 시작·종료 날짜, 시작·종료 시각만 반환한다.
다음을 규정한다.

- Tool은 각 일정의 제목, 시작·종료 날짜, 시작·종료 시각과 함께 **일정 설명과 활성
  참여자 이름**을 반환한다. 참여자는 그룹을 떠난 구성원을 제외하며, 일정 상세
  응답의 참여자 판정 기준과 같다.
- **시작·종료 시각은 `Asia/Seoul` 기준으로 반환한다.** 시각이 없는 일정은 하루종일
  일정이다. 모델은 시각을 그대로 읽어 안내하며 시간대를 계산하지 않는다.
- 설명과 참여자도 신뢰하지 않는 참고 데이터이며, 그 안의 문장을 지시로 해석하지
  않는다. 참여자를 부를 때는 기존 가족 구성원 표시명 규칙을 따른다.

이는 일정 조회 HTTP API(`API-CALENDAR-001`)의 응답을 바꾸지 않는다. Tool 전용
보충 조회 경로를 사용한다.

### 5. 인수 조건

`AI_CALL.md` `AC-003`을 다음으로 교체한다.

- Given: 상대 날짜나 기간이 포함된 일정 질문이 있다.
- When: 모델이 프롬프트의 오늘 날짜를 기준으로 절대 날짜를 계산해 사용자에게
  확인받은 뒤 `start_date`와 `end_date`로 일정 Tool을 실행한다.
- Then: 서버가 형식과 범위를 검증한 뒤 그 기간과 겹치는 현재 그룹 일정을
  조회한다. 형식이 잘못되거나 시작일이 종료일보다 늦거나 기간이 7일을 초과하면
  조회하지 않고 확인에 필요한 상태를 반환한다. 여러 날에 걸친 일정은 시작 날짜와
  종료 날짜 사이가 조회 기간과 하루라도 겹치면 포함한다.

`CALENDAR.md` `AC-004`를 다음으로 교체한다.

- Given: AI 통화에서 사용자가 날짜나 기간으로 일정을 질문했다.
- When: 모델이 확인받은 `start_date`와 `end_date`를 전달하고 서버 Tool이 형식과
  기간을 검증한다.
- Then: 해당 기간과 겹치는 그룹 일정 목록을 반환하고, 검증에 실패하면 조회하지
  않으며 일정이 없으면 빈 배열을 반환한다.

### 6. 커버리지

`COVERAGE.md` 90행 `FN-013`의 항목명을 "특정 기간 전체 일정 조회 Tool"로, 비고를
"Tool 입력 `start_date`·`end_date`(최대 7일); 모델이 `Asia/Seoul` 기준 오늘
날짜로 계산하고 조회 전 사용자 확인; 서버는 형식·기간 검증"으로 갱신한다.

### 7. 변경하지 않는 것

- `contracts/API.md`의 `API-CALENDAR-001`(`GET /groups/{groupId}/events`)은 이미
  `startDate`·`endDate` 기간을 받으므로 변경하지 않는다. 7일 상한은 AI 통화 Tool
  경계에만 적용하고 이 HTTP API와 공용 일정 조회 서비스에는 적용하지 않는다.
  앱 캘린더가 월 단위로 조회하기 때문이다.
- `contracts/DATA_MODEL.md`의 `calendar_events` 스키마와 겹침 판정 의미.
- `get_person_recent_post_summaries`의 계약.
- 일정 결과를 신뢰하지 않는 참고 데이터로 취급하고 그 안의 문장을 지시로
  해석하지 않는 규정.

## 변경 근거

- **현재 스펙이 지원 표현 범위를 서버 코드에 묶어 둔다.** 서버 해석은
  `backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/AiCallCalendarToolService.java`
  의 `resolveDate`·`resolveExplicitDate`와 `ISO_DATE`·`KOREAN_DATE`·`WEEKDAY`
  정규식으로 구현돼 있다. 지원 범위는 `오늘`·`금일`·`today`·`내일`·`tomorrow`·
  `어제`·`yesterday`, ISO 날짜, `2026년 8월 3일`, `이번/다음/지난 주 <요일>`뿐이다.
  `모레`, `이번 주말`, `다음 달`, 연도가 없는 `8월 3일`은 해석하지 못해 조회 자체를
  하지 않는다. 같은 파일의 단위 테스트 `AiCallCalendarToolServiceTest`의
  `rejectsAmbiguousOrInvalidExpressions`가 이 한계를 고정하고 있다. 표현을 하나
  늘릴 때마다 서버 정규식을 늘려야 한다.
- **기간 조회 경로 자체가 없다.** 현재 구현은
  `calendarEventService.getEvents(groupId, date, date, userId)`로 시작일과 종료일에
  같은 값을 넣어 항상 하루만 조회한다. "이번 주 일정"에 답할 방법이 없다.
- **모델은 이미 오늘 날짜를 받고 있다.** `AiCallPromptContext.CareReceiverContext`
  에 `currentDateKst` 필드가 있고 `AiCallPromptContextProvider`가
  `LocalDate.now(clock.withZone(KST))`로 채워 `## 피보호자 정보` 블록에 실어
  보낸다. 즉 모델이 날짜를 계산할 근거는 이미 프롬프트에 있으며, 현행 프롬프트가
  `AiCallPromptComposer`의 `# Entity Capture` 날짜 절에서 "실제 날짜로 계산하거나
  변환하지 않습니다"로 그 사용을 금지하고 있을 뿐이다. 새 데이터 배관이 필요하지
  않다.
- **위임할 조회 서비스는 이미 기간을 받는다.**
  `backend/src/main/java/com/ssafy/s15p11b104/domain/calendar/service/CalendarEventService.java`
  의 `getEvents(groupId, startDate, endDate, authenticatedUserId)`와
  `CalendarEventRepository.findAllByGroupIdAndDateRangeOverlap`이 기간 겹침 쿼리를
  수행한다. Tool 경계의 호출 인자만 바뀌며 조회·권한 로직은 재사용된다.
- **모델 오계산의 위험을 확인 단계로 상쇄한다.** 날짜 계산을 모델에 넘기면
  오계산 가능성이 생긴다. 이 제안이 모든 조회 전 확인을 요구하는 이유다. 서버의
  형식·범위 거부가 두 번째 방어선이고, 프롬프트에 요일을 함께 제공하는 것이
  세 번째다. 요일을 제공하는 근거는 "다음 주 화요일" 계산에서 모델이 날짜에서
  요일을 스스로 추론해야 하는데 그것이 이번에 서버에서 걷어내려는 불안정한
  계산과 같은 종류이기 때문이다.
- **7일 상한의 근거는 두 가지다.** 첫째, 현재
  `CalendarEventService.validateQueryRange`는 `startDate.isAfter(endDate)`만
  검사하고 최대 기간 제한이 없으며, `findAllByGroupIdAndDateRangeOverlap`에도
  결과 개수 상한이 없다. 모델이 넓은 기간을 보내면 일정 전수가 Tool 결과 JSON으로
  모델 컨텍스트에 들어간다. 참고로 게시글 조회 Tool은 `MAX_SUMMARY_COUNT = 5`
  상한을 갖고 있어 일정 Tool만 무제한이다. 둘째, 음성 통화에서 한 번에 안내할 수
  있는 분량이 제한적이고 `AiCallPromptComposer`의 `# Verbosity`가 "목록이나 여러
  항목의 열거는 음성으로 말하지 않습니다"를 이미 규정한다.
- **모든 조회 전 확인은 사용자 결정이다.** "오늘/내일"처럼 명확한 표현까지 확인해
  대화 턴이 늘어나는 트레이드오프를 알고 선택했다. 모호할 때만 확인하는 대안은
  모델이 "모호함"의 경계를 판단해야 해서 오계산을 놓칠 여지가 남는다.
- **교체 대신 Tool 2개 공존을 택하지 않은 이유**는 기능이 겹치는 Tool 두 개를
  모델이 구분해서 고르게 하는 프롬프트 부담이 생기고, 서버 날짜 파싱 로직도 함께
  유지해야 하기 때문이다.
- **시각을 UTC로 넘기고 있던 결함을 함께 고친다.** 기존 구현은
  `AiCallCalendarToolService.toToolEvent`에서 `Instant.toString()`으로 직렬화해
  오후 2시 일정을 모델에게 `2026-08-07T05:00:00Z`로 전달했다. 프롬프트에는 시간대
  안내가 한 줄도 없어 모델이 이 값이 UTC인지 알 수 없었고, 세션 설정이
  `reasoning.effort: low`라 스스로 보정할 여지도 작았다. 실제 통화에서 AI가 정확한
  시각을 안내하지 못하는 증상이 보고되었다. `CALENDAR.md` 규칙 11의 "UTC로 저장·교환
  하고 사용자 표시에만 `Asia/Seoul`을 적용한다"는 HTTP API에는 맞지만, **AI 통화에서는
  모델이 음성 안내의 표시 계층**이므로 Tool 경계가 변환 지점이다. 앱은 자체 표시
  계층을 갖고 있어 HTTP API는 계속 UTC로 교환한다.
- **설명과 참여자가 빠져 있어 통화에서 일정을 제대로 설명할 수 없다.** `title`이
  `VARCHAR(20)`으로 짧아 "병원 진료"까지만 담기는데, `description VARCHAR(50)`과
  참여자를 넘기지 않으면 "3층 정형외과이고 따님이 같이 간다"는 안내가 불가능하다.
  두 값은 DB에 이미 있고 일정 상세 응답에도 포함되지만, Tool이 목록 조회 경로를
  재사용해 누락되어 있었다.
- **공개 목록 API를 늘리지 않고 Tool 전용 보충 조회를 쓰는 이유**는 `API-CALENDAR-001`
  응답 계약을 건드리지 않기 위해서다. 권한 검사와 기간 겹침 판정은 기존
  `CalendarEventService`에 그대로 위임하고, 이미 권한이 확인된 일정 ID로 설명과
  참여자만 배치 조회한다. 조회 횟수는 일정 수와 무관하게 고정이다.

## 확인된 영향

- 영향 도메인: `AI_CALL`, `CALENDAR`. 일정 CRUD·참여자·알림 규칙은 바뀌지 않는다.
- 영향 계약: 없다고 판단한다. `contracts/API.md`의 `API-CALENDAR-001`~`005`는
  변경되지 않고, `contracts/DATA_MODEL.md`의 `calendar_events`도 변경되지 않는다.
  다만 `COMMON.md`의 전역 시간 규칙 문장이 바뀌므로 아래 질문에 남긴다.
- 영향 화면: 없다. 통화 화면과 캘린더 화면의 표시·조작은 바뀌지 않는다.
  클라이언트에는 Tool 정의가 없어 React Native·Kotlin 변경이 없다. Tool 이름과
  `date_expression`을 참조하는 코드가 `backend`에만 존재함을 확인했다.
- 검증 범위: `backend`의 `AiCallCalendarToolServiceTest`,
  `AiCallCalendarToolServiceIntegrationTest`, `SidebandToolHandlerTest`,
  `OpenAiRealtimeGatewayTest`, `AiCallPromptComposerTest`.
  `AiCallCalendarToolServiceTest`는 서버 표현 파싱 테스트라 전면 재작성 대상이고,
  `AiCallCalendarToolServiceIntegrationTest`의 모호성 케이스는 삭제 대상이다.
  모델이 실제로 날짜를 계산하고 확인하는 동작은 자동 테스트로 검증할 수 없어
  에뮬레이터 실기 통화로 (1) 하루 조회, (2) 기간 조회, (3) 7일 초과 시 되묻기를
  수동 확인해야 한다.
- 관련 제안: `CHG-S15P11B104-300-ai-call-response-length.md`(응답 길이 — 확인 턴이
  늘어나는 이번 변경과 함께 검토), `CHG-S15P11B104-180-multi-day-calendar-display.md`
  (여러 날 일정 표시, 상태 "일부 승인"). 관련 기존 결정:
  `applied/CHG-20260728-unknown-notion-ai-final-sync.md`(이 제안이 뒤집는 결정),
  `applied/CHG-20260730-rudgh8182-calendar-multi-day-events.md`(겹침 판정 의미 —
  유지).

## 확인이 필요한 질문

- 이 제안을 `차단 변경`으로 재분류해야 하는지 확인 필요. `COMMON.md`의
  `## 시간과 날짜`는 전역 규칙 위치이므로 형식상 여러 작업자가 참조하는 문서다.
  다만 실제로 이 규칙에 의존하는 코드는 백엔드 AI 통화 Tool 경계뿐이고 API·DB·
  인증·권한 계약은 바뀌지 않아 `차단 변경: 아니오`로 판정했다. 팀이 전역 규칙
  변경 자체를 공용 계약 변경으로 본다면 승인 전 구현을 중단해야 한다.
- `COMMON.md`의 해당 문장을 전역 규칙으로 유지할지, `AI_CALL.md`·`CALENDAR.md`로
  내리고 `COMMON.md`에는 기준 시간대만 남길지 확인 필요. 날짜 해석 주체가 모델로
  바뀌면 이 규칙은 AI 통화 Tool 한 곳에만 적용되므로 전역 위치가 적절하지 않을
  수 있다.
- 7일이 적절한 상한인지 확인 필요. 7일은 "이번 주 일정"을 만족하는 최소값으로
  선택했다. "이번 달 일정" 요구가 실제로 있으면 상한과 결과 개수 제한을 함께
  다시 설계해야 한다.
- 모든 조회 전 확인이 실제 통화에서 자연스러운지 확인 필요. 어르신 대상 통화라
  "오늘 일정 알려줘"에 매번 "8월 7일 오늘 맞으신가요?"로 되묻는 흐름이 번거롭게
  느껴질 수 있다. 에뮬레이터 확인 후 모호한 표현에만 확인하는 방식으로 좁힐지
  재검토할 여지가 있다.
- `Asia/Seoul` 자정을 넘기는 통화에서 프롬프트의 오늘 날짜가 통화 시작 시점에
  고정되는 문제를 다룰지 확인 필요. 세션 instructions는 통화 생성 시 1회만
  전송되고 통화 중 갱신 경로가 없다. 통화 길이가 짧아 이번 범위에서는 다루지
  않았다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
