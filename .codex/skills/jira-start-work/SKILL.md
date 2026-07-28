---
name: jira-start-work
description: Prepare one assigned S15P11B104 Jira ticket and its Git branch without starting implementation. Always use this skill when the user says `$jira-start-work`, asks to start or resume Jira work, asks "내 작업 시작하자" or "지금 할 티켓 보여줘", or wants the agent to choose a current ticket and prepare its branch. Read the local Jira and Git conventions, use the Atlassian connector to list unfinished tickets assigned to the authenticated user, allow existing legacy subtasks to finish but never create new ones, require a due date and Story Points from 1, 2, 3, 5, or 8, run a read-only Git safety preflight before Jira mutation, preserve an already sufficient Jira description without reconfirmation, complete only missing context, create or reuse the convention branch, transition the issue to In Progress, and stop before implementation.
compatibility: Requires the Atlassian connector plugin with Jira read/write access, Git access to the current repository, `docs/team-rules/jira-convention.md`, and `docs/team-rules/git-convention.md`.
---

# Jira Start Work

Prepare one Jira issue and its Git branch for the next planning step. Treat `start` as starting the ticket workflow, not starting implementation.

## Fixed project context

- Jira site: `https://ssafy.atlassian.net`
- Jira project: `S15P11B104`
- Atlassian cloud ID: discover it with the Atlassian connector; do not assume a stale ID.
- Jira convention source: `docs/team-rules/jira-convention.md`
- Git convention source: `docs/team-rules/git-convention.md`
- Integration branch: `develop`

## Keep this execution boundary

Complete only these outcomes:

1. Show the authenticated user's unfinished assigned issues.
2. Let the user select one issue without requiring them to type its Jira key.
3. Validate one assignee, due date, and allowed Story Points; identify missing policy fields.
4. Run a read-only Git safety preflight and stop before any Jira mutation when branch preparation would be unsafe.
5. Preserve a sufficient Jira description without another question, or collect and write only missing work context and explicitly supplied policy fields.
6. Prepare or reuse the issue's valid work branch.
7. Transition the selected issue to `진행 중` through the Atlassian connector when needed.
8. Report the selected issue, Jira fields, description result, Jira status, branch, and next step.

Stop immediately after reporting. Do not create an implementation plan, inspect the code for implementation, edit files, run implementation tests, commit, push, or create a Merge Request.

## Follow the workflow

### 1. Load the project conventions

Read both local convention files at the start of every execution:

- `docs/team-rules/jira-convention.md`
- `docs/team-rules/git-convention.md`

Extract the required Jira fields, legacy-subtask rule, branch format, allowed branch types, base branch, and protected-branch rules. If either file cannot be read, stop before changing Git or Jira. Do not reconstruct a missing convention from memory or an older Notion page.

The currently established rules are:

- One Jira ticket has one assignee.
- Due date and Story Points are required.
- Story Points use `1`, `2`, `3`, `5`, or `8`.
- New subtasks are prohibited, but existing subtasks may be completed in place.
- A shared user-value Story stays domain-neutral; technical Tasks split from it use `[FE]`, `[BE]`, `[AI]`, or `[COMMON]`.
- Branch format: `<type>/<JIRA_KEY>-<short-work-name>`
- Allowed types: `feature`, `fix`, `refactor`, `docs`, `chore`
- Work branches start from `develop`.
- The Jira key is mandatory.
- The work name uses short lowercase English words separated by hyphens.
- Never add a `codex/` prefix unless the live convention is changed to require it.
- Never commit or push directly to `main` or `develop`.

### 2. Find the user's Jira issues with the Atlassian connector

Use the Atlassian connector for every Jira read and mutation in this workflow. Do not replace it with browser automation, guessed data, or manual Jira-key entry.

1. Get the authenticated Atlassian user.
2. Get accessible Atlassian sites and select `https://ssafy.atlassian.net`.
3. Search with Jira JQL:

```jql
project = S15P11B104
AND assignee = currentUser()
AND statusCategory != Done
ORDER BY updated DESC
```

Request at least `key`, `summary`, `description`, `status`, `issuetype`, `assignee`, `duedate`, Story Points, `created`, and `updated`. Sort the returned issues for display so already-in-progress work appears first, then the remaining issues by most recently updated.

If no issue is found, report that there is no assigned unfinished issue in the project and stop without changing Git or Jira.

### 3. Let the user choose

Display a compact numbered list containing the summary and current status. Include the Jira key for traceability, but never require the user to copy or type it.

Accept a list number or an unambiguous title phrase. If the choice is ambiguous, ask the user to choose from the narrowed list.

Make the effect of selection clear: after selection, the agent will validate the mandatory ticket fields, check Git safety without changing it, ask for only missing policy data or work context, update Jira only when needed, prepare the branch, and transition the issue to `진행 중`. Do not mutate Git or Jira before the selection is explicit.

### 4. Validate the Jira convention

After the user selects an issue, fetch the complete issue and verify:

- the authenticated user is its single assignee;
- the due date is an actual calendar date;
- Story Points are exactly `1`, `2`, `3`, `5`, or `8`;
- the issue is not completed.

An existing `하위 작업` is a legacy ticket and may continue unchanged. Do not convert it or create another subtask.

Treat the Jira issue type field as authoritative: a `[FE]` prefix does not turn a Story into a Task. For tickets created under the current prefix policy, accept domain-neutral shared Stories; allow an `[FE]`, `[BE]`, or `[AI]` Story only when its description establishes a distinct user-visible value and acceptance result; reject `[COMMON]` on a Story; validate that a technical Task split from a shared Story has exactly one allowed domain prefix; and accept `[COMMON]` only when the description or issue relationships establish a foundation shared by at least two areas. A standalone or single-area Task must remain unprefixed. Preserve older tickets created before the policy without renaming them. This skill never edits a summary; if a current-policy ticket clearly violates the title rule, stop before Git or Jira mutation and report that the title must be corrected through a separately authorized Jira edit.

If the due date or Story Points are missing or invalid, identify only those missing values for the later compact question. Never estimate Story Points or invent a date. Do not edit them until the read-only Git safety preflight succeeds.

If the issue is not assigned to the authenticated user, stop rather than reassigning it. Reassignment is outside this skill.

### 5. Preflight the current Git work without mutation

Inspect the current repository, branch, worktree, and existing local and remote branches without changing them.

- If the current branch is already a valid branch for the selected Jira key, it can be reused. Existing changes may remain because this is a resume operation.
- If creating or switching branches is necessary and the worktree has uncommitted changes, stop before editing Jira, changing Git, or transitioning status.
- If an existing branch for the Jira key violates the live convention, stop before mutation and report the conflict. Do not rename, delete, or replace it automatically.
- Confirm that `develop` or `origin/develop` exists before any Jira edit that would be followed by branch creation.

This ordering prevents a Jira-only partial result when the local repository cannot safely prepare the selected ticket's branch.

### 6. Collect and record only missing Jira context

Fetch the issue's full current description with the Atlassian connector and determine whether it already states both the intended change and an observable completion result. Jira needs enough context for teammates to understand and verify the work, not a full implementation specification.

If the description already contains both elements and the policy fields are valid, preserve it as-is and proceed without asking a confirmation question or editing Jira.

Ask one compact question only when at least one description element or policy field is missing. Include only the missing items:

```text
이 티켓에서 무엇을 바꾸고, 완료되면 어떤 상태여야 하나요? <필요한 경우: 기한과 Story Points(1·2·3·5·8)>도 함께 알려주세요.
```

- The minimum required information is the intended change and an observable completion result.
- Accept one natural-language sentence when it covers both elements. Do not force the user to fill out a form.
- Ask one follow-up only when either required element is missing, and ask only for the missing element.
- If the existing description already contains both elements but a policy field is missing, ask only for that policy field.
- Do not ask for implementation details, file names, estimates, or test commands unless the user volunteers them.

