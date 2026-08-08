# 일정 알림 대상을 선택된 참여자로 한정하고 참여자 미지정 일정의 전체 발송을 폐지

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-08
- 차단 변경: 예 (`calendar_events.participants_specified` 컬럼을 제거하는 DB 스키마 변경이다. API 요청·응답 형태는 바뀌지 않는다.)
- 영향 스펙·계약: `docs/specs/domains/CALENDAR.md` (「확정된 동작」 9·15항, AC-005, AC-008),
  `docs/specs/domains/NOTIFICATIONS.md` (알림 유형별 수신자 표),
  `docs/specs/contracts/DATA_MODEL.md` (`calendar_events`)
- 관련 작업: S15P11B104-362
- 관련 제안:
  - `docs/spec-changes/applied/CHG-S15P11B104-296-calendar-participant-lifecycle.md`
    (참여자 전원 이탈 시 그룹 전체로 확대하지 않는 규칙을 확정한 제안. 이번 제안은 그 원칙을
    "참여자 0명이면 언제나 발송 없음"으로 일반화한다.)
  - `docs/spec-changes/pending/CHG-S15P11B104-122-event-reminder-scheduling-policy.md`
    (6항이 "지정 참여자 전원 이탈 시 발송 없음"을 제안했다. 이번 제안은 "지정했는지" 조건 자체를
    없애므로 6항을 대체한다. 아래 「확인이 필요한 질문」 참조.)

## 기존 내용

`docs/specs/domains/CALENDAR.md` 「확정된 동작」 9항:

> 참여자를 명시적으로 지정한 일정은 현재 활성 참여자에게만 시작 알림을 보내고, 지정 참여자가 모두
> 이탈해 활성 참여자가 0명이 되어도 그룹 전체로 대상을 확대하지 않는다. 참여자를 명시적으로
> 지정하지 않은 일정만 그룹의 모든 활성 구성원을 대상으로 한다. 사용자가 일정 편집에서 참여자를
> 모두 해제하면 참여자 미지정 일정으로 전환한다. 이미 탈퇴한 구성원에게 미래 일정 알림을 보내지
> 않는다.

같은 문서 15항:

> 일정 생성 변경 알림은 지정 참여자에게 보내고 참여자가 없으면 현재 활성 그룹 구성원 전원에게
> 보내되 생성자는 제외한다. 수정 알림은 수정 전·후 지정 참여자의 합집합에 보내며 둘 다 비어
> 있으면 현재 활성 그룹 구성원 전원을 대상으로 하고 수정자는 제외한다. 삭제 알림은 삭제 직전 지정
> 참여자, 참여자가 없으면 현재 활성 그룹 구성원 전원에게 보내되 삭제자는 제외한다.

같은 문서 AC-005 Then:

> 생성·삭제는 해당 시점 참여자, 수정은 수정 전·후 참여자 합집합을 대상으로 하고 참여자가 없으면
> 현재 활성 그룹 구성원 전원을 사용하며, 변경한 본인은 제외한다.

같은 문서 AC-008 Then 마지막 문장:

> 마지막 지정 참여자가 이탈한 일정의 시작 알림 대상은 그룹 전체로 확대되지 않는다.

`docs/specs/domains/NOTIFICATIONS.md` 알림 유형별 수신자 표 4행 모두 "참여자가 없으면 현재 활성
그룹 구성원 전원"을 대상으로 규정한다.

`docs/specs/contracts/DATA_MODEL.md` `calendar_events` 컬럼 목록:

> `participants_specified BOOLEAN` NOT NULL;

같은 문서 설명:

> `participants_specified`는 사용자가 참여자를 명시적으로 지정한 일정인지 나타낸다. 지정 참여자가
> 모두 이탈해 연결 행이 0개가 되어도 true를 유지하며, 사용자가 일정 편집에서 참여자를 모두 해제할
> 때 false가 된다.

현재 구현도 위 규정과 일치한다.

- 저장: `backend/.../calendar/service/CalendarEventService.java`의 `resolveCreatorAndParticipants`가
  요청의 참여자 목록이 `null`이거나 비어 있으면 빈 리스트를 반환하고, `event_participants`에 0행을
  저장한다. 상세 조회 응답의 `participantMemberIds`도 빈 배열이다. 회귀 테스트
  `CalendarEventApiTest.createAcceptsNullAndEmptyParticipants`가 `count()).isZero()`로 고정한다.
- 변경 알림: `backend/.../notification/service/DomainNotificationRoutingService.java`의
  `routeCalendarChanged`가 `requestedMemberIds.isEmpty() ? activeMembers : (참여자로 필터)`로
  수신자를 정한다. 참여자가 0명이면 그룹 활성 구성원 전원(행위자 제외)이 대상이다.
- 시작 알림: `backend/.../notification/service/EventReminderService.java`의 `createIfDue`가
  `event.isParticipantsSpecified() ? (참여자로 필터) : activeMembers`로 정한다. 레거시 경로
  `resolveLegacyReceivers`도 같은 분기를 쓴다.

