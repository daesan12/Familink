# 보안 검토: S15P11B104

> 이 문서는 [봉인된 영문 보안 스캔 원본](./2026-08-02-security-scan.md)의 한국어 번역본이다. 해시, 기술 식별자, CWE, 파일 경로와 코드 토큰은 원문을 유지했다. 영문 원본의 scan-local `findings/...` 산출물은 프로젝트에 복사하지 않았으므로, 상세 설명과 수정 가이드는 실제로 열리는 [통합 QA 리포트](./2026-08-02-release-code-qa.md)의 `SEC-001~008`에 연결한다.

## 범위

변경할 수 없는 `develop` 리비전에 대한 저장소 전체 표준 보안 스캔으로, 백엔드, React Native 및 네이티브 Android 코드, 인프라, 빌드·릴리스 구성, 테스트, 스펙과 저장소 로컬 도구를 대상으로 한다.

- 스캔 모드: `repository`
- 대상 종류: `git_revision`
- 대상 ID: `target_sha256_93db78458c0a31af0aa76c9d6632125d02d06b4c0c2b40bb67f7ccabc62c7b89`
- 리비전: `87459f14b579a69086268e0701dd380ceba45203`
- 인벤토리 전략: `repository`
- 포함 경로: `.`
- 제외 경로: 없음
- 런타임 또는 테스트 상태: 정적 소스와 구성 검토에 범위가 제한된 오프라인 PoC를 추가했다. 공개 서비스, S3 버킷, AI 제공자, 운영 데이터베이스나 운영 네트워크는 테스트하지 않았다. Android CLI에서 실행 중인 에뮬레이터의 Familink 로그인 및 회원가입 첫 화면을 확인했다.
- 검토한 산출물: 1,052개 경로의 결정론적 저장소 인벤토리, 417개 경로의 백엔드 검토 기록, 318개 경로의 프론트엔드·네이티브 Android 검토 기록, 317개 경로의 인프라·문서·도구 검토 기록, 13개 후보 중앙 검증 원장, 11개 후보 중앙 공격 경로 분석, 안전한 로컬 PoC 패키지가 포함된 발견 사항별 보고서 8건
- 스캔 맥락: 입력 검증, 인증·인가, 업로드 악용, 비밀값·서명 구성, 모바일 브리지 경계, 서비스 거부 위험에 중점을 둔다. 제품 파일은 수정하지 않는다.

제한 및 제외 사항:

- 외부 WAF 및 TLS 종료, 버킷 IAM·수명 주기 제어, Google Play 앱 서명, 실제 운영 토폴로지는 검증할 수 없었다.
- 서비스 거부 PoC는 범위가 제한된 소스·산술 모델을 사용했으며 운영 규모의 부하는 의도적으로 생성하지 않았다.
- 바이너리 산출물 33개는 인벤토리에 포함하되 소스 검토 완료로 간주하지 않고 `binary-unreviewable`로 명시했다.
- 운영 자격 증명 또는 공유 클라우드 서비스가 필요한 런타임 비즈니스 흐름은 실행하지 않았다.

### 스캔 요약

| 항목 | 값 |
| --- | --- |
| 보고 대상 발견 사항 | 8 |
| 중요도 구성 | 심각(High): 1, 경고(Medium): 4, 단순개선(Low): 3 |
| 신뢰도 구성 | 높음(High): 8 |
| 커버리지 | 완료 |
| 검증 모드 | 정규화된 후보 원장 하나, 중앙 검증 1회, 살아남은 전체 후보 대상 공격 경로 분석 1회, 보고 대상 발견 사항마다 전용 취약점 보고서 작성 작업자 1명을 사용한 간결한 표준 스캔 |

정식 산출물은 `scan-manifest.json`, `findings.json`, `coverage.json`이다. 이 보고서는 해당 파일을 결정론적으로 투영한 결과다.

## 위협 모델

서비스는 모바일-백엔드, 가족 그룹 인가, 파일 업로드, 네이티브 브리지, AI 제공자, 백엔드-인프라, 빌드·릴리스, 가용성 신뢰 경계를 넘나든다.

### 자산

