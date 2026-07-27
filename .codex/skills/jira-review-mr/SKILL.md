---
name: jira-review-mr
description: Review one S15P11B104 GitLab Merge Request against its Jira issue, local specifications, project conventions, complete diff, discussions, and CI evidence. Always use this skill when the user invokes `$jira-review-mr`, asks to review or check a GitLab MR, says "MR 리뷰해줘" or "MR 봐줘", wants review comments posted, or asks to approve an MR for this project. Resolve the exact MR and Jira issue, perform a read-only defect-first review by default, publish comments only when explicitly requested, approve only after explicit authorization and strict revalidation, verify every GitLab write, and never merge or complete Jira.
compatibility: Requires authenticated `glab` access to `lab.ssafy.com`, Git access to the current repository, `docs/team-rules/jira-convention.md`, `docs/team-rules/git-convention.md`, and Jira read access through the Atlassian connector. Uses the local `review-agent` skill when available.
---

# Jira Review MR

GitLab Merge Request 하나를 Jira 완료 기준과 실제 코드 변경에 맞춰 검토한다. 기본 동작은 읽기 전용이다. 사용자가 단순히 리뷰를 요청한 것은 GitLab 댓글 게시, 승인, 병합을 허가한 것이 아니다.

## 고정 프로젝트

- Jira 프로젝트: `S15P11B104`
- GitLab 호스트: `lab.ssafy.com`
- GitLab 프로젝트: `s15-webmobile2-sub1/S15P11B104`
- 기본 대상 브랜치: `develop`
- Jira 규칙: `docs/team-rules/jira-convention.md`
- Git 규칙: `docs/team-rules/git-convention.md`

라이브 규칙이 바뀌면 파일의 현재 내용을 우선한다.

## 실행 모드와 권한 경계

사용자 요청에서 허용된 모드만 실행한다.

1. **리뷰·보고**: 기본 모드다. MR, Jira, 코드, 토론, CI를 읽고 발견 사항을 로컬 응답으로만 보고한다.
2. **리뷰 코멘트 게시**: 사용자가 `코멘트를 남겨줘`, `GitLab에 게시해줘`처럼 외부 게시를 명시한 경우에만 실행한다.
3. **승인**: 사용자가 `승인해줘`, `approve 해줘`, `문제가 없으면 승인해줘`처럼 승인을 명시한 경우에만 실행한다.

코멘트 게시와 승인은 서로 다른 권한이다. 하나를 요청했다고 다른 하나까지 수행하지 않는다. 어떤 모드에서도 MR 병합, 소스 수정, 커밋, 푸시, 브랜치 삭제, 토론 임의 해결, Jira 필드 수정·상태 전환을 수행하지 않는다.

## 리뷰 절차

### 1. 프로젝트 규칙과 리뷰 기준을 읽는다

매 실행마다 다음을 먼저 읽는다.

1. 적용 가능한 `AGENTS.md`와 `CLAUDE.md`
2. Jira 및 Git 컨벤션
3. 로컬 `review-agent` 스킬이 있으면 그 전체 내용

코드 변경이 로컬 제품 스펙과 관련되면 `docs/specs/INDEX.md`에서 관련 스펙을 찾고 `AI 작업 컨텍스트`를 먼저 읽는다. API는 `docs/specs/contracts/API.md`, 데이터는 `docs/specs/contracts/DATA_MODEL.md`를 기준으로 한다. `미결정 사항`은 구현 기준으로 사용하지 않는다.

`.codegraph/`가 있고 코드 구조, 호출 흐름 또는 변경 영향을 확인해야 하면 프로젝트의 CodeGraph 지침을 따른다.

### 2. 정확히 하나의 MR을 식별한다

식별 우선순위는 다음과 같다.

1. 사용자가 명시한 MR URL 또는 IID
2. 사용자가 명시한 소스 브랜치
3. 현재 브랜치에 연결된 열린 MR

다음을 모두 확인한다.

- `glab auth status --hostname lab.ssafy.com` 성공
- 원격 저장소와 `glab` 프로젝트가 고정 GitLab 프로젝트와 일치
- MR이 정확히 하나이며 조회 가능
- MR의 canonical URL, IID, 상태, Draft 여부, 작성자, 소스·대상 브랜치
- 최초 `head_sha`와 `diff_refs`

현재 브랜치에 MR이 없거나 후보가 여러 개면 추측하지 말고 중단한다. 다른 프로젝트 MR, 닫힌 MR, 이미 병합된 MR은 코드 리뷰 대상으로 명시된 경우 읽기 전용으로만 검토하고 코멘트·승인은 하지 않는다.

### 3. Jira와 MR의 추적 관계를 검증한다

