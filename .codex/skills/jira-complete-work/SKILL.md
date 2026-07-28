---
name: jira-complete-work
description: Verify that the GitLab Merge Request for one S15P11B104 Jira ticket is merged into the correct target, then complete that Jira ticket. Always use this skill when the user says `$jira-complete-work`, asks to finish or close their Jira work after merge, says "MR 병합됐으니 Jira 완료해줘", or wants the current ticket finalized. Read the local Jira and Git conventions, resolve the Jira key and MR without asking for information already present in the branch or MR, use authenticated `glab` against `lab.ssafy.com` to verify the merged MR and pipeline evidence, allow existing legacy subtasks to finish, ensure the MR URL is linked in Jira, transition only the matching issue to Done through the Atlassian connector, and verify the final state. Never merge an MR, create a new subtask, delete a branch, or complete Jira before merge.
compatibility: Requires the Atlassian connector with Jira read/write access, authenticated `glab` access to `lab.ssafy.com`, Git access to the current repository, `docs/team-rules/jira-convention.md`, `docs/team-rules/git-convention.md`, and the in-app Browser when the connector cannot create Jira web links.
---

# Jira Complete Work

Complete one Jira issue only after its GitLab Merge Request has actually been merged into the expected target branch.

## Fixed project context

- Jira site: `https://ssafy.atlassian.net`
- Jira project: `S15P11B104`
- GitLab host: `lab.ssafy.com`
- GitLab project: `s15-webmobile2-sub1/S15P11B104`
- Integration branch: `develop`
- Jira convention: `docs/team-rules/jira-convention.md`
- Git convention: `docs/team-rules/git-convention.md`

## Keep this execution boundary

Complete only these outcomes:

1. Resolve one Jira key from the current work branch or an explicitly supplied MR URL.
2. Verify the matching Jira issue and its required fields.
3. Use `glab` to find and verify the exact merged MR.
4. Ensure the canonical MR URL is linked to the Jira issue.
5. Transition only that issue to the project's Done state through the Atlassian connector.
6. Re-fetch Jira and report the verified final state.

Do not merge or approve an MR, retry a failed pipeline, edit implementation files, commit, push, delete branches, create tickets or subtasks, change the Jira assignee, or complete any related issue automatically.

## Follow the workflow

### 1. Load the project conventions

Read both convention files at the start of every run. Stop before any external mutation if either file is missing or unreadable.

Apply these current rules:

- One work branch and MR correspond to one Jira ticket.
- Jira completion follows a verified MR merge.
- One Jira ticket has one assignee.
- Due date and Story Points from `1`, `2`, `3`, `5`, or `8` are required.
- New subtasks are prohibited, but an existing legacy subtask may be completed in place.
- Jira domain prefixes classify split technical Tasks but do not change issue type, Jira-key matching, or completion scope.
- The normal MR target is `develop`.

Follow the live files if they change.

### 2. Resolve one Jira issue

Prefer the Jira key encoded in the current valid work branch. If the user supplied an MR URL or IID, use `glab` to fetch that MR and extract the key from its source branch or title.

- Require exactly one unambiguous key matching `S15P11B104-[0-9]+`.
- Do not ask the user to retype a key already available from the branch or MR.
- If the branch and MR identify different keys, stop without mutation.

Use the Atlassian connector to discover the accessible cloud ID and fetch the issue with at least its key, summary, type, status, assignee, due date, Story Points, description, created date, transitions, and links.

Stop when the issue is missing, belongs to another project, or does not represent the same work. If it is already Done, continue in audit-only mode: verify every mandatory field, the exact merged MR, pipeline evidence when available, and the canonical MR link without applying another transition. Report `기존 완료 상태 확인` only when all evidence passes; otherwise report a noncompliant existing completion.

### 3. Validate the Jira record

Before completion, verify:

- exactly one assignee is present;
- due date is present;
- Story Points are `1`, `2`, `3`, `5`, or `8`;
- the description contains an observable completion criterion.

An existing `하위 작업` passes the type check as a legacy ticket. Do not convert it or create a replacement.

Use the live issue type rather than inferring it from `[FE]`, `[BE]`, `[AI]`, or `[COMMON]`. For a current-policy `[FE]`, `[BE]`, or `[AI]` Story, require its description and completion criterion to establish a distinct user-visible value rather than an ownership-only clone. `[COMMON]` is valid only for a Task whose description or relationships establish a foundation shared by at least two areas, never a Story or standalone Task. Do not rename a Jira summary during completion. If a current-policy title violates its Story-versus-Task role, report the violation and stop without Jira mutation. When the Jira summary has an allowed domain prefix, require the same prefix exactly once immediately after the Jira key in the MR title. When the Jira summary has no prefix, require the work summary immediately after the key and reject any invented domain prefix.

If a required field is missing or invalid, stop and report it. Do not infer an estimate, due date, assignee, or completion criterion during completion.

### 4. Verify GitLab authentication and project

Run:

```text
glab auth status --hostname lab.ssafy.com
```

Require a successful authenticated account stored through the configured credential mechanism. Confirm that the current repository and `glab` context resolve to `s15-webmobile2-sub1/S15P11B104`.

Do not display tokens or use credentials from repository files.

### 5. Verify the exact merged MR

Use `glab` to find an MR whose source branch or title contains the resolved Jira key as one complete token. The numeric suffix must end before any following digit, so `S15P11B104-12` never matches `S15P11B104-123`.

Require all of the following:

- exactly one matching MR, or one exact MR explicitly supplied by the user;
- MR state is merged;
- target branch is `develop`, unless the live Git convention specifies another target;
- source branch contains the same complete Jira-key token, not a longer key with the same prefix;
- MR title starts with the Jira key; it preserves the Jira summary's exact domain prefix once immediately after the key when present, and contains no domain prefix when Jira has none;
- canonical MR URL belongs to the expected GitLab project;
- the latest relevant pipeline is successful when pipeline information is available.

If the MR is open, closed without merge, targets the wrong branch, belongs to another project, has a failed or running required pipeline, or cannot be verified, stop without changing Jira. This skill never merges the MR.

### 6. Ensure Jira contains the MR URL

Inspect the Jira issue links for the exact canonical MR URL.

- If the issue was already Done when fetched, keep audit-only mode: do not create a missing link. Treat an absent canonical MR URL as a noncompliant existing completion and report it without Jira mutation.
- If already present, leave it unchanged.
- If missing, discover whether the Atlassian connector exposes remote-web-link creation and use it when available.
- If the connector can read but cannot create remote links, load `browser:control-in-app-browser` and read its `SKILL.md` completely before using it to open the exact Jira issue and add only the canonical GitLab URL through Jira's web-link UI.
- Do not put the URL in a Jira comment or description as a substitute for a remote link.
- Re-fetch the Jira links and verify the exact URL before transitioning status.

If linking fails, keep all existing state and stop before the Jira transition.

### 7. Transition Jira to Done

Fetch the issue's live transitions with the Atlassian connector. Select the transition whose destination belongs to Jira's Done status category; never guess or hard-code an ID.

Apply that transition only to the resolved issue. Do not complete an Epic, linked ticket, parent, child, or sibling automatically.

If the issue was already Done and all audit evidence passed, skip the transition and proceed to final verification.

After transition:

1. Re-fetch the issue.
2. Verify its key and Done status category.
3. Verify the assignee, due date, Story Points, and canonical MR URL are still present.

If the transition succeeds but verification fails, report the changed issue and unverified final state as a partial result. Do not apply another transition.

### 8. Report and stop

Use:

```text
Jira 작업 완료

티켓: <JIRA_KEY> <summary>
유형: <issue type, legacy subtask when applicable>
담당자: <display name>
Story Points: <1 | 2 | 3 | 5 | 8>
MR: <canonical GitLab URL>
병합: <source> → <target>, <merged timestamp>
파이프라인: <성공 | 정보 없음>
Jira 상태: <before> → <Done status>
```

If the issue was already Done, start with `기존 완료 상태 확인` and report the same evidence without implying a new mutation.

## Failure behavior

- Convention unavailable: make no GitLab or Jira mutation.
- Jira key missing or ambiguous: make no mutation.
- Jira issue missing, mismatched, or lacks required fields: make no mutation. For an already-Done issue, also treat a missing canonical MR link as noncompliant and do not repair it.
- `glab` unauthenticated or project context mismatched: make no mutation.
- Matching MR missing or ambiguous: make no mutation.
- MR not merged, wrong target, or required pipeline unsuccessful: make no Jira mutation.
- MR URL linking fails after connector and browser fallback checks: make no Jira status transition.
- Done transition unavailable: keep the verified MR link and report the blocker.
- Transition succeeds but verification fails: report a partial result and do not retry blindly.

Never claim completion from a GitLab or Jira command acknowledgement alone. Re-fetch both external states needed for the final claim.
