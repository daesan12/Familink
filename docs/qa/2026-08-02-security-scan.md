# Security Review: S15P11B104

## Scope

Whole-repository standard security scan of the immutable develop revision, covering backend, React Native and native Android code, infrastructure, build and release configuration, tests, specifications, and repository-local tooling.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_93db78458c0a31af0aa76c9d6632125d02d06b4c0c2b40bb67f7ccabc62c7b89
- Revision: 87459f14b579a69086268e0701dd380ceba45203
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Static source and configuration review was supplemented with bounded offline PoCs. No public service, S3 bucket, AI provider, production database, or production network was tested. Android CLI confirmed the Familink login and signup landing screen on the running emulator.
- Artifacts reviewed: 1,052-path deterministic repository inventory, 417-path backend review receipt, 318-path frontend and native Android review receipt, 317-path infrastructure, documentation, and tooling review receipt, 13-candidate centralized validation ledger, 11-candidate centralized attack-path analysis, Eight per-finding write-ups with safe local PoC packages
- Scan context: Focus on input validation, authentication and authorization, upload abuse, secret and signing configuration, mobile bridge boundaries, and denial-of-service risks. Do not modify product files.

Limitations and exclusions:
- External WAF and TLS termination, bucket IAM and lifecycle controls, Google Play App Signing, and live production topology were not available for verification.
- Denial-of-service PoCs used bounded source and arithmetic models and intentionally did not generate production-scale load.
- Thirty-three binary artifacts were inventoried and explicitly marked binary-unreviewable rather than treated as source-reviewed.
- Runtime business flows requiring production credentials or shared cloud services were not exercised.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 8 |
| Severity mix | high: 1, medium: 4, low: 3 |
| Confidence mix | high: 8 |
| Coverage | complete |
| Validation mode | Compact standard scan with one normalized candidate ledger, exactly one centralized validation pass, exactly one attack-path pass for all surviving candidates, and one dedicated vulnerability write-up worker per reportable finding. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

The service crosses mobile-to-backend, family-group authorization, file-upload, native bridge, AI provider, backend-to-infrastructure, build/release, and availability trust boundaries.

### Assets

- Access and refresh tokens
- Family-group memberships, roles, invitations, profiles, posts, comments, calendars, calls, and reports
- Uploaded media and object-storage capacity
- FCM registration tokens, SDP, transcripts, and AI summaries
- Production credentials and Android application-signing identity

### Trust Boundaries

- Untrusted React Native and Android clients to Spring Boot APIs
- Authenticated users to family-group and role-scoped data
- Attacker-controlled upload metadata and bytes to S3-compatible storage
- React Native to Kotlin bridge and WebRTC peer data
- Backend to PostgreSQL, Redis, S3, FCM, Gemini, and OpenAI
- Repository and CI configuration to production release artifacts

### Attacker Capabilities

- Call APIs directly, alter JSON, replay tokens, manipulate identifiers and list sizes, and bypass UI validation
- Operate a valid low-privileged account and accumulate posts or groups
- Control upload purpose, MIME claims, declared sizes, filenames, and PUT bodies
- Read repository-visible release configuration and tracked signing material
- Observe or alter traffic when positioned on an unencrypted network path

### Security Objectives

- Enforce authentication, authorization, tenancy, and lifecycle state on the server
- Bound per-request and repeated resource consumption before expensive work
- Mint narrowly scoped upload capabilities with enforceable purpose, type, count, and size limits
- Protect passwords, bearer tokens, cloud credentials, and release signing identity
- Fail closed when production transport or signing configuration is absent

### Assumptions

