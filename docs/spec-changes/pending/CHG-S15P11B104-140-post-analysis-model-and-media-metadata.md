# 게시글 AI 분석 모델 라우팅과 미디어 MIME 전달 경계

- 상태: 제안
- 제안 유형: SHARED_CONTRACT_CHANGE
- 작성일: 2026-07-29
- 차단 변경: 아니오 - 영향 범위 내 구현과 테스트를 진행하되 공식 스펙은 승인 전까지 수정하지 않음
- 영향 스펙·계약: `FEED_AND_MEDIA`, `DATA_MODEL`의 `post_media` 연계 규칙
- 관련 작업: S15P11B104-140, S15P11B104-130

## 기존 내용

- 이미지·영상 게시글은 `gemini-3.5-flash`를 사용한다.
- 텍스트 전용 게시글의 모델은 미결정 상태다.
- `post_media`에는 미디어 URI와 종류가 있으나 MIME 타입은 저장하지 않는다.
- `PostAnalysisService`가 게시글과 미디어를 읽어 Gemini 분석을 호출한다.

## 제안 내용

- 텍스트 전용 게시글은 `gemini-2.5-flash-lite`를 사용한다.
- 본문이 있더라도 이미지 또는 영상이 하나 이상 있으면 `gemini-3.5-flash`를 사용한다.
- `PostContentAnalyzer`의 입력은 본문과 함께 미디어별 URI, MIME 타입, 미디어 종류를 전달받는다.
- `S15P11B104-130`의 분석 실행·저장 서비스가 업로드 또는 스토리지 메타데이터에서 MIME 타입을 확보해 analyzer 호출자 책임으로 제공한다.
- URL 확장자로 MIME 타입을 추측하지 않으며, `post_media` 테이블에 MIME 컬럼을 추가하지 않는다.
- 이미지·영상 입력은 기존 규칙대로 이미지 1~4개 또는 영상 1개만 허용하고 혼합 입력은 거부한다.

## 변경 근거

- 구현 경로: `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/entity/PostMedia.java`에는 MIME 컬럼이 없으므로 분석 모듈이 URL 확장자를 추측하면 저장 계약과 실제 미디어 메타데이터가 어긋날 수 있다.
- 구현 경로: `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/entity/PostAnalysis.java`의 분석 결과는 `SUCCESS`일 때만 요약과 `analyzed_at`을 저장하고, 실패 시 둘 다 비워야 한다.
- 검증 범위: 모델명, 본문, URI, MIME, 미디어 순서를 Mock Gateway에서 직접 검증하고, 실제 저장 서비스 연계 시 동일 규칙을 PostgreSQL 통합 테스트로 확인한다.
- 결정 근거: 사용자가 승인한 S15P11B104-140 구현·테스트 계획.

## 확인 영향

- 영향 도메인: 피드·미디어·게시글 분석
- 영향 계약: Spring Boot 내부 `PostContentAnalyzer`와 S15P11B104-130 호출 경계
- 영향 화면: 없음
- 검증 범위: Gemini 분석 단위 테스트, Mock Gateway 요청 검증, Testcontainers PostgreSQL 저장 통합 테스트

## 확인이 필요한 질문

- 없음. 본 제안은 사용자 승인 구현 계획에 따른 기록이며, 공식 스펙 반영은 별도 승인 절차에서 처리한다.

## 결정 및 반영

- 결정: 제안 상태로 기록한다.
- 결정자: 사용자
- 결정일: 2026-07-29
- 반영 문서: 없음
- 반영 커밋: 없음
