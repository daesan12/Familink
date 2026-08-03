# 게시글 분석의 텍스트·멀티모달 Gemini 인증 경로 분리

- 상태: 적용
- 제안자: 장대산
- 작성일: 2026-08-03
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/domains/FEED_AND_MEDIA.md`
- 관련 작업: `S15P11B104-259`

## 기존 내용

- 게시글 분석 요청은 미디어 유무와 관계없이 SSAFY GMS 프록시와 `GMS_API_KEY`를 사용했다.
- `GoogleGeminiClient` 한 인스턴스가 게시글, 통화 리포트, 일일 리포트 요청을 모두 담당했다.

## 승인 내용

- 미디어가 없는 텍스트 게시글은 기존 SSAFY GMS 프록시와 `GMS_API_KEY`를 사용한다.
- 이미지 또는 영상이 포함된 게시글은 Google Gemini Developer API와 `GEMINI_API_KEY`를
  직접 사용한다.
- 통화 리포트와 일일 리포트는 기존 GMS 경로를 유지한다.
- Direct Gemini 호출 실패 시 GMS로 자동 대체하지 않고 해당 미디어 게시글 분석만 실패한다.
- Direct Gemini 기본 주소는 `https://generativelanguage.googleapis.com`으로 정한다.
- S3 미디어는 서버가 임시 다운로드한 뒤 Gemini Files API에 업로드하고, 처리 완료를 기다려
  분석한다. 성공·실패·시간 초과 경로 모두에서 Gemini 파일과 로컬 임시 파일을 정리한다.
- Gemini Files API 처리 대기 제한은 운영 환경변수로 조정할 수 있으며 기본값은 120초로 한다.

## 변경 근거

- 운영 Parameter Store에 `/familink/prod/GEMINI_API_KEY`가 `SecureString`으로 등록되었다.
- 기존 수동 Direct Gemini E2E는 존재했지만 제품 코드와 Compose에는 Direct 키와 실행 경로가
  연결되어 있지 않았다.
- 인증 키와 제공자 주소를 요청 종류별로 분리해야 키 혼용과 미디어 분석 실패의 전파를 막을 수
  있다.

## 영향 범위

- 영향 도메인: 게시글 AI 분석, 운영 비밀값 주입
- 영향 계약: 외부 공개 API와 DB 구조는 변경하지 않고 내부 공급자·인증 계약만 변경한다.
- 영향 화면: 없음
- 검증 범위: 텍스트·이미지·영상 라우팅, 키 누락, 처리 시간 초과, 임시 파일 정리, 운영 Compose

## 결정 및 반영

- 결정: 전체 승인
- 결정자: 장대산
- 결정일: 2026-08-03
- 반영 문서: `docs/specs/domains/FEED_AND_MEDIA.md`
- 반영 커밋:
