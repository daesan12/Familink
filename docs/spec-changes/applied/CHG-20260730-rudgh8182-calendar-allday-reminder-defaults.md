# 캘린더 하루종일 토글·일정 알림 2회 규칙·시간 기본값 확정

- 상태: 승인·반영 완료
- 제안자: rudgh8182
- 작성일: 2026-07-30
- 차단 변경: 예 (API 전송 규칙과 `notifications` DB 제약이 달라진다)
- 영향 스펙·계약: `docs/specs/domains/CALENDAR.md`,
  `docs/specs/domains/NOTIFICATIONS.md`,
  `docs/specs/contracts/API.md` (`API-CALENDAR-003`, `API-CALENDAR-004`),
  `docs/specs/contracts/DATA_MODEL.md` (`notifications`)
- 관련 작업: 없음 (2026-07-30 팀 결정 전달)

## 기존 내용

`docs/specs/domains/CALENDAR.md` 「확정된 동작」 6항:

> 사용자는 알림 시점을 선택하거나 바꾸지 않는다. 시간 일정은 시작 1시간 전,
> 날짜 일정은 전날 09:00 `Asia/Seoul`에 일정 시작 알림을 한 번 생성한다.

같은 문서 10항:

> 같은 수신자·일정·알림 유형 조합의 중복 생성을 방지하며 일정 알림은
> `notifications`에 저장한다.

같은 문서 AC-003:

> Given: 시간 일정은 시작 1시간 전이고 날짜 일정은 전날 09:00 `Asia/Seoul`이다.
> ... Then: 현재 활성 대상자에게 중복 없이 일정 시작 알림을 한 번 생성한다.

`docs/specs/contracts/API.md` 「일정」 부기:

> 날짜 일정 알림은 전날 09:00 KST, 시간 일정 알림은 시작 1시간 전에 생성한다.

`docs/specs/contracts/DATA_MODEL.md` `notifications`:

> 일정 시작 알림 중복 방지 부분 Unique:
> `(receiver_user_id, related_event_id, type)
> WHERE type = 'EVENT_REMINDER' AND related_event_id IS NOT NULL`

일정 등록·수정 화면의 "하루종일" 표기와 시작·종료 시각의 기본값은 어느
공식 스펙에도 정의되어 있지 않다. 스펙은 `start_at`, `end_at`이 모두 NULL인
일정을 "날짜 일정"으로만 부른다.

## 제안 내용

1. 일정 등록·수정 화면은 "하루종일" 토글을 제공한다. 하루종일을 켜면
   클라이언트는 `startAt`, `endAt`을 보내지 않으며(또는 null), 서버는 이를
   날짜 일정으로 저장한다. UI의 "하루종일"은 스펙 용어 "날짜 일정"과 같은
   개념이다.
2. 모든 일정은 전날 09:00 `Asia/Seoul`에 일정 시작 알림을 생성한다.
3. 시간 일정은 추가로 시작 1시간 전에 일정 시작 알림을 생성한다. 따라서
   날짜 일정은 1회, 시간 일정은 최대 2회 알림을 받으며, 사용자가 알림
   시점을 선택하지 않는 원칙은 유지한다.
4. 중복 방지 기준을 "수신자·일정·알림 유형·알림 시점 종류" 조합으로
   바꾼다. `notifications`에 알림 시점 종류 컬럼
   `reminder_slot`(`DAY_BEFORE` | `HOUR_BEFORE`, `EVENT_REMINDER` 외에는
   NULL)을 추가하고 부분 Unique를
   `(receiver_user_id, related_event_id, type, reminder_slot)
   WHERE type = 'EVENT_REMINDER' AND related_event_id IS NOT NULL`로 바꾼다.
5. 시간 설정을 켤 때 UI 기본값은 시작 08:00, 종료 09:00(사용자 표시
   시간대 기준)이다.
6. `API-CALENDAR-004`(PATCH)는 전체 필드 세트를 보내는 전체 갱신이며,
   `startAt`·`endAt`이 없거나 null이면 날짜 일정으로 저장한다(시간 일정을
   하루종일로 바꾸는 경로).

`NOTIFICATION_TYPE`에서 `EVENT_REMINDER`를 두 값으로 나누는 안은 채택하지
않는다. `notification_settings`가 같은 Enum을 쓰므로 "푸시 설정 7개" 확정
동작이 깨진다. "일정 시작 알림" 설정 하나가 전날 09:00·1시간 전 알림 모두에
적용된다.

## 변경 근거

- 2026-07-30 팀 확정 결정을 사용자(rudgh8182)가 전달했다. 시간 일정이
  전날 09:00과 시작 1시간 전 알림을 모두 받는 "2회 알림" 해석과, 공식
  스펙 직접 반영까지 사용자가 세션에서 확인했다.
- 시간 기본값(08:00/09:00)은 여러 상용 캘린더의 기본 동작을 참고한 팀
  결정이다.

## 확인된 영향

- 영향 도메인: 일정·캘린더, 알림
- 영향 계약: `API-CALENDAR-003`·`004`의 `startAt`/`endAt` 전송 규칙,
  `notifications`의 컬럼·부분 Unique
- 영향 화면: 일정 추가·수정 화면(`E-3`) — 하루종일 토글, 시간 기본값
- 검증 범위: 문서만 변경. 다만 실제 스키마
  `backend/src/main/resources/db/migration/V1__create_schema.sql`
  265~267행에 기존 부분 Unique(`uq_event_reminder_notification`)가 이미
  존재하므로, 일정 알림 스케줄러 구현 시점에 `reminder_slot` 컬럼 추가와
  인덱스 교체 마이그레이션이 필요하다. 일정 API·스케줄러 코드는 아직
  없어 이번에 수정할 코드는 없다.
- `docs/requirements.md`(REQ-026)와 `docs/user-flow.md` 67~73행은 옛 알림
  규칙(일정당 1회)을 서술한다. 두 문서는 원본 요구사항 스냅샷이므로
  수정하지 않고 차이만 여기에 기록한다.

## 확인이 필요한 질문

- 알림 예정 시점이 이미 지난 일정(예: 당일 오후에 등록한 일정의 전날
  09:00 알림)은 생략하는지, 즉시 발송하는지.
- 일정 등록 화면에서 하루종일 토글의 기본 상태(켜짐/꺼짐).

## 결정 및 반영

- 결정: 승인 (제안 전체. "확인이 필요한 질문" 2건은 미결정으로 유지)
- 결정자: 팀 확정 결정을 사용자(rudgh8182)가 전달
- 결정일: 2026-07-30
- 반영 문서: `docs/specs/domains/CALENDAR.md`,
  `docs/specs/domains/NOTIFICATIONS.md`,
  `docs/specs/contracts/API.md`,
  `docs/specs/contracts/DATA_MODEL.md`
- 반영 커밋:
