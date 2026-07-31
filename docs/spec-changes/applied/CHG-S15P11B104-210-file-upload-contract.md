# 파일 업로드 목적·개수·검증·서명 응답 계약 확정

- 상태: 승인·반영 완료
- 제안자: Codex
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `API-FILES-001`, `FEED_AND_MEDIA`, `ACCOUNT_AND_PROFILE`
- 관련 작업: `S15P11B104-210` F1·F3·F4·F6
- 관련 제안: [`CHG-20260730-unknown-media-upload-limits.md`](../pending/CHG-20260730-unknown-media-upload-limits.md), [`CHG-S15P11B104-116-profile-partial-update.md`](../pending/CHG-S15P11B104-116-profile-partial-update.md)

## 기존 내용

`docs/specs/contracts/API.md`의 `API-FILES-001`은
`purpose`, `files[{fileName,contentType,sizeBytes}]`를 받고
`uploads[{uploadUrl,fileUrl,headers,expiresAt}]`를 `201`로 반환한다고만
정의한다. 같은 문서의 「계약상 미결정」에는 `purpose` 값, MIME 허용 목록과
파일별 최대 크기가 미결정으로 남아 있다.

`docs/specs/domains/FEED_AND_MEDIA.md`는 게시글 미디어를 사진 1~4장 또는
영상 1개로 제한하고 사진·영상을 함께 첨부하지 않는다고 정하지만,
presigned URL 요청 단계에서 이 개수와 조합을 어떻게 검증할지는 정하지
않는다. 프로필 이미지 업로드 개수, 요청 필드 검증과 `headers`·`expiresAt`
사용 규칙도 공식 계약에 없다.

## 제안 내용

### F1. `purpose`

- 허용값은 정확히 `post-media`, `profile-image` 두 개다.
- 알 수 없는 값은 `400 INVALID_REQUEST`로 거부한다.
- 서버 object key는 각각 `post-media/`, `profile-image/` 아래에 만든다.

### F3. 요청당 파일 개수와 조합

- `post-media`는 이미지 1~4개 또는 영상 정확히 1개만 허용한다.
- 한 요청에서 이미지와 영상을 섞지 않는다.
- `profile-image`는 이미지 정확히 1개만 허용한다.
- 빈 `files`, 최대 개수 초과, 혼합 미디어, 프로필 다중 파일은 모두
  `400 INVALID_REQUEST`다.

### F4. 요청 필드 검증

- `fileName`은 공백이 아닌 1~255자이며 경로 구분자와 제어 문자를 허용하지
  않는다.
- `contentType`은 서버가 공백·대소문자·선택 매개변수를 정규화한 표준 MIME
  값으로 검증하고, 같은 정규화 값을 서명과 응답 `headers`에 사용한다.
- `sizeBytes`는 0보다 커야 하며 해당 `purpose`·MIME의 최대 크기를 넘지
  않아야 한다.
- 모든 위반은 새 오류 코드를 만들지 않고 `400 INVALID_REQUEST`와 공통
  실패 봉투를 사용한다. 필드 단위 원인이 있으면 `errors[{field,message}]`에
  기록한다.

MIME·크기의 정확한 값은 관련 제안
`CHG-20260730-unknown-media-upload-limits.md`의 F2 범위를 따른다.

### F6. 업로드 서명 응답

- PUT 요청의 `Content-Type`은 필수다.
- 클라이언트는 각 `uploads[]`에 반환된 `headers`의 모든 이름과 값을
  업로드 요청에 그대로 포함한다. 현재 필수 헤더는 정규화된
  `Content-Type`이다.
- `expiresAt`은 ISO-8601 UTC 절대 시각이며 발급 시각으로부터 10분 뒤다.
- `headers`를 빠뜨리거나 다른 값으로 보내 서명이 맞지 않는 업로드는
  성공한 것으로 간주하지 않는다.

프로필 업로드 결과를 `API-USERS-002`와 연결하는 F5는 관련 제안
`CHG-S15P11B104-116-profile-partial-update.md`에서 다룬다.

## 변경 근거

- 2026-07-31 사용자는 F1·F3·F4·F6을 권장안대로 결정했다.
- 현재 `API-FILES-001`은 문자열 `purpose`와 비어 있지 않은 파일 목록만
  표현해 용도 오타, 혼합 미디어와 프로필 다중 파일을 계약만으로 막을 수
  없다.
- 현재 S3 presigned PUT 구현은 `Content-Type`을 서명하고 같은 값을 응답
  `headers`에 담으며 기본 만료 시간을 10분으로 사용한다.
- F2의 MIME·크기와 F5의 프로필 부분 수정은 기존 pending 제안과 중복되므로
  이 파일에서 다시 결정하지 않는다.

## 확인된 영향

- 영향 도메인: 피드 미디어 업로드, 프로필 이미지 업로드
- 영향 계약: `API-FILES-001`, `API-USERS-002`
- 영향 화면: 게시글 미디어 선택·업로드, 프로필 이미지 선택·업로드
- 검증 범위: purpose별 개수·조합, 필드 검증, MIME 정규화, 반환 헤더 재사용,
  UTC 만료 시각

## 결정 및 반영

- 결정: 승인(전체). `S15P11B104-210`의 F1·F3·F4·F6을 제안 내용대로
  반영한다.
- 결정자: 사용자
- 결정일: 2026-07-31
- 반영 문서: `docs/specs/contracts/API.md`,
  `docs/specs/domains/FEED_AND_MEDIA.md`,
  `docs/specs/domains/ACCOUNT_AND_PROFILE.md`, `docs/specs/COVERAGE.md`
- 반영 커밋: `121cf0c2120d4e2514afc3a0566eae95efd7afc7`