## 제안 내용

1. **일정 알림은 그 일정의 참여자에게만 보낸다.** 참여자가 0명인 일정은 생성·수정·삭제 알림과
   시작 알림 모두 **아무에게도 보내지 않는다.** "참여자를 지정하지 않았으면 그룹 전원"이라는
   대체 규칙을 폐지한다.

2. **참여자를 선택하지 않고 저장하는 것을 정상 동작으로 유지한다.** 참여자 0명 일정은 계속 저장·
   조회할 수 있고 캘린더에 표시된다. 알림 대상만 없는 것이다. 저장 계층은 이미 이렇게 동작하므로
   변경이 없다.

3. **일정을 만든 사람을 참여자로 자동 포함하지 않는다.** 작성자가 자기 자신을 선택하지 않으면 그
   일정의 시작 알림을 본인도 받지 않는다. 작성자 제외 규칙(생성·수정·삭제 알림에서 행위자 제외,
   시작 알림에서는 제외하지 않음)은 지금과 같이 유지한다.

4. **참여자 선택 화면에 "모두 선택" 토글을 제공한다.** 사용자가 전원을 참여자로 등록하는 경로를
   준다. 같은 버튼으로 전원 해제도 가능하다. 참여자를 아무도 선택하지 않았을 때의 빈 상태 문구는
   알림이 가지 않는다는 결과를 알 수 있게 바꾼다.

5. **`participants_specified` 컬럼을 제거한다.** 1항 이후 "미지정"과 "지정했으나 전원 이탈"이
   결과적으로 같은 상태(참여자 0명 → 알림 없음)가 되어 이 플래그가 구분할 대상이 사라진다.
   `DATA_MODEL.md`의 컬럼 목록과 설명 단락을 함께 삭제한다.

6. **AC-008의 "마지막 지정 참여자가 이탈한 일정의 시작 알림 대상은 그룹 전체로 확대되지 않는다"는
   유지한다.** 결론이 1항과 같다. 다만 "지정"이라는 구분이 없어지므로 표현만 정리한다.

7. **기존 데이터는 마이그레이션하지 않는다.** 이미 저장된 참여자 미지정 일정은 참여자 0명 그대로
   두며, 이 일정들은 이후 알림을 발생시키지 않는다.

`docs/specs/domains/NOTIFICATIONS.md`의 수신자 표는 다음으로 바꾼다. 각 행의 "참여자가 없으면 현재
활성 그룹 구성원 전원" 문구를 제거한다.

| 알림 | 수신자 | 제외 |
| --- | --- | --- |
| `EVENT_CHANGED` 일정 생성 | 지정 참여자 | 생성자 제외 |
| `EVENT_CHANGED` 일정 수정 | 수정 전·후 지정 참여자의 합집합 | 수정자 제외 |
| `EVENT_CHANGED` 일정 삭제 | 삭제 직전 지정 참여자 | 삭제자 제외 |
| `EVENT_REMINDER` 일정 시작 | 지정 참여자 | 제외하지 않음 |

## 변경 근거

- 사용자 요구다. QA에서 "일정 상세의 참여자와 실제 알림 대상이 어긋난다"는 결함이 보고되었다.
  참여자를 선택하지 않고 만든 일정은 상세 화면에 참여자가 0명으로 보이는데 알림은 그룹 전원에게
  간다. 사용자가 화면에서 보는 것으로 알림 대상을 예측할 수 없다.
  QA 원문: `https://app.notion.com/p/3b4e66fae19280d98d0efa005ed712cf`
- 이 어긋남은 구현 결함이 아니라 스펙대로 동작한 결과다. `CALENDAR.md` 9·15항과
  `NOTIFICATIONS.md` 표가 "참여자가 없으면 전원"을 명시하고, 그 의미를 저장하려고
  `participants_specified` 컬럼을 `V10__cleanup_inactive_event_participants.sql`로 추가했으며
  `CalendarEvent.changeParticipantScope`에 의도를 설명하는 Javadoc까지 달려 있다. 따라서 코드가
  아니라 목표 동작 자체를 바꾸는 결정이 필요하다.
- 현재 규칙은 사용자가 알림 범위를 좁힐 수는 있어도 **끌 수는 없는** 구조다. 참여자를 한 명도
  선택하지 않는 것이 "전원에게 알림"이라는 가장 넓은 결과를 만들어, 선택 개수와 알림 범위가
  반비례한다. 참여자를 1명만 고르면 1명에게 가지만 0명을 고르면 전원에게 간다.
- "모두 선택" 버튼(4항)이 없으면 1항 변경 후 전원 알림을 보낼 방법이 구성원 수만큼 개별 선택하는
  것뿐이다. 기존 규칙에서 참여자 미지정이 담당하던 "전원에게 알리기"를 대체하는 경로가 필요하다.
  저장소 전체에 일괄 선택 UI가 없어(`전체 선택`/`모두 선택`/`selectAll`/`toggleAll` 검색 0건)
  `CalendarParticipantModal`에 새로 만든다.
