# 사진·영상 업로드 제한 및 검증

- 상태: 일부 승인
- 제안자: 장대산
- 작성일: 2026-07-30
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/domains/FEED_AND_MEDIA.md`, `docs/specs/domains/ACCOUNT_AND_PROFILE.md`, `docs/specs/contracts/API.md`
- 관련 작업: S3 실제 업로드·게시글 미디어 E2E 검증, `S15P11B104-210` F2

## 기존 내용

사진·영상의 파일 용량, 영상 길이, 미디어 형식과 코덱 검증은 미결정 상태다.

## 제안 내용

### `S15P11B104-210` F2에서 결정된 MIME·크기

- `post-media` 이미지는 파일 1개당 최대 10 MiB(10,485,760 bytes)로
  제한하고 `image/jpeg`, `image/png`, `image/webp`만 허용한다.
- `post-media` 영상은 파일 1개당 최대 100 MiB(104,857,600 bytes)로
  제한하고 `video/mp4`만 허용한다.
- `profile-image`는 파일 1개당 최대 10 MiB(10,485,760 bytes)로
  제한하고 `image/jpeg`, `image/png`, `image/webp`만 허용한다.
- 백엔드 presigned URL 발급 단계의 목적·개수·MIME·크기·요청 필드 검증은
  적용 완료된
  [`CHG-S15P11B104-210-file-upload-contract.md`](../applied/CHG-S15P11B104-210-file-upload-contract.md)
  범위를 따른다.

### 아직 별도 승인이 필요한 기존 제안

- 영상은 최대 60초로 제한한다.
- 프론트 선택 단계에서도 같은 제한을 미리 검증한다.
- 게시글 생성·수정 시 백엔드가 S3 `HeadObject`로 실제 크기와 `Content-Type`을 재검증한다.
- 영상은 백엔드 실행 환경의 FFprobe로 실제 재생 시간을 검증한다.
- 제한값은 환경변수로 조정 가능하게 한다.

## 변경 근거

현재 presigned PUT은 요청자가 전달한 메타데이터와 실제 S3 객체가 다를 수 있다. 업로드 URL 발급 전 요청값을 확인하고 게시글 저장 직전에 S3 객체를 재확인해야 우회 업로드를 막을 수 있다. S3 버킷 정책만으로 영상 재생 시간을 검증할 수 없으므로 FFprobe를 사용한다.

2026-07-31 사용자는 `S15P11B104-210`의 F2를 현재 백엔드 설정값에 맞게
결정했다. 현재 기본 설정은 이미지 10,485,760 bytes, 영상 104,857,600
bytes, 이미지 MIME `image/jpeg`, `image/png`, `image/webp`, 영상 MIME
`video/mp4`다. 이 결정은 위 MIME·크기만 대상으로 하며 영상 60초 제한과
FFprobe 운영 규칙까지 승인한 것으로 확대하지 않는다.

## 확인 영향

- 영향 API: `POST /files/presigned-urls`, 게시글 생성·수정 API,
  `PATCH /users/me`
- 영향 계약: 게시글·프로필 이미지 업로드 요청의 허용 MIME·용량과 게시글
  저장 전 검증 규칙
- 영향 화면: 게시글 미디어·프로필 이미지 선택 시 제한 초과 파일 안내
- 검증 범위: 백엔드 단위·통합 테스트, 프론트 타입 검사·단위 테스트, 실제 S3 이미지·영상 E2E

## 확인이 필요한 질문

- 영상 60초 제한과 FFprobe 검증을 공식 스펙으로 확정할 것인가?
- `video/mp4` 안에서 허용할 영상·음성 코덱을 별도로 제한할 것인가?

## 결정 및 반영

- 결정: 일부 승인. `S15P11B104-210` F2의 게시글·프로필 이미지 10 MiB,
  게시글 영상 100 MiB와 `image/jpeg`·`image/png`·`image/webp`·
  `video/mp4` MIME 범위만 승인해 반영한다. 영상 60초 제한, 게시글 저장 전
  스토리지 재검증, FFprobe, 코덱과 운영 설정 규칙은 승인되지 않아
  미결정으로 남긴다.
- 결정자: 사용자
- 결정일: 2026-07-31
- 반영 문서: `docs/specs/contracts/API.md`,
  `docs/specs/domains/FEED_AND_MEDIA.md`,
  `docs/specs/domains/ACCOUNT_AND_PROFILE.md`, `docs/specs/COVERAGE.md`
- 반영 커밋: `121cf0c2120d4e2514afc3a0566eae95efd7afc7`