- Access Token과 Refresh Token
- 가족 그룹 멤버십, 역할, 초대, 프로필, 게시글, 댓글, 일정, 통화와 리포트
- 업로드된 미디어와 객체 스토리지 용량
- FCM 등록 토큰, SDP, 전사문과 AI 요약
- 운영 자격 증명과 Android 애플리케이션 서명 신원

### 신뢰 경계

- 신뢰할 수 없는 React Native·Android 클라이언트와 Spring Boot API 사이
- 인증된 사용자와 가족 그룹·역할 범위 데이터 사이
- 공격자가 제어하는 업로드 메타데이터·바이트와 S3 호환 스토리지 사이
- React Native와 Kotlin 브리지·WebRTC peer 데이터 사이
- 백엔드와 PostgreSQL, Redis, S3, FCM, Gemini, OpenAI 사이
- 저장소·CI 구성과 운영 릴리스 산출물 사이

### 공격자 능력

- API를 직접 호출하고 JSON을 변경하며 토큰을 재사용하고 식별자·목록 크기를 조작하며 UI 검증을 우회할 수 있다.
- 유효한 저권한 계정을 운영하고 게시글이나 그룹을 축적할 수 있다.
- 업로드 목적, MIME 선언, 선언 크기, 파일명과 PUT 본문을 제어할 수 있다.
- 저장소에서 볼 수 있는 릴리스 구성과 추적되는 서명 자료를 읽을 수 있다.
- 암호화되지 않은 네트워크 경로에 위치하면 트래픽을 관찰하거나 변경할 수 있다.

### 보안 목표

- 서버에서 인증, 인가, tenant 격리와 수명 주기 상태를 강제한다.
- 비용이 큰 작업 전에 요청별·반복 리소스 소비량을 제한한다.
- 목적, 유형, 개수와 크기 제한을 강제할 수 있는 좁은 범위의 업로드 권한을 발급한다.
- 비밀번호, bearer token, 클라우드 자격 증명과 릴리스 서명 신원을 보호한다.
- 운영 전송 또는 서명 구성이 없으면 기본적으로 차단한다.

### 가정

- 운영 환경은 명시적으로 개발 전용인 Spring profile을 활성화하지 않는다.
- TLS는 선언된 신뢰 경계에서 종료되어야 하며, 선언되지 않은 외부 종료 지점은 가정하지 않는다.
- 서드파티 서비스는 요청을 인증하지만 실패하거나 사용할 수 없게 될 수 있다.
- 저장소에서 볼 수 있는 서명 키와 비밀값은 소스 열람자에게 노출된 것으로 본다.
- 개발 전용 fixture는 운영 빌드 또는 런타임이 참조하지 않는 한 범위 밖이다.

## 발견 사항