- 5항의 근거는 플래그가 구분하던 두 상태가 같은 결과로 수렴하는 것이다. 컬럼을 남기면 아무도
  읽지 않는 값이 스키마에 남고, 이후 "미지정이면 전원"이라는 폐지된 규칙을 되살리는 근거로
  오해될 수 있다.
- 3항과 7항은 2026-08-08 세션에서 사용자(손수호)가 확정한 결정이다.

구현 위치: `backend/.../notification/service/DomainNotificationRoutingService.java`의
`routeCalendarChanged`, `backend/.../notification/service/EventReminderService.java`의 `createIfDue`와
`resolveLegacyReceivers`, `backend/.../calendar/entity/CalendarEvent.java`,
`backend/.../calendar/service/CalendarEventService.java`,
`frontend/src/features/calendar/components/CalendarParticipantModal.tsx`.

## 확인된 영향

- 영향 도메인: `CALENDAR`, `NOTIFICATIONS`. 일정 저장·조회 동작은 바뀌지 않고 알림 수신자 결정만
  바뀐다.
- 영향 계약: `DATA_MODEL.md`의 `calendar_events`에서 `participants_specified` 컬럼이 사라진다.
  **DB 스키마가 바뀌므로 차단 변경이다.** 새 마이그레이션
  `V11__drop_calendar_event_participants_specified.sql`이 필요하고, 이 브랜치를 받은 팀원은
  로컬·공용 DB에 마이그레이션을 적용해야 한다. `V10`은 이미 배포된 체크섬이므로 수정하지 않는다.
  `API.md`는 **바뀌지 않는다.** `participants_specified`는 요청 DTO·응답 DTO 어디에도 노출되지
  않고, `API-CALENDAR-002`~`004`의 `participantMemberIds` 요청·응답 형태도 그대로다. 프론트엔드
  코드는 이 컬럼을 알지 못한다.
- 영향 화면: IA `E-3` 일정 생성·편집 화면의 참여자 선택 모달에 "모두 선택" 토글이 추가되고,
  참여자 0명일 때의 빈 상태 문구가 바뀐다. 일정 상세 `E-2p`의 표시는 바뀌지 않는다.
- 검증 범위: 백엔드는 `DomainNotificationRoutingServiceTest`, `EventReminderServiceTest`,
  `EventReminderIntegrationTest`, `CalendarEventTest`, `AiCallCalendarToolServiceIntegrationTest`와
  `participants_specified`를 참조하는 `GroupApiTest`·`GroupMemberApiTest`·`UserApiTest`.
  프론트엔드는 `CalendarParticipantModal.test.tsx`(신규)와 `CalendarEventFormScreen.test.tsx`,
  그리고 `npm test -- --runInBand`·`typecheck`·`lint`·`check:structure`.
  **주의: `EventReminderIntegrationTest`의 다수 케이스가 참여자 없는 픽스처를 쓴다.** 1항 적용 후
  이 케이스들은 "수신자 0명"이 되어 `allSatisfy`·`isEmpty` 계열 단언이 조용히 통과한다. 픽스처에
  참여자를 주입하지 않으면 검증이 무의미해진다.
- 커버리지 갱신 후보: `docs/specs/COVERAGE.md`의 REQ-026 행 비고. "지정 참여자가 모두 이탈해도
  그룹 전체로 확대하지 않음"은 유지되나 "참여자 없으면 전원" 전제가 사라진다.
- `docs/requirements.md`(REQ-026)와 `docs/user-flow.md`는 원본 요구사항 스냅샷이므로 수정하지
  않는다.

## 확인이 필요한 질문

- `CHG-S15P11B104-122` 6항("참여자를 지정한 일정에서 활성 참여자가 없으면 아무에게도 보내지
  않는다")과의 관계를 확인 필요. 이번 제안 1항이 그 결론을 포함하면서 "지정했는지" 조건 자체를
  없애므로, 122가 아직 승인되지 않은 상태에서 두 제안이 같은 문장을 다르게 고치게 된다. 122를
  먼저 승인해 반영한 뒤 이번 제안을 얹을지, 이번 제안이 6항을 대체하는 것으로 볼지 결정이 필요하다.
- 참여자 0명 일정을 저장할 때 사용자에게 확인을 받을지 확인 필요. 지금은 경고 없이 저장되고
  아무 알림도 발생하지 않는다. 이번 범위에는 빈 상태 문구 변경만 넣었고 저장 시 확인창은 넣지
  않았다.
- 그룹에 새로 가입한 구성원의 취급을 재확인 필요. 참여자로 명시되지 않으므로 기존 일정의 알림을
  받지 않는다. 기존 규칙에서는 참여자 미지정 일정의 알림을 받았다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
