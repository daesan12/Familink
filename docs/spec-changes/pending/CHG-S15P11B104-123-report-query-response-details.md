# 리포트 조회 API의 통화 목록 범위·달력 기준·직렬화 형식·오류 경계 확정

- 상태: 제안
- 제안자: rudgh8182
- 작성일: 2026-07-31
- 차단 변경: 아니오 (경로·요청·응답 필드 구성은 그대로다. 응답 값의 범위·형식과 오류 코드 선택 기준을 확정한다.)
- 영향 스펙·계약: `docs/specs/domains/REPORTS.md` (「확정된 동작」, 「예외」, 「미결정 사항」),
  `docs/specs/contracts/API.md` (`API-REPORTS-001`, `API-REPORTS-002`, `API-REPORTS-003`),
  `docs/specs/COMMON.md` (리포트 조회 권한)
- 관련 작업: S15P11B104-123
- 관련 제안: `docs/spec-changes/applied/CHG-S15P11B104-139-daily-report-window.md`
  (집계 구간을 확정하고 조회 API를 123 범위로 남긴 제안),
  `docs/spec-changes/pending/CHG-S15P11B104-114-common-response-envelope.md`
  (성공 `message` 문구 목록에서 리포트를 제외하고 미결정으로 남긴 제안)

## 기존 내용

`docs/specs/contracts/API.md` 「리포트·카네이션」은 세 API의 경로·요청·응답 필드와 오류를 확정한다.

