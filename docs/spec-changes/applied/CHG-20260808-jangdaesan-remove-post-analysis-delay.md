# 게시글 분석 안정화 대기 제거

- 상태: 적용
- 제안자: 장대산
- 작성일: 2026-08-08
- 차단 변경: 아니오
- 영향 스펙·계약: `docs/specs/domains/FEED_AND_MEDIA.md`, `docs/specs/contracts/API.md`
- 관련 작업: 시연 환경 게시글 분석 지연 제거

## 기존 내용

`docs/specs/domains/FEED_AND_MEDIA.md`의 「확정된 동작」 8번과 `AC-003`,
`docs/specs/contracts/API.md`의 게시글 분석 설명은 게시글의 마지막 수정 후
10분 동안 변경이 없어야 Spring Scheduler가 분석 대상으로 선택한다고 정의한다.

## 제안 내용

게시글은 생성 또는 수정 직후부터 분석 대상이 될 수 있다. Spring Scheduler는
기본 3초 주기로 분석 대상을 확인하되, 게시글 버전 재확인과 single-flight claim으로
수정 중이거나 이미 처리 중인 게시글의 잘못된 결과 저장을 방지한다.

## 변경 근거

- 사용자는 2026-08-08 시연을 위해 운영 서버의 게시글 분석 10분 대기를 제거하기로 결정했다.
- 운영 서버에 별도 사용자가 없어 시연 중 즉시 분석을 우선하며, 환경별 설정 분리는 요구하지 않았다.
- 기존 코드는 `PostAnalysisService.STABILITY_DELAY`를 10분으로 고정하고 스케줄러를 기본 60초 주기로 실행한다.

## 확인된 영향

- 영향 도메인: 피드 게시글 AI 분석 대상 선정 시점
- 영향 계약: 공개 API 요청·응답 형식 변경 없음, 내부 분석 실행 시점 변경
- 영향 화면: 게시글 작성 후 AI 통화가 새 게시글 요약을 참조할 수 있는 시점이 빨라짐
- 검증 범위: 최신 수정 시각 게시글의 즉시 대상 선정, 스케줄러 기본 실행 주기, 기존 분석 성공·실패·버전 검증 회귀

## 결정 및 반영

- 결정: 전체 승인 — 10분 안정화 대기를 제거하고 기본 대상 탐색 주기를 3초로 변경
- 결정자: 사용자
- 결정일: 2026-08-08
- 반영 문서: `docs/specs/README.md`, `docs/specs/COMMON.md`, `docs/specs/domains/FEED_AND_MEDIA.md`, `docs/specs/contracts/API.md`, `docs/specs/contracts/DATA_MODEL.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