- Production does not enable explicitly developer-only Spring profiles.
- TLS must terminate at a declared trusted boundary; an undeclared external terminator is not assumed.
- Third-party services authenticate requests but can fail or become unavailable.
- Repository-visible signing keys and secrets are exposed to source readers.
- Developer-only fixtures are out of scope unless a production build or runtime references them.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Release builds use a repository-visible Android debug signing key](#finding-1) | high | high | [Open report](findings/release-build-uses-public-debug-signing-key/release-build-uses-public-debug-signing-key.md) |
| [Presigned upload requests allow unbounded file batches](#finding-2) | medium | high | [Open report](findings/unbounded-presigned-upload-batch/unbounded-presigned-upload-batch.md) |
| [Presigned upload policy bypass permits arbitrary and oversized objects](#finding-3) | medium | high | [Open report](findings/presigned-upload-policy-bypass/presigned-upload-policy-bypass.md) |
| [Production authentication traffic is exposed over cleartext HTTP](#finding-4) | medium | high | [Open report](findings/production-authentication-over-cleartext-http/production-authentication-over-cleartext-http.md) |
| [Public login has no attempt throttling before BCrypt](#finding-5) | medium | high | [Open report](findings/unthrottled-public-login/unthrottled-public-login.md) |
| [Post creation fans out across an unbounded group list](#finding-6) | low | high | [Open report](findings/unbounded-post-group-fanout/unbounded-post-group-fanout.md) |
| [Failed AI analyses retry forever in unbounded batches](#finding-7) | low | high | [Open report](findings/unbounded-ai-analysis-retries/unbounded-ai-analysis-retries.md) |
| [Group archive loads all posts and media without pagination](#finding-8) | low | high | [Open report](findings/unpaged-group-archive/unpaged-group-archive.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Release builds use a repository-visible Android debug signing key

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | The release build selects signingConfigs.debug, the private-key keystore is tracked, and keytool opened its PrivateKeyEntry with the embedded public credentials. |
| Category | exposed-release-signing-key |
| CWE | CWE-321, CWE-798 |
| Affected lines | frontend/android/app/build.gradle:100-116 |

#### Summary

See the [detailed technical write-up](findings/release-build-uses-public-debug-signing-key/release-build-uses-public-debug-signing-key.md).

#### Validation

See the [detailed technical write-up](findings/release-build-uses-public-debug-signing-key/release-build-uses-public-debug-signing-key.md).

#### Dataflow

See the [detailed technical write-up](findings/release-build-uses-public-debug-signing-key/release-build-uses-public-debug-signing-key.md).

#### Reachability

See the [detailed technical write-up](findings/release-build-uses-public-debug-signing-key/release-build-uses-public-debug-signing-key.md).

#### Severity

See the [detailed technical write-up](findings/release-build-uses-public-debug-signing-key/release-build-uses-public-debug-signing-key.md).

#### Remediation

See the [detailed technical write-up](findings/release-build-uses-public-debug-signing-key/release-build-uses-public-debug-signing-key.md).

<a id="finding-2"></a>

### [2] Presigned upload requests allow unbounded file batches

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | An authenticated request can contain as many valid file rows as fit in the 2 MiB proxy body, and the service synchronously validates and signs each row while materializing the full response. |
| Category | unbounded-batch-processing |
| CWE | CWE-400, CWE-770 |
| Affected lines | backend/src/main/java/com/ssafy/s15p11b104/domain/file/dto/PresignedUrlRequest.java:11-16, backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/FileUploadService.java:20-26 |

#### Summary

See the [detailed technical write-up](findings/unbounded-presigned-upload-batch/unbounded-presigned-upload-batch.md).

#### Validation

See the [detailed technical write-up](findings/unbounded-presigned-upload-batch/unbounded-presigned-upload-batch.md).

#### Dataflow

See the [detailed technical write-up](findings/unbounded-presigned-upload-batch/unbounded-presigned-upload-batch.md).

#### Reachability

See the [detailed technical write-up](findings/unbounded-presigned-upload-batch/unbounded-presigned-upload-batch.md).

#### Severity

See the [detailed technical write-up](findings/unbounded-presigned-upload-batch/unbounded-presigned-upload-batch.md).

#### Remediation

See the [detailed technical write-up](findings/unbounded-presigned-upload-batch/unbounded-presigned-upload-batch.md).

<a id="finding-3"></a>

### [3] Presigned upload policy bypass permits arbitrary and oversized objects

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The authenticated HTTP source, purpose-dependent early return, unsigned content length at the S3 PUT sink, and an explicit test accepting avatar/PDF are all present at the immutable revision. |
| Category | improper-upload-validation |
| CWE | CWE-20, CWE-770 |
| Affected lines | backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/FileUploadService.java:20-26, backend/src/main/java/com/ssafy/s15p11b104/domain/file/dto/PresignedUrlRequest.java:11-16, backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/MediaUploadPolicy.java:24-31, backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/S3PresignedUploadProvider.java:30-40, backend/src/test/java/com/ssafy/s15p11b104/domain/file/MediaUploadPolicyTest.java:48-51 |

#### Summary

See the [detailed technical write-up](findings/presigned-upload-policy-bypass/presigned-upload-policy-bypass.md).

#### Validation

See the [detailed technical write-up](findings/presigned-upload-policy-bypass/presigned-upload-policy-bypass.md).

#### Dataflow

See the [detailed technical write-up](findings/presigned-upload-policy-bypass/presigned-upload-policy-bypass.md).

#### Reachability

See the [detailed technical write-up](findings/presigned-upload-policy-bypass/presigned-upload-policy-bypass.md).

#### Severity

See the [detailed technical write-up](findings/presigned-upload-policy-bypass/presigned-upload-policy-bypass.md).

#### Remediation

See the [detailed technical write-up](findings/presigned-upload-policy-bypass/presigned-upload-policy-bypass.md).

<a id="finding-4"></a>

### [4] Production authentication traffic is exposed over cleartext HTTP

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The canonical production bundle publishes port 80, configures only an HTTP listener, publicly opens port 80, and explicitly defers HTTPS while authentication payloads contain passwords and bearer tokens. |
| Category | cleartext-transmission |
| CWE | CWE-319 |
| Affected lines | infrastructure/production/compose.prod.yml:96-98, infrastructure/production/nginx/conf.d/api.conf:5-7, docs/specs/contracts/API.md:84-85, infrastructure/aws-foundation/README.md:64-67, infrastructure/production/README.md:9, infrastructure/production/README.md:85 |

#### Summary

See the [detailed technical write-up](findings/production-authentication-over-cleartext-http/production-authentication-over-cleartext-http.md).

#### Validation

See the [detailed technical write-up](findings/production-authentication-over-cleartext-http/production-authentication-over-cleartext-http.md).

#### Dataflow

See the [detailed technical write-up](findings/production-authentication-over-cleartext-http/production-authentication-over-cleartext-http.md).

#### Reachability

See the [detailed technical write-up](findings/production-authentication-over-cleartext-http/production-authentication-over-cleartext-http.md).

#### Severity

See the [detailed technical write-up](findings/production-authentication-over-cleartext-http/production-authentication-over-cleartext-http.md).

#### Remediation

See the [detailed technical write-up](findings/production-authentication-over-cleartext-http/production-authentication-over-cleartext-http.md).

<a id="finding-5"></a>

### [5] Public login has no attempt throttling before BCrypt

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The public login route, unrestricted request fields, database lookup, BCrypt verification, and absence of application/Nginx throttling are directly visible; an external WAF remains only a deployment possibility. |
| Category | insufficient-authentication-throttling |
| CWE | CWE-307 |
| Affected lines | backend/src/main/java/com/ssafy/s15p11b104/global/security/SecurityConfig.java:24-34, backend/src/main/java/com/ssafy/s15p11b104/domain/account/controller/AuthController.java:85-87, backend/src/main/java/com/ssafy/s15p11b104/domain/account/dto/LoginRequest.java:13-16, backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/AuthService.java:97-110 |

#### Summary

See the [detailed technical write-up](findings/unthrottled-public-login/unthrottled-public-login.md).

#### Validation

See the [detailed technical write-up](findings/unthrottled-public-login/unthrottled-public-login.md).

#### Dataflow

See the [detailed technical write-up](findings/unthrottled-public-login/unthrottled-public-login.md).

#### Reachability

See the [detailed technical write-up](findings/unthrottled-public-login/unthrottled-public-login.md).

#### Severity

See the [detailed technical write-up](findings/unthrottled-public-login/unthrottled-public-login.md).

#### Remediation

See the [detailed technical write-up](findings/unthrottled-public-login/unthrottled-public-login.md).

<a id="finding-6"></a>

### [6] Post creation fans out across an unbounded group list

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | groupIds has no maximum; guardian users can create unlimited groups; one post request performs repeated membership reads followed by a post, media work, carnation work, and event publication for every supplied membership in one transaction. |
| Category | unbounded-request-fanout |
| CWE | CWE-400 |
| Affected lines | backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/PostCreateRequest.java:13-17, backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java:64-74, backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java:102-108 |

#### Summary

See the [detailed technical write-up](findings/unbounded-post-group-fanout/unbounded-post-group-fanout.md).

#### Validation

See the [detailed technical write-up](findings/unbounded-post-group-fanout/unbounded-post-group-fanout.md).

#### Dataflow

See the [detailed technical write-up](findings/unbounded-post-group-fanout/unbounded-post-group-fanout.md).

#### Reachability

See the [detailed technical write-up](findings/unbounded-post-group-fanout/unbounded-post-group-fanout.md).

#### Severity

See the [detailed technical write-up](findings/unbounded-post-group-fanout/unbounded-post-group-fanout.md).

#### Remediation

See the [detailed technical write-up](findings/unbounded-post-group-fanout/unbounded-post-group-fanout.md).

<a id="finding-7"></a>

### [7] Failed AI analyses retry forever in unbounded batches

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The query selects every non-SUCCESS stable post without pagination, failures commit FAILED, and the default-enabled scheduler re-enters the same full scan every minute with no retry cap or backoff. |
| Category | uncontrolled-retry-loop |
| CWE | CWE-400, CWE-770 |
| Affected lines | backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java:64-74, backend/src/main/java/com/ssafy/s15p11b104/domain/feed/repository/PostAnalysisRepository.java:19-33, backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisService.java:47-59, backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisScheduler.java:20-24, backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisService.java:78-98, backend/src/main/resources/application.yml:49-52 |

#### Summary

See the [detailed technical write-up](findings/unbounded-ai-analysis-retries/unbounded-ai-analysis-retries.md).

#### Validation

See the [detailed technical write-up](findings/unbounded-ai-analysis-retries/unbounded-ai-analysis-retries.md).

#### Dataflow

See the [detailed technical write-up](findings/unbounded-ai-analysis-retries/unbounded-ai-analysis-retries.md).

#### Reachability

See the [detailed technical write-up](findings/unbounded-ai-analysis-retries/unbounded-ai-analysis-retries.md).

#### Severity

See the [detailed technical write-up](findings/unbounded-ai-analysis-retries/unbounded-ai-analysis-retries.md).

#### Remediation

See the [detailed technical write-up](findings/unbounded-ai-analysis-retries/unbounded-ai-analysis-retries.md).

<a id="finding-8"></a>

### [8] Group archive loads all posts and media without pagination

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The exact route loads all group posts with Pageable.unpaged, bulk-loads media, filters only afterward, and constructs the full grouped response; no group archive ceiling was found. |
| Category | unbounded-data-retrieval |
| CWE | CWE-400 |
| Affected lines | backend/src/main/java/com/ssafy/s15p11b104/domain/feed/controller/PostReadController.java:50-59, backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostReadService.java:98-111, backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostReadService.java:114-132 |

#### Summary

See the [detailed technical write-up](findings/unpaged-group-archive/unpaged-group-archive.md).

#### Validation

See the [detailed technical write-up](findings/unpaged-group-archive/unpaged-group-archive.md).

#### Dataflow

See the [detailed technical write-up](findings/unpaged-group-archive/unpaged-group-archive.md).

#### Reachability

See the [detailed technical write-up](findings/unpaged-group-archive/unpaged-group-archive.md).

#### Severity

See the [detailed technical write-up](findings/unpaged-group-archive/unpaged-group-archive.md).

#### Remediation

See the [detailed technical write-up](findings/unpaged-group-archive/unpaged-group-archive.md).

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Authentication and authorization | Public login throttling, token verification, profile and group authorization | Reported | One public-login throttling finding was reported. Local-profile JWT defaults were rejected after the canonical production launcher was confirmed to require prod configuration. Evidence: artifacts/02_discovery/coverage_backend.jsonl, artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/repository_coverage_ledger.md |
| Upload and object storage | Presigned upload purpose, MIME, size, count, quota, and client behavior | Reported | Purpose and actual-size policy bypass plus unbounded presign batches were reported. The profile PUT timeout was suppressed as a bounded client-resilience issue. Evidence: artifacts/02_discovery/coverage_backend.jsonl, artifacts/02_discovery/coverage_frontend.jsonl, artifacts/02_discovery/candidate_ledger.jsonl |
| Secret and signing configuration | Android release signing, JWT secrets, profiles, and deployment examples | Reported | The public debug release key was reported. Warned JWT placeholders and unsupported direct-image local defaults were rejected as operator-only misuse without production reachability. Evidence: artifacts/02_discovery/coverage_frontend.jsonl, artifacts/02_discovery/coverage_repo.jsonl, artifacts/02_discovery/candidate_ledger.jsonl |
| Production transport | Compose port publication, Nginx TLS, AWS ingress, and client HTTPS enforcement | Reported | The repository-defined production path exposes authentication traffic over cleartext HTTP; the release client failing closed is retained as counterevidence. Evidence: artifacts/02_discovery/coverage_repo.jsonl, artifacts/02_discovery/coverage_frontend.jsonl, artifacts/02_discovery/candidate_ledger.jsonl |
| AI and scheduled processing | Post-analysis batching, retry state, transactions, locking, and provider failures | Reported | Failed analyses are immediately reeligible in an unpaged scheduled transaction. Evidence: artifacts/02_discovery/coverage_backend.jsonl, artifacts/02_discovery/candidate_ledger.jsonl |
| Archive and read amplification | Group archive pagination, media loading, filtering, grouping, and serialization | Reported | Active members can trigger a full unpaged archive fetch and materialization. Evidence: artifacts/02_discovery/coverage_backend.jsonl, artifacts/02_discovery/candidate_ledger.jsonl |
| Post write fan-out | groupIds cardinality, membership checks, database writes, carnation updates, and events | Reported | One post request can fan out across an unbounded attacker-accumulated group list. Evidence: artifacts/02_discovery/coverage_backend.jsonl, artifacts/02_discovery/candidate_ledger.jsonl |
| Mobile bridge and WebRTC | React Native session and upload flows, Kotlin bridge lifecycle, WebRTC message bounds | Rejected | The caption-stream candidate was rejected because raw frames originate from the backend-relayed trusted peer and the demonstrated impact is confined to the same user's device. Evidence: artifacts/02_discovery/coverage_frontend.jsonl, artifacts/02_discovery/candidate_ledger.jsonl |
| Repository tooling | Developer installation guidance and repository-local automation | Not applicable | The mutable Android CLI installer guidance is not executed by the product or CI. Evidence: artifacts/02_discovery/coverage_repo.jsonl, artifacts/02_discovery/candidate_ledger.jsonl |
| Whole-repository inventory closure | Deterministic path inventory and binary-unreviewable accounting | No issue found | All 1,052 inventory paths are present exactly once; 1,019 were source-reviewed and 33 binary artifacts were explicitly marked binary-unreviewable. Evidence: artifacts/02_discovery/coverage_backend.jsonl, artifacts/02_discovery/coverage_frontend.jsonl, artifacts/02_discovery/coverage_repo.jsonl, artifacts/03_coverage/reviewed_surfaces.md |
