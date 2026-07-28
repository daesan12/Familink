---
name: jira-create-mr
description: Create one verified GitLab Merge Request for the Jira ticket represented by the current S15P11B104 work branch. Always use this skill when the user says `$jira-create-mr`, asks to open or create an MR, says "MR 만들어줘", or wants current Jira work submitted for review. Read the local Jira and Git conventions, identify the single Jira issue from the branch, verify implementation and repository state, create convention-compliant commits when needed, use authenticated `glab` against `lab.ssafy.com`, push safely, create or reuse the MR against `develop`, attach its canonical URL to Jira, and stop before merge or Jira completion.
compatibility: Requires the Atlassian connector with Jira read/write access, authenticated `glab` access to `lab.ssafy.com`, Git access to the current repository, `docs/team-rules/jira-convention.md`, `docs/team-rules/git-convention.md`, and the in-app Browser when the connector cannot create Jira web links.
---

# Jira Create MR

Turn the current Jira work branch into one review-ready GitLab Merge Request. The invocation is the user's request to perform the required commit, push, MR creation, and Jira-link actions, so do not ask for a second confirmation unless the operation would overwrite history or the target cannot be determined safely.

## Keep this execution boundary

Complete only these outcomes:

1. Resolve the Jira issue from the current branch without requiring manual Jira-key entry.
2. Check that the implementation belongs to one Jira issue and satisfies its recorded completion criteria.
3. Run the repository's relevant verification and inspect the final diff for review blockers.
4. Create convention-compliant commits for the current work when needed.
5. Push the work branch and create a GitLab Merge Request targeting `develop`.
6. Attach the created MR URL to the Jira issue.
7. Report the MR, verification, Jira-link result, and the merge-then-complete step.

Stop after reporting. Do not change the Jira status, assign reviewers, send Slack messages, merge the MR, delete the branch, or complete the Jira issue. After humans complete review and merge, `jira-complete-work` verifies the merge and completes Jira.

## Follow the workflow

### 1. Load the project conventions

Read `docs/team-rules/jira-convention.md` and `docs/team-rules/git-convention.md` at the start of every execution. Treat them together as the authority for one-ticket ownership, branch, commit, MR, protected-branch, target-branch, and Jira completion rules. If either is missing or unreadable, stop before committing, pushing, creating an MR, or changing Jira.

The current established rules include:

- One Jira ticket has one assignee and corresponds to one work branch and MR.
- Shared user-value Stories stay domain-neutral; a Story may use a domain prefix only for a distinct user-visible value and acceptance result, while split technical Tasks use `[FE]`, `[BE]`, `[AI]`, or `[COMMON]`.
- Work branch format: `<type>/<JIRA_KEY>-<short-work-name>`
- Allowed work types: `feature`, `fix`, `refactor`, `docs`, `chore`
- Commit format: `[JIRA_KEY] <type>: <작업 내용>`
- MR title format: `[JIRA_KEY] <work summary>`
- One MR corresponds to one Jira issue.
- Work branches target `develop`.
- Never push directly to `main` or `develop`.
- Never force-push a shared branch.

When the file changes, follow the live file rather than the summarized rules above.

### 2. Resolve and verify the current Jira issue

Inspect the current branch and require it to match the live branch convention. Extract the Jira key from the branch name; do not ask the user to copy or type a key that is already encoded in the branch.

Use the Atlassian connector for Jira reads and mutations:

1. Discover the accessible Atlassian site for project `S15P11B104`; do not assume a stale cloud ID.
2. Fetch the extracted issue with at least its key, summary, description, status, assignee, due date, Story Points, created date, and issue type.
3. Confirm that the issue exists, is not completed, describes the same work represented by the branch, has exactly one assignee, has an actual calendar due date, and has Story Points of `1`, `2`, `3`, `5`, or `8`.
4. Require a non-empty description that states the intended work and an observable completion criterion.

Treat the fetched Jira issue type as authoritative. Never infer Story versus Task from `[FE]`, `[BE]`, `[AI]`, or `[COMMON]`, and never rename the Jira summary in this workflow. For an `[FE]`, `[BE]`, or `[AI]` Story, verify from its description and completion criteria that it represents a distinct user-visible value rather than an ownership-only clone; `[COMMON]` is never valid on a Story. For a current-policy Task, require one allowed prefix when it is a technical execution unit split from a shared Story, allow no prefix for standalone planning, research, presentation, or other single-scope work, and use `[COMMON]` only for a foundation shared by at least two areas. If the current Jira title clearly violates its role, stop rather than repairing it in this skill.

If the branch is protected, malformed, lacks a Jira key, refers to a missing or completed issue, lacks a mandatory Jira field or completion criterion, or mixes work for another issue, stop without commit, push, MR, or Jira mutation and report the exact blocker. Do not infer or repair the assignee, due date, Story Points, description, or summary in this skill.

### 3. Inspect repository and MR state

Inspect the worktree, commits, remotes, upstream configuration, and the diff from the current branch to `develop` or `origin/develop`.

- Preserve all existing user changes.
- Reject merge conflicts, unresolved files, empty diffs, and unrelated changes that violate the one-issue-per-MR rule.
- Run `glab auth status --hostname lab.ssafy.com` and require a successful authenticated account before any GitLab mutation.
- Confirm that the repository remote and `glab` project context resolve to `s15-webmobile2-sub1/S15P11B104`.
- Use `glab` to check whether an open MR already exists for the exact source branch. If one exists, do not create a duplicate. Re-fetch it and require the exact source branch, target `develop` unless the live convention says otherwise, an open state, and a title beginning with `[JIRA_KEY]`. If the Jira summary has an allowed domain prefix, require that same prefix exactly once and immediately after the key; if the Jira summary has no prefix, require the work summary immediately after the key and do not invent one. Reject a title that merely contains the key, moves an existing prefix elsewhere, duplicates it, or adds a prefix absent from Jira. Also require a canonical URL in the expected project. If any property is incompatible, stop instead of reusing or creating another MR. Otherwise report its URL and ensure that URL is attached to Jira.
- Never amend, rebase, reset, delete, or force-push unless the user separately requests that history-changing action.