> | `API-REPORTS-001` | `GET /groups/{groupId}/care-receivers/{memberId}/reports/calendar` | … query `year`, `month` | `200`: `yearMonth`, `reportDates[]` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN` |
> | `API-REPORTS-002` | `GET /groups/{groupId}/members/{memberId}/reports/daily/{reportDate}` | … | `200`: `date`, `dailyReport{…}` 또는 `dailyReport=null`, `calls[{callSessionId,startedAt,reportAvailable}]` | `400`; `401`; `403` |
> | `API-REPORTS-003` | `GET /call-sessions/{callSessionId}/report` | … | `200`: `callSessionId`, `summary`, `guardianMessage`, `createdAt` | `400`; `401`; `403`; `404 CALL_REPORT_NOT_READY` |

`docs/specs/domains/REPORTS.md` 42행:

> 권한: 같은 그룹의 활성 보호자만 피보호자 리포트를 조회할 수 있다.

같은 문서 37행:

> 건별 리포트가 아직 준비되지 않았으면 [API 계약](../contracts/API.md)의 준비 전 오류를 사용한다.

같은 문서 「확정된 동작」 2항:

> `COMPLETED` 통화는 건별 리포트 생성 대상이다. `INCOMPLETE` 통화는 전사가 충분할 때만 생성하며,
> 충분함의 기준은 미결정이다. `CANCELLED`·`FAILED` 통화에는 생성하지 않는다.

`docs/specs/COMMON.md` 13행:

> AI 전화는 피보호자만 사용하고, AI 리포트는 보호자만 조회한다.

다음 항목은 어느 공식 스펙에도 정의되어 있지 않다.

- `calls[]`에 어떤 통화 상태를 포함하는지. 계약은 필드명 세 개만 정하고 대상 범위를 말하지 않는다.
- `reportDates[]`가 일일 리포트 존재일 기준인지 통화 존재일 기준인지.
- `yearMonth`·`reportDates[]`·`date`의 직렬화 형식, `year`·`month` 범위 검증 규칙.
- 리포트 API 3종의 성공 `message` 문구. `API.md`의 확정 문구 목록에 리포트가 없고,
  `CHG-S15P11B104-114-common-response-envelope.md`가 나머지 API의 문구를 미결정으로 남겼다.
- 존재하지 않는 `groupId`·`memberId`·`callSessionId`, 다른 그룹 대상, 대상이 보호자인 경우의 오류 코드.
  001·002에는 404가 아예 없고, 003의 404는 `CALL_REPORT_NOT_READY` 하나뿐이다.
- 피보호자 본인이 자기 리포트를 조회할 수 있는지. `REPORTS.md` 42행은 보호자만 언급하고
  `API-INTERESTS-001`처럼 "대상 본인 또는" 형태의 예외를 두지 않는다.

## 제안 내용

1. **`calls[]`는 `COMPLETED` 통화만 포함한다.** 리포트가 생기는 통화만 보여줘야
   `reportAvailable`이 "리포트 생성이 아직 진행 중"이라는 하나의 뜻을 갖는다. `CANCELLED`·`FAILED`
   통화는 리포트 생성 대상이 아니므로 목록에 두면 보호자가 영구히 열 수 없는 항목을 보게 된다.

2. **`reportDates[]`는 해당 월에 `daily_reports` 행이 있는 `report_date`만 반환한다.** 달력에서 표시된
   날짜를 고르면 항상 일일 리포트가 있다. 통화만 있고 리포트가 없는 날은 표시하지 않는다.

3. **직렬화 형식과 검증을 다음으로 정한다.**
   - `yearMonth`는 `"2026-07"` 형식의 문자열이다(`java.time.YearMonth` 표준 표기).
   - `reportDates[]`의 각 원소와 `API-REPORTS-002`의 `date`는 `"2026-07-15"` 형식의 ISO-8601 날짜다.
   - `month`가 1~12를 벗어나거나 `year`·`month`가 정수가 아니면 `400 INVALID_REQUEST`다.
   - `reportDate` 경로 변수가 ISO-8601 날짜가 아니면 `400 INVALID_REQUEST`다.

4. **성공 `message` 문구를 다음으로 정한다.** `API-REPORTS-001`은 `리포트 달력 조회 성공`,
   `API-REPORTS-002`는 `일일 리포트 조회 성공`, `API-REPORTS-003`은 `통화 리포트 조회 성공`.

5. **404를 새로 만들지 않고 권한·대상 문제를 모두 `403 FORBIDDEN`으로 응답한다.** 다음 경우가 모두
   `403`이다.
   - 요청자가 해당 그룹의 활성 구성원이 아니거나 보호자가 아니다.
   - `memberId`가 존재하지 않거나, 다른 그룹의 구성원이거나, 이미 탈퇴했다.
   - `memberId`가 피보호자가 아니다.
   - (`API-REPORTS-003`) `callSessionId`가 존재하지 않거나 요청자가 접근할 수 없는 그룹의 통화다.

   `404 CALL_REPORT_NOT_READY`는 **통화에는 접근할 수 있으나 건별 리포트가 아직 저장되지 않은
   경우에만** 사용한다. 이 경계를 두는 이유는 리소스 존재 여부를 권한 없는 요청자에게 알리지 않기
   위해서이며, `API.md`가 계약에 없는 오류 코드를 임의로 추가하지 못하게 한 규칙과도 맞는다.

6. **피보호자 본인은 자기 리포트를 조회할 수 없다.** `COMMON.md` 13행의 "AI 리포트는 보호자만
   조회한다"를 그대로 적용하며, 세 API 모두 요청자가 활성 보호자일 때만 허용한다.

## 변경 근거

- 1·2항은 2026-07-31 세션에서 사용자(rudgh8182)가 S15P11B104-123 구현 방향을 확정한 결정이다.
- 3·4항은 계약에 형식·문구 정의가 없어 구현에서 정한 값이다. 팀 확정 결정이 아니라 제안이다.
- 5항은 `API.md`가 001·002에 404를 두지 않았고 계약에 없는 오류 코드 추가를 금지하므로, 계약이
  허용하는 범위에서 선택한 해석이다. 기존 `CalendarEventService`가 같은 상황에서 같은 판단을 내리고
  그 근거를 코드에 기록해 둔 선례가 있다.

  > 계약이 명시한 오류는 `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`뿐이므로 존재하지 않는
  > 일정도 `FORBIDDEN`으로 응답해 리소스 존재 여부를 노출하지 않는다.

- 6항은 `COMMON.md` 13행과 `REPORTS.md` 42행의 직해다. 같은 저장소의
  `MemberInterestService.validateReadPermission`은 대상 본인 조회를 허용하는데, 리포트에는 그런 예외
  문장이 없어 재사용하지 않았다.

구현 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/report/controller/ReportController.java`,
`.../domain/report/service/ReportQueryService.java`, `.../domain/report/dto/` 5개 record,
`.../global/exception/ErrorCode.java`의 `CALL_REPORT_NOT_READY`.

