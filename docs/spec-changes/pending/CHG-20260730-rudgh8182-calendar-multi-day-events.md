# 여러 날에 걸친 일정 지원 여부와 날짜 컬럼 구조

- 상태: 제안
- 제안자: rudgh8182
- 작성일: 2026-07-30
- 차단 변경: 예 (요구사항, API 계약, DB 스키마를 함께 바꾼다)
- 영향 스펙·계약: `docs/requirements.md` (REQ-025, REQ-026, REQ-027),
  `docs/specs/domains/CALENDAR.md`,
  `docs/specs/contracts/API.md` (`API-CALENDAR-001`~`005`),
  `docs/specs/contracts/DATA_MODEL.md` (`calendar_events`),
  `docs/specs/domains/AI_CALL.md` (`get_calendar_events_by_date`)
- 관련 작업: 없음 (2026-07-30 ERD 검토 중 발견)
- 관련 제안: `applied/CHG-20260730-rudgh8182-calendar-allday-reminder-defaults.md`

## 기존 내용

`docs/specs/domains/CALENDAR.md` 「확정된 동작」 3항:

> 일정은 그룹, 작성자, 최종 수정자, 제목, 설명, 날짜, 선택적 시작·종료
> 시각과 연결된다.

날짜는 단수이고 종료는 "시각"이지 "날짜"가 아니다.

`docs/specs/contracts/DATA_MODEL.md` `calendar_events`:

> - 컬럼: `title VARCHAR(20)`, `event_date DATE`, `created_at`, `updated_at`
>   NOT NULL; `description VARCHAR(50) NULL`, `start_at TIMESTAMPTZ NULL`,
>   `end_at TIMESTAMPTZ NULL`

`docs/requirements.md` REQ-027 상세 설명(591행)과 수용 기준 ④⑤(597~600행):

> AI 전화에서는 `get_calendar_events_by_date` Tool로 특정 하루의 모든 가족
> 일정을 조회한다.
>
> ④ Spring Boot가 기준 현재 시각과 사용자 시간대를 적용해 `Asia/Seoul` 기준
> 단일 날짜로 해석하고, 날짜가 모호하면 조회하지 않는다. ⑤ `keyword` 없이
> 해당 날짜와 겹치는 모든 그룹 일정을 반환하며 임의 기간 조회는 하지 않는다.

`docs/requirements.md` REQ-025 수용 기준 ①:

> 제목·날짜·선택 시간·선택 멤버·자동 작성자·선택 세부내용으로 일정이
> 등록되고 날짜별로 조회된다.

정리하면 현재 공식 기준은 **일정 하나가 단일 날짜에 속한다**는 전제 위에
있다. 여러 날 일정을 지원하지 않는다고 명시한 문장은 없고, 데이터 모델과
API 계약의 구조로만 배제되어 있다.

## 제안 내용

여러 날에 걸친 일정(예: 8월 5일~8월 7일 가족 여행, 명절 연휴)을 하나의
일정으로 등록·표시할 수 있게 한다. 채택 시 아래 세 모델 중 하나를
선택해야 하며, 제안자는 1안을 권장한다.

### 1안 (권장) `end_date DATE` 추가

- `calendar_events`에 `end_date DATE NOT NULL`을 추가하고 `event_date`를
  시작일로 재정의한다.
- `DATE` 쌍은 하루종일·시간 일정 양쪽 모두 항상 채운다. 달력에서 차지하는
  날짜 범위를 담당한다.
- `TIMESTAMPTZ` 쌍은 시간 일정일 때만 채운다. 하루종일 판별은 기존 규칙인
  `start_at IS NULL`을 그대로 쓰므로 별도 불리언을 두지 않는다.

| 경우 | `event_date` | `end_date` | `start_at` | `end_at` |
|---|---|---|---|---|
| 하루종일, 하루 | `2026-08-05` | `2026-08-05` | NULL | NULL |
| 하루종일, 여러 날 | `2026-08-05` | `2026-08-07` | NULL | NULL |
| 시간, 하루 | `2026-08-05` | `2026-08-05` | `2026-08-04T23:00Z` | `2026-08-05T00:00Z` |
| 시간, 여러 날 | `2026-08-05` | `2026-08-07` | `2026-08-04T23:00Z` | `2026-08-07T09:00Z` |

- 월간 조회는 `event_date <= :date AND end_date >= :date` 한 조건으로
  통일되고 인덱스도 하나면 된다.
- API는 `endDate` 필드 하나를 추가한다. 기존 `eventDate`는 시작일로
  의미만 재정의한다.

### 2안 하루종일용 `DATE` 쌍과 시간용 `TIMESTAMPTZ` 쌍 분리

- 하루종일 일정은 `DATE` 두 컬럼에만, 시간 일정은 `TIMESTAMPTZ` 두
  컬럼에만 값을 넣는다. 중복 저장이 없다.
- 컬럼 수는 1안과 같지만 월간 조회 쿼리가 두 갈래로 나뉘고 인덱스도 둘이
  필요하다.

### 3안 `event_date` 제거, `is_all_day` 도입

- `event_date`를 제거하고 `is_all_day BOOLEAN NOT NULL`을 추가하며
  `start_at`, `end_at`을 `NOT NULL`로 바꾼다. 컬럼 수가 가장 적다.
- 하루종일 일정을 절대 시각으로 저장하게 되어, UTC 기준으로 날짜를 뽑는
  코드가 하나라도 있으면 하루 앞 날짜로 표시된다. `2026-08-05` 하루종일이
  `2026-08-04T15:00Z`로 저장되기 때문이다.