Convert the confirmed information into a concise Jira description block:

```markdown
## 작업 설명
<what will change and why>

## 완료 기준
- <observable result that proves the work is complete>

## 범위 및 제약
- <include only when the user provided constraints or exclusions>
```

Preserve the issue's existing description because sprint notes, links, and prior decisions may already be there. Merge with semantically equivalent sections when they exist; otherwise append the new block. Never erase or replace unrelated existing text, and never invent requirements the user did not provide.

Use the Atlassian connector's issue-edit capability only when the description or a policy field actually needs an update. Send the complete merged `description` and only the missing `duedate` or Story Points fields explicitly supplied in this run. The user's adequate answer authorizes this update, so do not add a second confirmation step unless the new text conflicts with existing requirements. Do not change the summary, assignee, or unrelated fields.

After editing, fetch the issue again and verify the description, due date, Story Points, and assignee. If no edit was needed, use the already fetched complete issue as the verified record. If the edit or verification fails, make no Git mutation or status transition; report the Jira-field failure and stop. If the user declines to provide required information, stop without changing Jira or Git.

### 7. Prepare the convention-compliant branch

Reuse a valid existing branch when available. Otherwise infer the narrowest allowed type from the Jira issue:

- Bug or defect: `fix`
- Explicit refactoring: `refactor`
- Documentation-only work: `docs`
- Build, configuration, dependency, or maintenance work: `chore`
- All other product work: `feature`

Create a short lowercase English slug from the issue summary. Strip the leading Jira domain marker such as `[FE]`, `[BE]`, `[AI]`, or `[COMMON]` before deriving the slug; the branch identifies the domain through its Jira key and work meaning, not by copying the bracketed title marker. The final branch must match:

```text
^(feature|fix|refactor|docs|chore)/S15P11B104-[0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*$
```

Fetch the remote state and create a new work branch from the latest `origin/develop` when available. Never create the work branch from `main`, `master`, or an unrelated feature branch.

Example:

```text
fix/S15P11B104-124-network-error
```

### 8. Transition Jira with the Atlassian connector

After the branch is ready, fetch the selected issue's available workflow transitions with the Atlassian connector. Find the transition whose destination is the project's `진행 중` state and apply its actual transition ID. Never hard-code or guess a transition ID.

If the issue is already in progress, skip the transition. If the transition fails after branch creation, keep the branch, report the partial result clearly, and stop. Do not delete or rewrite the branch automatically.

### 9. Report and stop

Use this exact compact structure:

```text
작업 준비 완료

티켓: <JIRA_KEY> <summary>
Jira 설명: <업데이트 완료 | 기존 설명 유지>
담당자: <display name>
기한: <YYYY-MM-DD>
Story Points: <1 | 2 | 3 | 5 | 8>
Jira 상태: <before> → <after>
브랜치: <branch-name>
기준 브랜치: develop
다음 단계: 구현 계획 수립
```

For an already-in-progress issue, show `Jira 상태: 진행 중 (변경 없음)`.

Do not add ticket-quality analysis, completion-condition analysis, dependency notes, or general recommendations.

## Failure behavior

- Jira or Git convention unavailable: make no Git or Jira mutation and report the unavailable source.
- Atlassian connector unavailable or unauthorized: make no Git or Jira mutation and report the connection problem.
- No assigned unfinished issue: make no mutation and report that no candidate exists.
- Selected issue is assigned to another person: do not reassign it and make no mutation.
- Required due date, Story Points, or minimum work description unavailable or declined: make no mutation and report that the ticket was not prepared.
- Current-policy ticket has a missing, duplicated, or disallowed domain prefix for its issue role: do not rename it and make no mutation.
- Jira field update or verification failed: make no Git mutation or status transition and report the field failure.
- Unsafe Git state: make no Git or Jira mutation and report the Git condition that prevents branch preparation.
- Branch prepared but Jira transition failed: report the branch and the failed Jira transition as a partial result.

Never silently fall back to a different tool or broaden the workflow into planning or implementation.