MR 제목과 소스 브랜치에서 완전한 `S15P11B104-[0-9]+` 키 하나를 추출한다. 숫자 접두사가 같은 다른 키를 부분 일치시키지 않는다.

Atlassian 커넥터로 해당 Jira 이슈를 읽고 최소한 다음을 확인한다.

- 이슈 키, 요약, 유형, 상태
- 설명과 관찰 가능한 완료 기준
- 담당자, 기한, Story Points

다음 컨벤션도 점검한다.

- 하나의 MR은 하나의 Jira 이슈만 다룬다.
- 일반 작업 MR의 대상은 `develop`이다.
- MR 제목은 `[JIRA_KEY] 작업 내용` 형식이다.
- Jira 제목에 `[FE]`, `[BE]`, `[AI]`, `[COMMON]`이 있으면 MR 제목에서 Jira 키 바로 뒤에 정확히 한 번 유지한다.
- Jira 제목에 영역 접두사가 없으면 MR에 새 접두사를 만들지 않는다.

Jira 조회 실패가 코드 자체의 읽기 전용 리뷰를 막지는 않지만, 추적성 검증 누락으로 보고하고 코멘트 게시와 승인은 중단한다. Jira 필드를 이 스킬에서 보완하거나 수정하지 않는다.

### 4. 변경 스냅샷을 고정한다

리뷰 시작 시 확보한 `head_sha`와 `diff_refs`를 리뷰 기준으로 기록한다.

- `glab mr view <iid> --output json` 또는 GitLab API로 MR 메타데이터를 가져온다.
- `glab mr diff <iid> --raw --color=never`로 전체 변경을 확인한다.
- `glab mr note list <iid> --output json` 또는 API로 기존 토론과 미해결 토론을 확인한다.
- MR 소스 브랜치의 최신 파이프라인 상태를 확인한다.

`glab mr note`의 diff 토론 기능은 실험적이므로 실패 가능성을 전제로 한다. 댓글을 게시해야 할 때만 GitLab REST API를 대체 경로로 사용한다.

현재 작업 트리가 MR의 정확한 `head_sha`가 아니면 사용자 작업 트리를 체크아웃·리셋하지 않는다. 주변 코드나 테스트 실행에 정확한 MR 파일 트리가 필요하면 검증된 임시 경로에 해당 SHA의 detached worktree를 만들고, 사용 전후 경로가 임시 디렉터리 안인지 확인한다. 기존 미커밋 변경은 절대 이동하거나 덮어쓰지 않는다.

### 5. 결함 중심으로 전체 변경을 리뷰한다

`review-agent`의 기준을 적용해 전체 diff와 필요한 주변 코드를 끝까지 검토한다. 다음 조건을 모두 만족하는 발견 사항만 보고한다.

- 이번 MR이 새로 만든 문제다.
- 정확성, 보안, 성능 또는 유지보수성에 의미 있는 영향을 준다.
- 재현 가능한 시나리오나 호출 경로가 있다.
- 작성자가 알면 수정할 가능성이 높은 구체적인 문제다.

스타일 취향, 근거 없는 가능성, 기존 결함, 의도된 변경은 발견 사항으로 만들지 않는다.

우선순위는 다음과 같다.

- `P0`: 보편적인 배포 차단 또는 치명적 실패
- `P1`: 다음 수정이 시급한 결함
- `P2`: 일반적인 수정 필요 결함
- `P3`: 영향은 낮지만 수정 가치가 있는 결함

각 발견 사항은 변경된 줄과 겹치는 가장 좁은 파일·줄 범위를 사용한다.

```text
[P1] 명령형 발견 사항 제목 — path/to/file:line

영향을 받는 조건과 잘못된 결과를 한 문단으로 설명한다.
```

발견 사항이 없으면 `No findings.`라고 명시한다. 발견 사항을 채우기 위해 만들지 않는다.

### 6. 변경 범위에 맞는 검증을 확인한다

MR 파이프라인과 저장소의 실제 검증 명령을 확인한다. 변경된 모듈에 비례해 정적 분석, 테스트, 빌드 또는 실행 검증 결과를 직접 확인한다.

- 성공하지 않은 파이프라인을 성공으로 해석하지 않는다.
- 실행하지 못한 검증은 잔여 위험으로 명시한다.
- 테스트 실패 원인이 코드와 무관하다고 추정하지 않는다.
- 리뷰 목적으로 테스트를 실행해도 소스 파일을 수정하지 않는다.

파이프라인 실패나 검증 공백이 있어도 읽기 전용 리뷰 결과는 보고할 수 있지만 승인하지 않는다.

### 7. 게시 전에 MR이 변하지 않았는지 재확인한다