- 승인·반영 완료된
  `applied/CHG-20260730-rudgh8182-calendar-allday-reminder-defaults.md`가
  확정한 "시각을 보내지 않으면 날짜 일정" 규칙을 되돌리게 된다.

### 공통 사항 (어느 안을 택하든)

- 하루종일 일정은 지역에 관계없이 같은 날짜로 표시한다. 절대 순간이 아니라
  달력 칸에 붙은 표기이기 때문이다.
- 일정 알림의 "전날 09:00 `Asia/Seoul`" 기준일을 **시작일 기준**으로
  명시한다. 현재 스펙은 일정이 하루라는 전제 때문에 기준일을 규정하지
  않았다.
- 날짜 컬럼과 시각 컬럼의 정합성은 DB CHECK로 강제할 수 없다. PostgreSQL의
  `AT TIME ZONE`이 `STABLE` 함수라 CHECK 제약과 생성 컬럼에서 거부된다.
  따라서 서버가 `start_at`으로부터 날짜 컬럼을 파생하는 단일 경로를 두고,
  클라이언트가 날짜와 시각을 동시에 보내지 않게 한다.

## 변경 근거

- 현재 스키마로는 8월 5일~8월 7일 일정을 하나의 행으로 표현할 방법이 없다.
  `event_date DATE NOT NULL`이 단일 날짜이고
  (`backend/src/main/resources/db/migration/V1__create_schema.sql` 171행),
  하루종일 일정은 `start_at`·`end_at`이 모두 NULL이어야 하므로 시각
  컬럼으로 기간을 표현할 수도 없다.
- REQ-025 상세 설명(551행)이 등록 대상으로 "병원, 외출, 가족 행사,
  생일·명절"을 든다. 명절 연휴처럼 실제로 여러 날에 걸치는 사례가 예시에
  포함되어 있다.
- 캘린더 도메인이 거의 미구현이라 지금이 변경 비용이 가장 낮은 시점이다.
  존재하는 것은 `CalendarEvent`·`EventParticipant` 엔티티와 스키마뿐이고,
  Repository·Service·Controller·DTO·프론트 화면·AI Tool
  `get_calendar_events_by_date`는 모두 없다.
- 2026-07-30 세션에서 사용자(rudgh8182)가 ERD를 검토하다 제기했다.

## 확인된 영향

- 영향 도메인: 일정·캘린더, AI 통화(일정 조회 Tool), 알림(기준일 정의)
- 영향 계약:
  - `API-CALENDAR-001`~`005` — 요청·응답의 날짜 필드 구성
  - `DATA_MODEL.md`의 `calendar_events` 컬럼과 시간 쌍 CHECK
  - `idx_calendar_events_group_date (group_id, event_date)` — 기간 조회에
    맞게 재검토 필요
  - `AI_CALL.md`의 `get_calendar_events_by_date` — "해당 날짜와 겹치는"의
    의미가 단일 날짜 매칭에서 실제 기간 겹침으로 바뀐다
- 영향 화면: 월간 캘린더(`E-1`), 선택 날짜 목록(`E-2`), 일정 추가·편집
  (`E-3`). 기간 일정을 달력에 어떻게 표시할지는 현재 어느 문서에도 서술이
  없다.
- 영향 요구사항: REQ-025 수용 기준 ①(입력 항목), REQ-026(알림 기준일),
  REQ-027 수용 기준 ⑤("임의 기간 조회는 하지 않는다")
- 검증 범위: 코드 변경 없음. 이 제안은 기록만 하며 스키마·엔티티·공식
  스펙을 수정하지 않았다.

### 여러 날 일정과 무관하게 존재하는 정합성 허점

`V2__change_calendar_event_time_to_timestamptz.sql`로 `start_at`·`end_at`이
`TIMESTAMPTZ`가 된 뒤, `event_date`와 `start_at`의 KST 날짜가 서로 어긋나도
막는 제약이 없다. 시간 일정에서 `event_date`는 이미 `start_at`으로부터
파생 가능한 중복 정보다.

이 제안이 반려되더라도 캘린더 API 구현(`S15P11B104-121`) 전에 정리해야
한다. 위 「공통 사항」에 적었듯 DB CHECK로는 강제할 수 없으므로, 서버가
`start_at`에서 `event_date`를 파생하는 단일 경로로 처리하고 KST 자정
경계값(00:30 시작, 23:30 시작) 테스트로 고정한다.

## 확인이 필요한 질문

- 여러 날에 걸친 일정을 이번 프로젝트 범위에 포함할 것인가. 포함하지
  않으면 현재 하루 단위 전제를 유지하고 이 제안을 반려한다.
- 포함한다면 1안, 2안, 3안 중 무엇을 채택할 것인가.
- 일정 알림의 "전날 09:00" 기준일을 시작일로 확정하는가. 종료일 알림이나
  기간 중 매일 알림이 필요한가.
- 월간 달력에서 기간 일정을 어떻게 표시하는가(여러 날에 걸친 막대, 각
  날짜에 개별 표시 등). 현재 표시 방식 자체가 문서화되어 있지 않다.
- REQ-027 수용 기준 ⑤의 "임의 기간 조회는 하지 않는다"는 AI Tool의 조회
  입력에 관한 제약이므로 유지되는 것으로 읽었다. 이 해석이 맞는지 확인이
  필요하다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
