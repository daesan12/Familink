# 게시글 AI 분석 모델 라우팅과 미디어 MIME 전달 경계

- 상태: 제안
- 제안 유형: SHARED_CONTRACT_CHANGE
- 작성일: 2026-07-29
- 공식 스펙 반영: 승인 전까지 반영하지 않음
- 관련 작업: S15P11B104-140, S15P11B104-130

## 기존 기준

- 이미지·영상 게시글은 `gemini-3.5-flash`를 사용한다.
- 텍스트 전용 게시글의 모델은 미결정 상태다.
- `post_media`에는 미디어 URI와 종류가 있지만 MIME 컬럼은 없다.
- 분석 실행·결과 저장 경계는 130 연계 서비스에서 제공될 예정이다.

## 제안 내용

- 텍스트 전용 게시글은 `gemini-2.5-flash-lite`를 사용한다.
- 본문이 있더라도 이미지 또는 영상이 포함되면 `gemini-3.5-flash`를 우선 사용한다.
- 140의 `PostContentAnalysisService.analyze(postId)`가 게시글을 조회하고, `display_order` 오름차순으로 미디어를 조회한 뒤 MIME을 결합하여 `PostContentAnalyzer`에 전달한다.
- 140은 게시글 조회·미디어 정렬·MIME 결합·Gemini 분석과 PostgreSQL 통합 테스트를 책임진다.
- 130은 분석 상태와 결과 요약을 `post_analyses`에 저장하는 책임을 유지한다. 140에는 저장 로직을 중복 구현하지 않는다.
- 외부 HTTP API는 추가하지 않는다. 130의 내부 호출자가 140의 분석 진입점을 사용한다.
- 140의 `PostContentAnalysisService`가 130의 `PostAnalysisGateway`를 구현하여 Scheduler부터 분석 결과 저장까지 내부 Spring 빈으로 연결한다.

## MIME 메타데이터 경계

- `MediaMimeTypeProvider`를 내부 인터페이스로 둔다.
- Provider는 신뢰할 수 있는 업로드·스토리지 메타데이터에서 `mediaUri`에 대응하는 MIME을 반환한다.
- URL 확장자로 MIME을 추측하지 않으며 `post_media`에 MIME 컬럼을 임의로 추가하지 않는다.
- 텍스트 전용 분석은 Provider 없이 수행할 수 있다.
- 미디어 분석에서 Provider가 없거나 MIME이 누락·공백·미디어 종류와 불일치하면 Gemini Gateway를 호출하지 않고 `INVALID_INPUT`으로 처리한다.
- Provider 조회 자체의 외부 오류는 `UPSTREAM_FAILURE`로 변환한다.
- 운영 Provider는 게시글 등록 시 허용된 S3 URI를 bucket과 object key로 변환하고, S3 `HeadObject` 메타데이터의 `Content-Type`을 사용한다.
- 기본 AWS S3 URL, 설정된 path-style endpoint 및 명시적으로 허용된 CDN 호스트를 지원한다.
- 잘못됐거나 허용되지 않은 URI와 빈 object key는 MIME을 제공하지 않으며, S3 객체 조회·권한·자격 증명 오류는 `UPSTREAM_FAILURE`로 처리한다.
- URL 확장자 추측, 파일 바이트 탐지, MIME 캐시와 별도 재시도는 이 변경에 포함하지 않는다.

## GMS 호출 경계

- `GMS_API_KEY`는 Google Generative Language API의 직접 호출 키가 아니라 SSAFY GMS 프록시 인증 키로 사용한다.
- 기본 호출 주소는 `https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com`이며 API 버전 `v1beta`와 모델 경로를 결합한다.
- 인증은 URL의 `?key=`가 아니라 `x-goog-api-key` HTTP 헤더로 전달한다.
- 기본 주소는 `GMS_API_BASE_URL` 설정으로 교체할 수 있으며, 자동 테스트는 실제 GMS 프록시와 키를 사용하지 않는다.

## 검증 범위

- 단위 테스트에서 모델명, 본문, 미디어 순서, URI, MIME 및 Gateway 미호출 조건을 검증한다.
- PostgreSQL Testcontainers 통합 테스트에서 실제 `PostRepository`, `PostMediaRepository`, 140 분석 서비스 및 Gemini Mock Gateway를 사용한다.
- Scheduler부터 130 저장 서비스, 140 분석 서비스, S3 MIME Provider까지 실제 Spring 빈을 연결하고 S3 Client와 Gemini Gateway만 Mock으로 교체한다.
- 통합 테스트는 기존 `IntegrationTest`와 Flyway 마이그레이션·Ryuk 정리 구조를 재사용하고, `test` 프로필 및 Testcontainers JDBC URL을 검증한다.
- 실제 Gemini API, 네트워크 및 `GMS_API_KEY`는 자동 테스트에서 사용하지 않는다.

## 변경 근거

- 현재 `PostMedia`와 `post_media`에는 MIME 컬럼이 없으므로, URL 추측이나 임의 스키마 변경은 계약을 약화한다.
- 140의 범위가 게시글 ID에서 분석 입력을 조립하여 Gemini 분석까지 수행하는 것으로 확장되었으므로, DB 조회 및 통합 검증을 130 대기 조건으로 남기지 않는다.
- `post_analyses` 저장은 130의 책임으로 유지하여 저장 로직 중복을 방지한다.

## 승인 전 확인 사항

- 없음. 본 문서는 제안 상태이며 공식 스펙은 별도 승인 후에만 수정한다.

## 결정 및 반영

- 결정: 제안 상태로 기록한다.
- 결정자: 사용자
- 결정일: 2026-07-29
- 반영 문서: 없음
- 반영 커밋: 없음
