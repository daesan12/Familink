# Presigned PUT 서명에 Content-Length 포함 및 응답 헤더 추가

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-02
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md` `API-FILES-001` (구현 규칙 L212-217), `docs/specs/domains/FEED_AND_MEDIA.md` 구현 규칙(API)
- 관련 작업: S15P11B104-227, 통합 QA SEC-003, 관련 제안 `docs/spec-changes/pending/CHG-20260730-unknown-media-upload-limits.md`(게시글 저장 전 재검증 — 목표가 다른 별도 제안)

## 기존 내용

`docs/specs/contracts/API.md` L212-217 (`API-FILES-001` 구현 규칙):

> Spring Boot는 `contentType`의 공백·대소문자·선택 매개변수를 정규화해 표준 MIME으로 검증하고, 같은 값을 PUT 서명과 응답의 `headers.Content-Type`에 사용한다. PUT의 `Content-Type`은 필수이며 클라이언트는 반환된 모든 헤더 이름과 값을 그대로 사용한다. `expiresAt`은 발급 시각 10분 뒤의 ISO-8601 UTC 절대 시각이다. 반환 헤더가 빠졌거나 값이 다른 업로드는 성공으로 간주하지 않는다.

- 서명·응답 헤더로 규정된 값은 `Content-Type`뿐이다.
- 선언한 `sizeBytes`는 발급 시 검증에만 쓰이고, 실제 업로드 본문 크기를 서명으로 강제한다는 규칙과 그 실패 모드는 없다.

## 제안 내용

- 서버는 presigned PUT 서명에 선언된 `sizeBytes`를 `Content-Length`로 포함하고, 응답 `headers`에 `Content-Length`(= `sizeBytes` 문자열)를 추가로 반환한다.
- 실제 업로드 본문의 바이트 수가 선언한 `sizeBytes`와 다르면 스토리지(S3)가 해당 PUT을 서명 불일치로 거부한다(HTTP 403). 클라이언트는 실제 업로드할 파일의 바이트 수를 `sizeBytes`로 선언해야 한다.
- 목적: 발급 시 통과한 크기 제한을 실제 업로드가 우회하는 경로(SEC-003 — 소용량 신고 후 대용량 업로드)를 스토리지 계층에서 차단한다.

## 변경 근거

- 통합 QA `docs/qa/2026-08-02-release-code-qa.md` SEC-003: "실제 PUT body 크기가 선언 크기에 묶이지 않음"을 결함으로 확인하고 저장소 계층의 실제 크기 강제를 수정 가이드로 제시.
- Jira S15P11B104-227 완료 기준: "실제 객체 크기 검증을 우회하는 테스트가 실패하도록 고정된다."
- 구현: `backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/S3PresignedUploadProvider.java`가 `PutObjectRequest.contentLength(sizeBytes)`로 서명하고 응답 `headers`에 `Content-Length`를 추가. `backend/src/test/java/com/ssafy/s15p11b104/domain/file/S3PresignedUploadProviderTest.java`가 `X-Amz-SignedHeaders`에 `content-length` 포함을 고정.
- 기존 계약도 "클라이언트는 반환된 모든 헤더 이름과 값을 그대로 사용한다"라고 규정하므로 헤더 추가 자체는 클라이언트 동작 규칙 안에 있으나, 크기 불일치 시 403이라는 새 실패 모드는 계약에 명시돼 있지 않다.

## 확인된 영향

- 영향 도메인: 파일 업로드(피드 미디어, 프로필 이미지)
- 영향 계약: `API-FILES-001` 응답 `headers` 구성과 업로드 실패 모드
- 영향 화면: 게시글 작성(`frontend/src/features/feed/screens/PostComposerScreen.tsx`), 프로필 이미지 변경(`frontend/src/features/profile/api/profileApi.ts`)
- 검증 범위: `backend` file 도메인 단위·통합 테스트는 통과. 실제 S3(또는 호환 스토리지) 대상 업로드로 이미지·영상 성공, 크기 불일치 403을 확인하는 검증은 **확인 필요**.
- 프런트 리스크(확인 필요): 게시글 작성 경로가 picker가 준 `asset.fileSize`를 `sizeBytes`로 선언하고 본문은 `fetch(uri).blob()`으로 읽는다(`frontend/src/features/feed/screens/PostComposerScreen.tsx:118`, `frontend/src/features/feed/api/postApi.ts:39-48`). 두 값이 어긋나는 단말·포맷이 있으면 기존에 성공하던 업로드가 403으로 실패한다. 승인 시 프런트가 실제 업로드 본문의 바이트 수(`blob.size`)를 `sizeBytes`로 선언하도록 정리가 필요하다.

## 확인이 필요한 질문

- 크기 불일치 403 실패 모드를 계약에 명시하고 수용할지, 아니면 스토리지 크기 강제를 다른 방식(업로드 후 HeadObject 검증 등)으로 대체할지.
- 프런트 `sizeBytes` 선언 기준을 실제 업로드 본문 크기로 통일하는 작업의 티켓 분리 여부.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