## 확인된 영향

- 영향 도메인: 리포트
- 영향 계약: `API-REPORTS-001`·`002`·`003`의 응답 값 범위·형식과 오류 코드 선택 기준. 경로·요청
  파라미터·응답 필드 구성은 바뀌지 않는다. DB 스키마 변경 없음(새 마이그레이션 없음).
- 영향 화면: 리포트 달력과 일일 리포트 화면. 달력에 표시되는 날짜와 통화 목록에 나타나는 항목이
  이 제안의 1·2항에 따라 결정된다.
- 검증 범위: 이 제안의 내용은 S15P11B104-123에 **이미 구현되어 있고** 전체 테스트 563건이
  통과했다(`ReportApiTest` 21건 포함). 따라서 제안이 일부라도 반려되면 문서가 아니라 코드를 고쳐야
  한다.
- FE 영향은 `확인 필요`다. 리포트 화면 구현이 시작되었는지, 3·4항의 형식·문구를 이미 가정하고
  있는지 확인하지 못했다.

## 확인이 필요한 질문

- **`INCOMPLETE` 통화의 건별 리포트가 화면에서 도달 불가능해지는 문제.** `REPORTS.md` 2항은
  `INCOMPLETE` 통화도 전사가 충분하면 건별 리포트를 만든다고 하는데, 1항에 따라 `calls[]`가
  `COMPLETED`만 담으면 그 리포트를 열 경로가 없다. 현재 `CallReportGenerationService`는 `COMPLETED`만
  생성하므로 지금은 모순이 드러나지 않지만, "전사 충분" 기준이 확정되어 `INCOMPLETE`에도 리포트가
  생기면 `calls[]` 범위를 함께 넓혀야 한다.
- 3항의 형식과 4항의 문구를 그대로 쓸지, 팀이 다른 값을 정할지.
- 5항에서 존재하지 않는 대상과 권한 없는 대상을 구분하지 않는 것을 허용할지. 구분이 필요하면
  `API-GROUPS-015`처럼 404를 계약에 추가하는 별도 변경이 필요하다.

## 별개로 확인이 필요한 결함 (123 범위 밖)

`backend/src/main/java/com/ssafy/s15p11b104/domain/call/config/AiCallDevWebSecurityConfig.java`가
`/call-sessions/**` 전체를 시큐리티 필터 체인에서 제외한다.

```java
return web -> web.ignoring().requestMatchers("/", "/ai-call/**", "/call-sessions/**");
```

`API-REPORTS-003`의 계약 경로가 `/call-sessions/{callSessionId}/report`이므로, `ai-call-dev`
프로필로 실행하면 이 조회 API가 인증 없이 노출되고 `@AuthenticationPrincipal`이 `null`이 되어
권한 검사 전에 실패한다. `test`와 운영 프로필은 `SecurityConfig`의 `anyRequest().authenticated()`가
적용되므로 영향이 없다.

이 설정은 통화 모듈의 개발용 구성이므로 123에서 수정하지 않았다. `ignoring` 대상을 실제로 인증이
필요 없는 경로로 좁힐지 통화 모듈 담당자의 확인이 필요하다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