리뷰가 끝나면 MR을 다시 조회해 현재 `head_sha`를 최초 값과 비교한다.

- SHA가 달라졌으면 결과를 `stale review`로 표시한다.
- 이전 SHA에서 찾은 내용을 참고용으로만 보고한다.
- 코멘트를 게시하거나 승인하지 않는다.
- 새 SHA에 대한 재리뷰가 필요하다고 안내한다.

이 검사는 명시적 게시·승인 요청보다 우선한다.

## 명시적으로 요청된 GitLab 코멘트 게시

사용자가 게시를 명시했고 모든 사전 검증이 통과한 경우에만 다음을 수행한다.

1. 기존 토론을 다시 조회해 같은 파일·줄·핵심 내용의 중복을 피한다.
2. 변경된 줄에 정확히 대응하는 발견 사항은 resolvable inline discussion으로 게시한다.
3. 변경 줄에 안전하게 연결할 수 없는 발견 사항은 사용자가 요약 댓글도 요청한 경우에만 일반 댓글로 게시한다.
4. `glab mr note create`가 실패하면 최신 `diff_refs`를 사용한 GitLab Discussions API를 한 번의 대체 경로로 사용한다.
5. 게시 후 토론을 다시 조회해 파일, 줄, 본문, discussion ID가 실제 저장됐는지 확인한다.

일부 게시만 성공하면 성공한 discussion ID와 실패한 발견 사항을 구분해 보고한다. 성공한 댓글을 삭제하거나 중복 재게시하지 않는다.

## 명시적으로 요청된 승인

승인은 다음 조건을 모두 만족할 때만 수행한다.

- 사용자가 이번 요청에서 승인을 명시했다.
- MR이 열려 있고 Draft가 아니다.
- 대상 브랜치, Jira 키, 제목, 프로젝트가 컨벤션과 일치한다.
- Jira 완료 기준을 읽고 변경이 이를 충족한다.
- 현재 `head_sha`가 리뷰 기준 SHA와 같다.
- 최신 관련 파이프라인이 성공했다.
- P0, P1, P2 발견 사항이 없다.
- 해결되지 않은 차단 토론이나 병합 충돌이 없다.
- 현재 계정이 GitLab의 승인 규칙상 승인할 수 있다.

모두 통과하면 SHA를 고정해 실행한다.

```text
glab mr approve <iid> --sha <head_sha>
```

승인 후 GitLab 승인 상태를 다시 조회해 현재 계정의 승인이 해당 SHA에 기록됐는지 확인한다. 명령 성공만으로 완료라고 보고하지 않는다. 승인 조건이 하나라도 부족하면 승인하지 않고 정확한 차단 사유를 보고한다.

## 결과 형식

발견 사항을 가장 먼저 제시한다.

```text
MR 리뷰 완료 | 수정 필요 | 재리뷰 필요 | 승인 완료

발견 사항
<P0-P3 목록 또는 No findings.>

MR: !<iid> <title>
URL: <canonical URL>
기준 SHA: <head_sha>
Jira: <key> <summary> | 확인 실패
CI: <상태와 확인 근거>
기존 미해결 토론: <개수와 핵심>
검증: <실행·확인한 항목>
외부 변경: 없음 | 코멘트 <discussion IDs> | 승인 <검증 결과>
잔여 위험: <없음 또는 실행하지 못한 검증>
다음 단계: <수정 후 재리뷰 | 병합 가능 | 사용자 확인 필요>
```

코멘트나 승인 권한이 없었던 기본 리뷰에는 `외부 변경: 없음`을 반드시 명시한다. `병합 가능`은 상태 판정일 뿐 병합을 수행하라는 뜻이 아니다.

## 실패 시 안전 동작

- 인증·프로젝트·MR 식별 실패: 외부 변경 없이 중단한다.
- Jira 또는 컨벤션 조회 실패: 코드 리뷰는 읽기 전용으로 계속할 수 있지만 게시·승인은 중단한다.
- MR SHA 변경: 게시·승인 없이 재리뷰를 요구한다.
- 파이프라인 실패·미완료·조회 불가: 승인하지 않는다.
- P0~P2 또는 미해결 차단 토론 존재: 승인하지 않는다.
- 인라인 댓글 위치가 최신 diff와 일치하지 않음: 해당 댓글을 게시하지 않는다.
- 일부 댓글 게시 후 실패: 성공한 댓글을 보존하고 확인된 부분 결과를 보고한다.
- 승인 검증 실패: 병합하거나 다른 방식으로 우회하지 않는다.

외부 상태를 변경하지 않았는데 변경했다고 말하거나, 확인하지 않은 CI·테스트·승인을 성공으로 보고하지 않는다.
