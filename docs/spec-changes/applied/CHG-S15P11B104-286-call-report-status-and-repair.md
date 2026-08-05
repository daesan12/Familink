# 건별 리포트 상태 조회와 선별 운영 복구 계약

- 상태: 승인·반영 완료
- 제안자: 이종철
- 작성일: 2026-08-04
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/domains/REPORTS.md` (`AI 작업 컨텍스트`, `확정된 동작`, `예외`, `구현 규칙`, `인수 조건`),
  `docs/specs/contracts/API.md` (`API-REPORTS-003`, 신규 `API-REPORTS-004`),
  `docs/specs/contracts/DATA_MODEL.md` (`call_report_generation_requests` 상태 전이),
  `docs/specs/UI_AND_NAVIGATION.md` (건별 리포트 상세 상태 표시)
- 관련 작업: S15P11B104-286
- 관련 제안: `docs/spec-changes/pending/CHG-S15P11B104-123-report-query-response-details.md`
  (`API-REPORTS-003`의 기존 404 경계와 보호자 권한을 다루며 새 상태 API는 포함하지 않음),
  `docs/spec-changes/applied/CHG-S15P11B104-237-transcript-integrity-reconciliation.md`
  (durable generation request와 `GEMINI_FAILED` 자동 재시도 금지를 확정)

## 기존 내용

`docs/specs/contracts/API.md` 「리포트·카네이션」은 건별 리포트 상세 조회만 정의한다.

> | `API-REPORTS-003` | `GET /call-sessions/{callSessionId}/report` | Spring Boot · 같은 그룹 활성 보호자 | path `callSessionId` | `200`: `callSessionId`, `summary`, `guardianMessage`, `createdAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 CALL_REPORT_NOT_READY` |

`docs/specs/domains/REPORTS.md` 「예외」는 리포트가 아직 준비되지 않았을 때
`CALL_REPORT_NOT_READY`를 사용하고, Gemini 실패는 다음과 같이 확정한다.

> Gemini 호출이 실패하거나 30초 총 제한시간을 넘으면 성공 리포트를 저장하지
> 않는다. 건별 요청은 `GEMINI_FAILED`로 확정하고 자동 재시도하지 않는다.

같은 문서 「구현 규칙」은 다음 범위를 둔다.

> 건별·일일 리포트에는 이 티켓에서 새로운 수동 재시도 API나 관리 화면을 추가하지 않는다.

따라서 현재 공용 계약만으로는 리포트가 없는 이유가 실제 생성 중인지,
`GEMINI_FAILED`인지, 생성 대상이 아니어서 영구히 만들 수 없는지 보호자 화면이
구분할 수 없다. 또한 `GEMINI_FAILED` 또는 누락된 durable request를 운영자가
선별 복구할 수 있는 예외 절차도 공식 계약에 없다.

## 제안 내용

1. 신규 `API-REPORTS-004` `GET /call-sessions/{callSessionId}/report/status`를
   추가한다. 요청자는 `API-REPORTS-003`과 동일하게 해당 통화의 피보호자와 같은
   그룹에 속한 현재 활성 보호자여야 한다. 존재하지 않거나 접근할 수 없는 통화는
   리소스 존재를 노출하지 않고 기존 리포트 조회와 동일하게 `403 FORBIDDEN`으로
   응답한다.

2. 성공 응답은 `200`과 다음 데이터만 반환한다.

   ```text
   { callSessionId, status }
   ```

   `status`는 다음 공개 enum 중 하나다.

   - `READY`: `call_reports` 행이 존재한다.
   - `GENERATING`: 리포트는 없지만 durable request가 `PENDING` 또는 `CLAIMED`이거나,
     현재 전사 reconciliation 경로가 리포트 request를 만들 수 있는 상태다.
   - `FAILED`: durable request가 `GEMINI_FAILED`다.
   - `UNAVAILABLE`: 리포트가 없고 현재 자동 생성·복구 경로도 남아 있지 않다.

   내부 실패 코드, 전사 원문, claim token과 같은 운영 정보는 응답에 포함하지 않는다.

3. 기존 `API-REPORTS-003`의 성공 응답과 `404 CALL_REPORT_NOT_READY` 계약은
   변경하지 않는다. 보호자 앱은 상태 API로 상태를 확인하고 `READY`일 때만 기존
   상세 API를 호출한다.

4. 보호자 화면은 `GENERATING`을 5초 간격으로 최대 90초 동안 다시 조회한다.
   `READY`가 되면 상세 리포트를 표시하고, 90초가 지나도 생성 중이면 실패로
   단정하지 않고 `처리가 예상보다 오래 걸리고 있어요`와 `상태 다시 확인` 동작을
   제공한다. `FAILED`, `UNAVAILABLE`, 네트워크 조회 오류는 서로 다른 상태로
   표시한다. `상태 다시 확인`은 상태 조회만 다시 수행하며 generation request를
   변경하지 않는다.

5. 사용자용 재생성 API, 관리 화면, `GEMINI_FAILED` 자동 스캔은 추가하지 않는다.
   다만 장애 원인이 제거된 뒤 운영자가 명시한 개별 `callSessionId`에 한해 다음
   조건을 모두 검증한 일회성 선별 복구를 허용한다.

   - 세션 상태가 `COMPLETED`다.
   - 전사 무결성이 `COMPLETE`이고 `transcript_finalized_at`이 존재한다.
   - 공백이 아닌 저장 전사가 한 건 이상이고 모든 전사 원장 이벤트가 `APPLIED`다.
   - 기존 `call_reports` 행이 없다.

   조건을 만족하면서 durable request가 없으면 현재 `transcript_revision`으로
   `PENDING`을 생성한다. request가 `GEMINI_FAILED`면 운영 GMS 설정과 실제 호출을
   검증한 뒤 해당 request만 claim·실패 메타데이터를 지우고 현재 revision의
   `PENDING`으로 되돌린다. 세션과 request의 잠금 순서는 기존 생성 경로와 같이
   세션 뒤 request로 고정한다.

6. `INCOMPLETE`, `CANCELLED`, `FAILED` 세션과 불완전하거나 미확정인 전사는
   선별 복구 대상에서 제외한다. 과거 `INCOMPLETE`를 `COMPLETED`로 변환하거나
   조건 없이 일괄 backfill하지 않는다. 기존 자동 복구 스케줄은 계속
   `PENDING`과 만료 `CLAIMED`만 접수한다.

## 변경 근거

- S15P11B104-286 원인 분석에서 Android `AiCallRuntime`이 사용자 종료 시 로컬
  WebRTC를 먼저 닫고 서버 `/end USER_REQUESTED`를 나중에 호출하는 순서를 확인했다.
  이 경합으로 Sideband disconnect가 먼저 처리되면 세션은 `INCOMPLETE`가 되고,
  늦은 사용자 종료는 이를 되살리지 않아 durable generation request가 생기지 않는다.
- 현재 프런트엔드 `reportGateway`는 모든 `404 CALL_REPORT_NOT_READY`를
  `generating`으로 변환하고 상세 모달은 다시 조회하지 않으므로 request 누락과
  `GEMINI_FAILED`도 무기한 생성 중으로 표시한다.
- 사용자는 2026-08-04 구현 계획에서 생성 중·실패·생성 불가를 구분하는 상태 조회,
  5초·90초의 제한된 polling, 사용자·서버 자동 재생성 제외, 안전 조건을 만족하는
  `COMPLETED` 통화의 선별 운영 복구를 명시했다.
- Android 종료 순서를 서버 요청 후 로컬 close로 바꾸는 것은 기존 정상 종료 목표를
  충족하지 못한 `IMPLEMENTATION_GAP`이며 이 제안의 계약 변경 대상은 아니다.

## 확인된 영향

- 영향 도메인: 건별 리포트 생성·조회, 전사 복구 상태 판정, 운영 장애 복구
- 영향 계약: 신규 `API-REPORTS-004`, generation request의 운영자 선별 복구 상태 전이
- 영향 화면: 보호자 리포트 탭의 건별 리포트 상세 모달
- 검증 범위: 상태 API 네 상태와 권한, Android 종료 순서, polling 종료와 stale 응답 차단,
  기존 `API-REPORTS-003` 회귀, 선별 복구 사전조건과 멱등성, 건별 리포트 생성 후
  일일 리포트 입력 연결
- DB 스키마: 변경 없음. 기존 `call_sessions`, `call_transcript_events`,
  `call_transcripts`, `call_report_generation_requests`, `call_reports`를 사용한다.
- 배포 설정: 운영 `GMS_API_KEY` 누락을 시작 시점에 차단하는 fail-fast 구현은
  기존 Gemini 생성 목표를 보장하는 구현 안전장치이며 공용 API·DB 계약을 바꾸지 않는다.

## 결정 및 반영

- 결정: 전체 승인. 신규 상태 조회 API, `READY`·`GENERATING`·`FAILED`·`UNAVAILABLE` 의미,
  5초 간격·최대 90초 polling, 사용자·자동 재생성 제외, 안전 조건을 만족하는
  `COMPLETED` 통화의 운영자 선별 복구를 모두 적용한다.
- 결정자: 사용자
- 결정일: 2026-08-04
- 반영 문서: `docs/specs/domains/REPORTS.md`, `docs/specs/contracts/API.md`,
  `docs/specs/contracts/DATA_MODEL.md`, `docs/specs/UI_AND_NAVIGATION.md`,
  `docs/specs/COVERAGE.md`
- 반영 커밋: 미커밋
