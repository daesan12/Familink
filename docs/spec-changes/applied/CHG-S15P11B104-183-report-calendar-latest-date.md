# 리포트 캘린더 응답에 전체 최신 리포트 날짜 추가

- 상태: 승인·반영
- 제안자: unknown
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `REPORTS`, `API-REPORTS-001`
- 관련 작업: `S15P11B104-183`

## 기존 내용

- [`docs/specs/domains/REPORTS.md`](../../specs/domains/REPORTS.md)는 리포트 탭
  상단에 생성 완료된 가장 최신 일간 리포트를 표시하고, 당일 리포트나 통화가
  없어도 이전 최신 리포트를 유지하도록 정한다.
- [`docs/specs/contracts/API.md`](../../specs/contracts/API.md)의
  `API-REPORTS-001`은 `year`, `month`를 받아 해당 월의 `reportDates[]`만
  반환한다.
- `API-REPORTS-002`는 정확한 `reportDate` 한 날짜만 조회한다.

## 제안 내용

1. `API-REPORTS-001` 성공 결과에 해당 피보호자의 전체 일간 리포트 중 가장
   최신 날짜인 `latestReportDate: string | null`을 추가한다.
2. 일간 리포트가 한 건도 없으면 `latestReportDate`는 `null`이다.
3. 기존 `yearMonth`, `reportDates[]`의 의미와 월별 필터 동작은 유지한다.
4. 프론트엔드 `ReportGateway.getReportDates()`는 추가 필드를 보존하고,
   `latestReportDate`가 조회 기준일보다 이전이면 `API-REPORTS-002`로 해당
   날짜의 일간 리포트를 조회한다.

## 변경 근거

- 현재 구현의
  `frontend/src/features/reports/hooks/useReportPages.ts`는 기준일이 속한 달의
  `reportDates[]`에서만 최신 날짜를 고를 수 있다.
- 예를 들어 2026-08-01 기준 최신 일간 리포트가 2026-07-31이면 8월 달력
  응답만으로는 해당 날짜를 알 수 없어 `REPORTS`의 최신 리포트 유지 규칙을
  충족하지 못한다.
- 과거 월을 순차 조회하는 방식은 리포트가 한 건도 없는 사용자에게 종료
  기준이 없고, 가입 시점도 현재 리포트 Gateway 계약에서 제공하지 않아
  요청 횟수를 안전하게 제한할 수 없다.
- 기존 세 가지 리포트 Gateway 메서드를 유지하면서 응답 필드의 가산 변경만으로
  목표 동작을 구현할 수 있다.

## 확인된 영향

- 영향 도메인: 리포트
- 영향 계약: `API-REPORTS-001` 성공 응답, 프론트엔드 `ReportCalendar`
- 영향 화면: 보호자 리포트 탭의 기본 최신 일간 리포트
- 검증 범위:
  - 최신 일간 리포트가 조회 월에 있는 경우
  - 최신 일간 리포트가 이전 월에 있는 경우
  - 일간 리포트가 한 건도 없어 `latestReportDate=null`인 경우
  - 기존 월별 `reportDates[]` 조회 호환성

## 확인이 필요한 질문

- `latestReportDate`의 날짜 기준은 기존 일간 리포트 `date`와 동일한
  `Asia/Seoul` 기준 날짜로 확정할지 확인이 필요하다.

## 결정 및 반영

- 결정: 전체 승인. `latestReportDate`는 기존 일일 리포트와 같은 `report_date`의 ISO-8601 날짜를 사용한다.
- 결정자: 사용자
- 결정일: 2026-08-01
- 반영 문서: `docs/specs/domains/REPORTS.md`, `docs/specs/contracts/API.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