### 4. Verify the implementation

Derive verification from the repository's own documented commands, build configuration, and changed modules. Run the narrow relevant checks first, followed by any required project gate such as formatting, static analysis, tests, or build.

Also inspect the final diff for:

- passwords, API keys, tokens, `.env` files, personal data, or other sensitive material;
- debug code, accidental generated files, and temporary artifacts;
- missing behavior required by the Jira completion criteria;
- changes unrelated to the selected Jira issue.

Use the artifact through its matching surface when practical so that passing compilation alone is not treated as proof of behavior. If a required check fails or cannot be performed, stop before commit, push, MR creation, and Jira mutation. Report the failed or unavailable check and the evidence needed to proceed.

### 5. Commit, push, and create the Merge Request

If tracked or intended new files remain uncommitted after verification, group them into the smallest logical commits that preserve the one-change-per-commit rule. Stage only files that belong to the Jira issue. Build each message from the actual staged diff and follow the live convention:

```text
[S15P11B104-123] feat: 로그인 폼 구현
```

Do not create vague messages such as `update`, `수정`, or `작업`. Do not rewrite existing commits solely to change their wording unless the live convention makes the current history unusable and the user explicitly approves rewriting it.

Before pushing, validate every commit unique to the work branch against the live commit convention and the resolved Jira key. If an existing commit is noncompliant, stop and report it rather than rewriting history automatically.

Push only the current work branch using a normal push. Never push directly to `main` or `develop`, and never use force push.

Use `glab` to create one GitLab Merge Request with:

- source: the current work branch;
- target: `develop`, unless the live convention explicitly specifies another target;
- title: `[JIRA_KEY] 작업 내용`;
- description containing `작업 목적`, `주요 변경 사항`, `테스트 방법과 결과`, `리뷰어가 확인할 내용`, and `관련 Jira 이슈 키`;
- Draft state only when the work is explicitly still in progress; otherwise create it ready for review.

Build the title and body from the Jira issue, actual diff, commit history, and observed verification results. When the Jira summary has an allowed domain prefix, preserve it exactly once in the MR work summary, producing a title such as `[S15P11B104-123] [FE] 통화 리포트 조회 화면 구현`. Do not copy the domain prefix into the branch name or place it before the Jira key. Never claim a test or behavior was verified when it was not run and observed.

After creation, re-fetch the MR with `glab` and verify its canonical URL, source branch, target branch, title, Draft state, and open state. Do not treat the create command alone as completion.

### 6. Attach only the MR URL to Jira

After GitLab returns the canonical MR URL, inspect the issue's remote links first.

1. Discover whether the Atlassian connector currently exposes a remote-web-link creation capability. Use it when available.
2. If the connector can read but cannot create remote links, load `browser:control-in-app-browser` and read its `SKILL.md` completely before using it to open the exact Jira issue and add the canonical GitLab URL through Jira's web-link UI.
3. In the browser fallback, add only the URL and a concise GitLab MR label. Do not edit the description, add a comment, transition status, or change another field as a substitute.
4. Re-fetch the issue's remote links through the Atlassian connector and verify that the exact canonical URL persisted, regardless of which write surface was used.

This is the only Jira mutation in this skill. Do not transition the Jira status, edit its description, add a comment, change its assignee, modify fields, or mark it complete. Do not send or draft a Slack announcement.

If neither connector link creation nor the authenticated Jira web-link UI is available, keep the MR and report the partial result with its URL. Do not weaken the requirement by putting the URL in a comment or description, and do not delete or recreate the MR.

### 7. Report and stop

Use this compact structure:

```text
MR 생성 완료

티켓: <JIRA_KEY> <summary>
브랜치: <source> → develop
검증: <checks and results>
MR: <title>
URL: <canonical GitLab MR URL>
Jira 연결: <완료 | 실패: reason>
다음 단계: MR 리뷰·병합 후 jira-complete-work
```

If an existing MR was reused, start with `기존 MR 확인 완료`. Report failures with the last successful step and make clear which external state, if any, was already changed.

## Failure behavior

- Jira or Git convention unavailable: make no Git or Jira mutation.
- Invalid or protected current branch: make no Git or Jira mutation.
- Jira issue unavailable, completed, or inconsistent with the branch: make no mutation.
- Jira issue lacks exactly one assignee, a due date, allowed Story Points, intended work, or an observable completion criterion: make no commit, push, MR, or Jira mutation.
- `glab` authentication, expected project context, or MR capability unavailable: make no commit, push, or Jira mutation.
- Dirty work includes unrelated or ambiguous files: do not stage or commit them; stop and report the files requiring user disposition.
- Verification fails or required verification is unavailable: make no commit, push, MR, or Jira mutation.
- Normal push is rejected: do not force push; report the remote divergence.
- MR creation fails after push: keep the pushed branch and report the partial result.
- Jira linking fails after connector and browser fallback checks: keep and report the MR URL; do not perform another Jira mutation.

Never silently broaden the workflow, weaken verification, invent Jira data, or claim external actions succeeded without checking their results.