| 발견 사항 | 중요도 | 신뢰도 | 상세 보고서 |
| --- | --- | --- | --- |
| [릴리스 빌드가 저장소에 노출된 Android debug 서명키를 사용한다](#finding-1) | 심각 | 높음 | [SEC-001 열기](./2026-08-02-release-code-qa.md#sec-001) |
| [presigned upload 요청이 제한 없는 파일 batch를 허용한다](#finding-2) | 경고 | 높음 | [SEC-002 열기](./2026-08-02-release-code-qa.md#sec-002) |
| [presigned upload 정책 우회가 임의 purpose·대용량 객체를 허용한다](#finding-3) | 경고 | 높음 | [SEC-003 열기](./2026-08-02-release-code-qa.md#sec-003) |
| [운영 인증 트래픽이 평문 HTTP로 노출된다](#finding-4) | 경고 | 높음 | [SEC-004 열기](./2026-08-02-release-code-qa.md#sec-004) |
| [공개 로그인에 BCrypt 실행 전 시도 제한이 없다](#finding-5) | 경고 | 높음 | [SEC-005 열기](./2026-08-02-release-code-qa.md#sec-005) |
| [게시글 생성이 제한 없는 그룹 목록 전체로 fan-out 된다](#finding-6) | 단순개선 | 높음 | [SEC-006 열기](./2026-08-02-release-code-qa.md#sec-006) |
| [실패한 AI 분석이 제한 없는 batch에서 끝없이 재시도된다](#finding-7) | 단순개선 | 높음 | [SEC-007 열기](./2026-08-02-release-code-qa.md#sec-007) |
| [그룹 보관함이 pagination 없이 모든 게시글·미디어를 불러온다](#finding-8) | 단순개선 | 높음 | [SEC-008 열기](./2026-08-02-release-code-qa.md#sec-008) |

### 신뢰도 척도

| 레이블 | 의미 |
| --- | --- |
| 높음 | 직접 증거가 발견 사항을 뒷받침하며 중대한 미해결 차단 요인이 없다. |
| 보통 | 증거가 개연성 있는 문제를 뒷받침하지만 중요한 런타임 또는 도달 가능성 증명이 남아 있다. |
| 낮음 | 증거가 불완전하며 명시적인 후속 조치를 위해서만 항목을 유지한다. |

<a id="finding-1"></a>

### [1] 릴리스 빌드가 저장소에 노출된 Android debug 서명키를 사용한다

| 항목 | 값 |
| --- | --- |
| 중요도 | 심각 (High) |
| 신뢰도 | 높음 (High) |
| 신뢰도 근거 | 릴리스 빌드가 `signingConfigs.debug`를 선택하고 개인키 keystore가 저장소에서 추적되며, `keytool`이 코드에 포함된 공개 자격 증명으로 `PrivateKeyEntry`를 열었다. |
| 범주 | `exposed-release-signing-key` |
| CWE | CWE-321, CWE-798 |
| 영향 위치 | `frontend/android/app/build.gradle:100-116` |

#### 요약

자세한 문제 설명은 [통합 QA 리포트의 SEC-001](./2026-08-02-release-code-qa.md#sec-001)을 참고한다.

#### 검증

자세한 검증 결과는 [통합 QA 리포트의 SEC-001](./2026-08-02-release-code-qa.md#sec-001)을 참고한다.

#### 데이터 흐름

자세한 데이터 흐름은 [통합 QA 리포트의 SEC-001](./2026-08-02-release-code-qa.md#sec-001)을 참고한다.

#### 도달 가능성

자세한 도달 가능성은 [통합 QA 리포트의 SEC-001](./2026-08-02-release-code-qa.md#sec-001)을 참고한다.

#### 중요도

자세한 영향과 중요도 근거는 [통합 QA 리포트의 SEC-001](./2026-08-02-release-code-qa.md#sec-001)을 참고한다.

#### 수정 방안

수정 가이드는 [통합 QA 리포트의 SEC-001](./2026-08-02-release-code-qa.md#sec-001)을 참고한다.

<a id="finding-2"></a>

### [2] presigned upload 요청이 제한 없는 파일 batch를 허용한다

| 항목 | 값 |
| --- | --- |
| 중요도 | 경고 (Medium) |
| 신뢰도 | 높음 (High) |
| 신뢰도 근거 | 인증된 요청에는 2 MiB 프록시 본문에 들어갈 수 있는 만큼 유효한 파일 행을 넣을 수 있으며, 서비스는 각 행을 동기적으로 검증·서명하면서 전체 응답을 메모리에 구성한다. |
| 범주 | `unbounded-batch-processing` |
| CWE | CWE-400, CWE-770 |
| 영향 위치 | `backend/src/main/java/com/ssafy/s15p11b104/domain/file/dto/PresignedUrlRequest.java:11-16`, `backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/FileUploadService.java:20-26` |

#### 요약

자세한 문제 설명은 [통합 QA 리포트의 SEC-002](./2026-08-02-release-code-qa.md#sec-002)을 참고한다.

#### 검증

자세한 검증 결과는 [통합 QA 리포트의 SEC-002](./2026-08-02-release-code-qa.md#sec-002)을 참고한다.

#### 데이터 흐름

자세한 데이터 흐름은 [통합 QA 리포트의 SEC-002](./2026-08-02-release-code-qa.md#sec-002)을 참고한다.

#### 도달 가능성

자세한 도달 가능성은 [통합 QA 리포트의 SEC-002](./2026-08-02-release-code-qa.md#sec-002)을 참고한다.

#### 중요도

자세한 영향과 중요도 근거는 [통합 QA 리포트의 SEC-002](./2026-08-02-release-code-qa.md#sec-002)을 참고한다.

#### 수정 방안

수정 가이드는 [통합 QA 리포트의 SEC-002](./2026-08-02-release-code-qa.md#sec-002)을 참고한다.

<a id="finding-3"></a>

### [3] presigned upload 정책 우회가 임의 purpose·대용량 객체를 허용한다

| 항목 | 값 |
| --- | --- |
| 중요도 | 경고 (Medium) |
| 신뢰도 | 높음 (High) |
| 신뢰도 근거 | 인증된 HTTP 진입점, purpose에 따른 조기 반환, S3 PUT 단계에서 서명되지 않는 content length, avatar/PDF를 허용하는 명시적 테스트가 모두 고정된 리비전에 존재한다. |
| 범주 | `improper-upload-validation` |
| CWE | CWE-20, CWE-770 |
| 영향 위치 | `backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/FileUploadService.java:20-26`, `backend/src/main/java/com/ssafy/s15p11b104/domain/file/dto/PresignedUrlRequest.java:11-16`, `backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/MediaUploadPolicy.java:24-31`, `backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/S3PresignedUploadProvider.java:30-40`, `backend/src/test/java/com/ssafy/s15p11b104/domain/file/MediaUploadPolicyTest.java:48-51` |

#### 요약

자세한 문제 설명은 [통합 QA 리포트의 SEC-003](./2026-08-02-release-code-qa.md#sec-003)을 참고한다.

#### 검증

자세한 검증 결과는 [통합 QA 리포트의 SEC-003](./2026-08-02-release-code-qa.md#sec-003)을 참고한다.

#### 데이터 흐름

자세한 데이터 흐름은 [통합 QA 리포트의 SEC-003](./2026-08-02-release-code-qa.md#sec-003)을 참고한다.

#### 도달 가능성

자세한 도달 가능성은 [통합 QA 리포트의 SEC-003](./2026-08-02-release-code-qa.md#sec-003)을 참고한다.

#### 중요도

자세한 영향과 중요도 근거는 [통합 QA 리포트의 SEC-003](./2026-08-02-release-code-qa.md#sec-003)을 참고한다.

#### 수정 방안

수정 가이드는 [통합 QA 리포트의 SEC-003](./2026-08-02-release-code-qa.md#sec-003)을 참고한다.

<a id="finding-4"></a>

### [4] 운영 인증 트래픽이 평문 HTTP로 노출된다

| 항목 | 값 |
| --- | --- |
| 중요도 | 경고 (Medium) |
| 신뢰도 | 높음 (High) |
| 신뢰도 근거 | 정식 운영 bundle이 80 포트를 publish하고 HTTP listener만 구성하며 80 포트를 외부에 공개한다. 인증 payload에 비밀번호와 bearer token이 포함되는데도 HTTPS 적용을 명시적으로 미루고 있다. |
| 범주 | `cleartext-transmission` |
| CWE | CWE-319 |
| 영향 위치 | `infrastructure/production/compose.prod.yml:96-98`, `infrastructure/production/nginx/conf.d/api.conf:5-7`, `docs/specs/contracts/API.md:84-85`, `infrastructure/aws-foundation/README.md:64-67`, `infrastructure/production/README.md:9`, `infrastructure/production/README.md:85` |

#### 요약

자세한 문제 설명은 [통합 QA 리포트의 SEC-004](./2026-08-02-release-code-qa.md#sec-004)을 참고한다.

#### 검증

자세한 검증 결과는 [통합 QA 리포트의 SEC-004](./2026-08-02-release-code-qa.md#sec-004)을 참고한다.

#### 데이터 흐름

자세한 데이터 흐름은 [통합 QA 리포트의 SEC-004](./2026-08-02-release-code-qa.md#sec-004)을 참고한다.

#### 도달 가능성

자세한 도달 가능성은 [통합 QA 리포트의 SEC-004](./2026-08-02-release-code-qa.md#sec-004)을 참고한다.

#### 중요도

자세한 영향과 중요도 근거는 [통합 QA 리포트의 SEC-004](./2026-08-02-release-code-qa.md#sec-004)을 참고한다.

#### 수정 방안

수정 가이드는 [통합 QA 리포트의 SEC-004](./2026-08-02-release-code-qa.md#sec-004)을 참고한다.

<a id="finding-5"></a>

### [5] 공개 로그인에 BCrypt 실행 전 시도 제한이 없다

| 항목 | 값 |
| --- | --- |
| 중요도 | 경고 (Medium) |
| 신뢰도 | 높음 (High) |
| 신뢰도 근거 | 공개 로그인 route, 제한 없는 요청 field, DB 조회, BCrypt 검증, 애플리케이션·Nginx 제한 부재가 직접 확인된다. 외부 WAF는 배포 시 가능한 선택지로만 남아 있다. |
| 범주 | `insufficient-authentication-throttling` |
| CWE | CWE-307 |
| 영향 위치 | `backend/src/main/java/com/ssafy/s15p11b104/global/security/SecurityConfig.java:24-34`, `backend/src/main/java/com/ssafy/s15p11b104/domain/account/controller/AuthController.java:85-87`, `backend/src/main/java/com/ssafy/s15p11b104/domain/account/dto/LoginRequest.java:13-16`, `backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/AuthService.java:97-110` |

#### 요약

자세한 문제 설명은 [통합 QA 리포트의 SEC-005](./2026-08-02-release-code-qa.md#sec-005)을 참고한다.

#### 검증

자세한 검증 결과는 [통합 QA 리포트의 SEC-005](./2026-08-02-release-code-qa.md#sec-005)을 참고한다.

#### 데이터 흐름

자세한 데이터 흐름은 [통합 QA 리포트의 SEC-005](./2026-08-02-release-code-qa.md#sec-005)을 참고한다.

#### 도달 가능성

자세한 도달 가능성은 [통합 QA 리포트의 SEC-005](./2026-08-02-release-code-qa.md#sec-005)을 참고한다.

#### 중요도

자세한 영향과 중요도 근거는 [통합 QA 리포트의 SEC-005](./2026-08-02-release-code-qa.md#sec-005)을 참고한다.

#### 수정 방안

수정 가이드는 [통합 QA 리포트의 SEC-005](./2026-08-02-release-code-qa.md#sec-005)을 참고한다.

<a id="finding-6"></a>

### [6] 게시글 생성이 제한 없는 그룹 목록 전체로 fan-out 된다

| 항목 | 값 |
| --- | --- |
| 중요도 | 단순개선 (Low) |
| 신뢰도 | 높음 (High) |
| 신뢰도 근거 | `groupIds`에 최댓값이 없고 guardian 사용자는 그룹을 무제한으로 생성할 수 있다. 게시글 요청 하나가 한 transaction에서 제공된 각 membership마다 반복적인 membership 조회 후 게시글·미디어·carnation 처리와 event 발행을 수행한다. |
| 범주 | `unbounded-request-fanout` |
| CWE | CWE-400 |
| 영향 위치 | `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/PostCreateRequest.java:13-17`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java:64-74`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java:102-108` |

#### 요약

자세한 문제 설명은 [통합 QA 리포트의 SEC-006](./2026-08-02-release-code-qa.md#sec-006)을 참고한다.

#### 검증

자세한 검증 결과는 [통합 QA 리포트의 SEC-006](./2026-08-02-release-code-qa.md#sec-006)을 참고한다.

#### 데이터 흐름

자세한 데이터 흐름은 [통합 QA 리포트의 SEC-006](./2026-08-02-release-code-qa.md#sec-006)을 참고한다.

#### 도달 가능성

자세한 도달 가능성은 [통합 QA 리포트의 SEC-006](./2026-08-02-release-code-qa.md#sec-006)을 참고한다.

#### 중요도

자세한 영향과 중요도 근거는 [통합 QA 리포트의 SEC-006](./2026-08-02-release-code-qa.md#sec-006)을 참고한다.

#### 수정 방안

수정 가이드는 [통합 QA 리포트의 SEC-006](./2026-08-02-release-code-qa.md#sec-006)을 참고한다.

<a id="finding-7"></a>

### [7] 실패한 AI 분석이 제한 없는 batch에서 끝없이 재시도된다

| 항목 | 값 |
| --- | --- |
| 중요도 | 단순개선 (Low) |
| 신뢰도 | 높음 (High) |
| 신뢰도 근거 | query는 pagination 없이 `SUCCESS`가 아닌 모든 안정 상태 게시글을 선택하고, 실패를 `FAILED`로 commit하며, 기본 활성화된 scheduler가 재시도 상한이나 backoff 없이 매분 동일한 전체 scan에 다시 진입한다. |
| 범주 | `uncontrolled-retry-loop` |
| CWE | CWE-400, CWE-770 |
| 영향 위치 | `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java:64-74`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/repository/PostAnalysisRepository.java:19-33`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisService.java:47-59`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisScheduler.java:20-24`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisService.java:78-98`, `backend/src/main/resources/application.yml:49-52` |

#### 요약

자세한 문제 설명은 [통합 QA 리포트의 SEC-007](./2026-08-02-release-code-qa.md#sec-007)을 참고한다.

#### 검증

자세한 검증 결과는 [통합 QA 리포트의 SEC-007](./2026-08-02-release-code-qa.md#sec-007)을 참고한다.

#### 데이터 흐름

자세한 데이터 흐름은 [통합 QA 리포트의 SEC-007](./2026-08-02-release-code-qa.md#sec-007)을 참고한다.

#### 도달 가능성

자세한 도달 가능성은 [통합 QA 리포트의 SEC-007](./2026-08-02-release-code-qa.md#sec-007)을 참고한다.

#### 중요도

자세한 영향과 중요도 근거는 [통합 QA 리포트의 SEC-007](./2026-08-02-release-code-qa.md#sec-007)을 참고한다.

#### 수정 방안

수정 가이드는 [통합 QA 리포트의 SEC-007](./2026-08-02-release-code-qa.md#sec-007)을 참고한다.

<a id="finding-8"></a>

### [8] 그룹 보관함이 pagination 없이 모든 게시글·미디어를 불러온다

| 항목 | 값 |
| --- | --- |
| 중요도 | 단순개선 (Low) |
| 신뢰도 | 높음 (High) |
| 신뢰도 근거 | 해당 route는 `Pageable.unpaged`로 모든 그룹 게시글을 불러오고 media를 일괄 load한 뒤에야 filter하며, 전체 grouped response를 구성한다. 그룹 보관함 상한은 확인되지 않았다. |
| 범주 | `unbounded-data-retrieval` |
| CWE | CWE-400 |
| 영향 위치 | `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/controller/PostReadController.java:50-59`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostReadService.java:98-111`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostReadService.java:114-132` |

#### 요약

자세한 문제 설명은 [통합 QA 리포트의 SEC-008](./2026-08-02-release-code-qa.md#sec-008)을 참고한다.

#### 검증

자세한 검증 결과는 [통합 QA 리포트의 SEC-008](./2026-08-02-release-code-qa.md#sec-008)을 참고한다.

#### 데이터 흐름

자세한 데이터 흐름은 [통합 QA 리포트의 SEC-008](./2026-08-02-release-code-qa.md#sec-008)을 참고한다.

#### 도달 가능성

자세한 도달 가능성은 [통합 QA 리포트의 SEC-008](./2026-08-02-release-code-qa.md#sec-008)을 참고한다.

#### 중요도

자세한 영향과 중요도 근거는 [통합 QA 리포트의 SEC-008](./2026-08-02-release-code-qa.md#sec-008)을 참고한다.

#### 수정 방안

수정 가이드는 [통합 QA 리포트의 SEC-008](./2026-08-02-release-code-qa.md#sec-008)을 참고한다.

## 검토한 영역

| 검토 영역 | 위험 영역 | 결과 | 비고 |
| --- | --- | --- | --- |
| 인증 및 인가 | 공개 로그인 제한, 토큰 검증, 프로필·그룹 인가 | 보고됨 | 공개 로그인 제한 발견 사항 1건을 보고했다. 정식 운영 launcher가 `prod` 구성을 요구하는 것으로 확인된 후 local profile의 JWT 기본값은 제외했다. 근거: `artifacts/02_discovery/coverage_backend.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl`, `artifacts/03_coverage/repository_coverage_ledger.md` |
| 업로드와 객체 스토리지 | presigned upload 목적, MIME, 크기, 개수, quota와 client 동작 | 보고됨 | 목적·실제 크기 정책 우회와 제한 없는 presign batch를 보고했다. profile PUT timeout은 범위가 제한된 client 복원력 문제로 판단해 제외했다. 근거: `artifacts/02_discovery/coverage_backend.jsonl`, `artifacts/02_discovery/coverage_frontend.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl` |
| 비밀값과 서명 구성 | Android 릴리스 서명, JWT 비밀값, profile과 배포 예시 | 보고됨 | 공개 debug 릴리스 키를 보고했다. 경고가 표시된 JWT placeholder와 지원되지 않는 direct-image local 기본값은 운영 도달성이 없는 운영자 전용 오용으로 판단해 제외했다. 근거: `artifacts/02_discovery/coverage_frontend.jsonl`, `artifacts/02_discovery/coverage_repo.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl` |
| 운영 전송 | Compose port 공개, Nginx TLS, AWS ingress와 client HTTPS 강제 | 보고됨 | 저장소에 정의된 운영 경로가 인증 트래픽을 평문 HTTP로 노출한다. 릴리스 client의 fail-closed 동작은 반대 근거로 유지했다. 근거: `artifacts/02_discovery/coverage_repo.jsonl`, `artifacts/02_discovery/coverage_frontend.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl` |
| AI와 예약 처리 | 게시글 분석 batch, 재시도 상태, transaction, lock과 제공자 실패 | 보고됨 | 실패한 분석이 pagination 없는 예약 transaction에서 즉시 다시 처리 대상이 된다. 근거: `artifacts/02_discovery/coverage_backend.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl` |
| 보관함과 읽기 증폭 | 그룹 보관함 pagination, media load, filter, grouping과 serialization | 보고됨 | 활성 구성원이 pagination 없는 보관함 전체 조회와 materialization을 유발할 수 있다. 근거: `artifacts/02_discovery/coverage_backend.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl` |
| 게시글 쓰기 fan-out | `groupIds` 개수, membership 검사, DB write, carnation update와 event | 보고됨 | 게시글 요청 하나가 공격자가 누적한 제한 없는 그룹 목록 전체로 fan-out 될 수 있다. 근거: `artifacts/02_discovery/coverage_backend.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl` |
| 모바일 브리지와 WebRTC | React Native session·upload 흐름, Kotlin bridge lifecycle, WebRTC message 크기 | 제외됨 | caption-stream 후보는 raw frame이 백엔드가 relay한 신뢰 peer에서 시작하고 입증된 영향이 동일 사용자 기기로 제한되므로 제외했다. 근거: `artifacts/02_discovery/coverage_frontend.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl` |
| 저장소 도구 | 개발자 설치 지침과 저장소 로컬 자동화 | 해당 없음 | 변경 가능한 Android CLI installer 지침은 제품이나 CI에서 실행되지 않는다. 근거: `artifacts/02_discovery/coverage_repo.jsonl`, `artifacts/02_discovery/candidate_ledger.jsonl` |
| 전체 저장소 인벤토리 마감 | 결정론적 경로 인벤토리와 binary-unreviewable 집계 | 문제 없음 | 인벤토리 경로 1,052개가 각각 정확히 한 번 존재한다. 1,019개는 소스 검토를 거쳤고 바이너리 산출물 33개는 명시적으로 `binary-unreviewable`로 표시했다. 근거: `artifacts/02_discovery/coverage_backend.jsonl`, `artifacts/02_discovery/coverage_frontend.jsonl`, `artifacts/02_discovery/coverage_repo.jsonl`, `artifacts/03_coverage/reviewed_surfaces.md` |
