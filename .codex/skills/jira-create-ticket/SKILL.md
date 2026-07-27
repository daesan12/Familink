---
name: jira-create-ticket
description: Create convention-compliant S15P11B104 Jira tickets from short natural-language requests. Always use this skill when the user says `$jira-create-ticket`, asks to create, register, add, split, or estimate a Jira ticket, issue, task, bug, story, or epic, asks for a subtask, or wants team work divided among several people. Read `docs/team-rules/jira-convention.md`, require exactly one assignee, an explicit due date, and Story Points from 1, 2, 3, 5, or 8 for every new ticket, prevent new subtasks and duplicate work, keep one shared user-value Story, split its implementation into linked standard Tasks with `[FE]`, `[BE]`, `[AI]`, or `[COMMON]` when applicable, generate only evidence-supported descriptions and completion criteria, create through the Atlassian connector, and verify every saved field.
compatibility: Requires the Atlassian connector plugin with Jira read/write access to https://ssafy.atlassian.net.
---

# Jira Create Ticket

Create one or more new Jira issues from the smallest useful amount of user input. Jira needs a valid record; teammates need enough context to understand and verify it. Satisfy both without turning ticket creation into a form-filling interview.

## Fixed project boundary

- Jira site: `https://ssafy.atlassian.net`
- Jira project: `S15P11B104`
- Jira convention source: `docs/team-rules/jira-convention.md`
- Discover the accessible Atlassian cloud ID on every run. Do not rely on a stored cloud ID.
- Use the Atlassian connector for all Jira reads and mutations.
- Create new standard issues and their requested relationships only. Never create a new subtask. Do not otherwise edit existing issue fields, transition status, create a branch, inspect implementation code, commit, push, or create a Merge Request.
- Report `jira-start-work` as the next step, but never invoke it automatically.

## Treat the request as authorization

An explicit request such as `생성해줘`, `등록해줘`, `추가해줘`, or `티켓 파줘` authorizes the described Jira creation. Do not ask for a second preview confirmation when the target and required fields are clear.

Requests for a draft, example, plan, preview, or dry run do not authorize a Jira mutation. In those cases, perform read-only discovery when useful and show the proposed issue fields without creating anything.

A request to create a subtask does not authorize silently creating a different issue type. Explain that new subtasks are prohibited and ask one compact question to confirm a standard ticket and its Epic or issue-link relationship.

## Ask the minimum question

Most requests should require no follow-up. Extract the work from the user's words and current conversation before asking anything.

The project policy requires exactly one assignee, an explicit due date, and Story Points even when Jira's create metadata marks those fields optional. A valid due date is an actual calendar date. Story Points must be one of `1`, `2`, `3`, `5`, or `8`. Do not infer or silently default either value. `나`/`저` resolves to the authenticated user.

When the invocation contains no actionable work, ask exactly one compact question:

```text
어떤 작업을 등록할까요? 담당자 한 명, 기한(YYYY-MM-DD), Story Points(1·2·3·5·8)를 함께 알려주세요.
```

When the work is already clear, ask only for whichever required responses are missing, combined into one question. Examples:

- Missing all policy fields: `담당자 한 명, 기한(YYYY-MM-DD), Story Points(1·2·3·5·8)를 알려주세요.`
- Missing only assignee: `담당자를 알려주세요.`
- Missing only due date: `기한(YYYY-MM-DD)을 알려주세요.`
- Missing only Story Points: `Story Points를 1·2·3·5·8 중 하나로 알려주세요.`

Ask one focused clarification only when a missing choice would create a materially different record:

- The required assignee is missing or matches multiple Jira users.
- The required due date is missing, invalid, or ambiguous.
- Story Points are missing, outside the allowed scale, or greater than `8`.
- A subtask is requested and the replacement standard-ticket relationship is not confirmed.
- Multiple assignees are requested but independently completable ticket scopes are not clear.
- Shared story work is being split but the execution domain for a resulting Task cannot be determined as `FE`, `BE`, `AI`, or `COMMON`.
- The request clones one user value into ownership-only `[FE]`, `[BE]`, or `[AI]` Stories.
- The request puts `[COMMON]` on a Story or puts a domain prefix on standalone planning, research, presentation, or other single-scope work.
- The request contains conflicting issue types or relationship targets.

Combine missing choices into one question. Do not separately ask for purpose, description, completion criteria, priority, labels, sprint, environment, or implementation details. Assignee, due date, and Story Points are the policy-required exceptions.

If the same work is already represented by an unfinished issue, do not create another merely because its assignee, due date, Story Points, or priority differs. Report the existing issue and the differing fields. Create another only when the user explicitly confirms that a materially separate result is intended.

## Discover live Jira requirements

Before creating anything:

1. Get the authenticated Atlassian user.
2. Get accessible Atlassian sites and select `https://ssafy.atlassian.net`.
3. Read the issue types available to project `S15P11B104`.
4. After inferring the issue type, read its create-field metadata.
5. Satisfy every field currently marked required. If live metadata differs from the rules below, the live metadata wins.
6. Confirm that `assignee`, `duedate`, and Story Points (`customfield_10031` when that is still the live field) can be written for the selected type.

The currently observed requirements are:

- Every type: project, issue type, reporter, and summary.
- Reporter has a Jira default and must not be asked from the user.
- Priority has the Jira default `Low`; do not ask or override it unless the user explicitly requests another value.
- Exactly one assignee, due date, and Story Points are policy-required user responses even when optional in Jira metadata.
- Description is optional to Jira, but this skill generates it for team readability.

Stop without mutation if the live required fields cannot be discovered, the required policy fields cannot be written, or a required system value cannot be satisfied safely.

## Infer the issue fields

### Project and reporter

- Set the project to `S15P11B104`.
- Let Jira use the authenticated reporter default.

### Issue type

Choose the narrowest type supported by the request:

- Explicit bug/defect wording or a request to fix broken existing behavior: `버그`.
- Explicit user story wording with one user-visible value and overall acceptance result: `스토리`.
- Explicit project-wide objective that the user calls an epic: `에픽`.
- Otherwise: `작업`.

Never select `하위 작업` for a new issue. If the user requested one, confirm conversion to a standard ticket before creation.

Do not duplicate one shared Story as `[FE]`, `[BE]`, or `[AI]` Stories merely to represent implementation ownership. Keep one Story with one DRI for the user-value acceptance result, and represent independently completable technical execution as linked `작업` issues. Create separate `[FE]`, `[BE]`, or `[AI]` Stories only when each one delivers a distinct user-visible value with its own observable acceptance result; domain ownership alone is insufficient. Never use `[COMMON]` on a Story because it represents shared technical foundation work, not a user-value category.

When the requested issue type and prefix role conflict, make no Jira mutation and ask exactly one compact correction question. For ownership-only Story clones, ask whether to keep one shared Story and create prefixed Tasks. For a `[COMMON]` Story, ask whether the intended record is an unprefixed user-value Story or a `[COMMON]` shared-foundation Task. For a prefixed standalone Task, ask whether it is actually a technical split from a shared Story or should remain unprefixed. Do not silently remove the marker, change the issue type, or create a different relationship.

If a supplied parent is an epic, create the inferred standard issue under that epic when the live project supports the relationship. If the supplied related issue is a task, story, or bug, create a standard issue and use `Blocks` or `Relates` only when the requested dependency is clear.

Do not ask the user to choose an issue type merely because Jira requires one; inference exists to avoid that question.

### Epic and issue relationships

- Resolve an explicit Jira key first and fetch it before using it as an Epic or link target.
- Otherwise resolve an unambiguous title from the conversation or current Jira project.
- A standard ticket may be standalone. Do not force a relationship question unless the user requested decomposition or supplied a related ticket.
- Use the same Epic for tickets that contribute to one larger objective.
- When technical Tasks implement one shared Story, connect every Task to that Story with `Relates`.
- Use `Blocks` for an explicit prerequisite and `Relates` for a non-blocking relationship.
- Never use a standard task, story, or bug as a subtask parent.

### Assignee

- Resolve an explicitly named assignee with Jira user lookup.
- Resolve `나`/`저` to the authenticated Atlassian user.
- Do not silently assign the authenticated user when the user omitted an assignee; ask for the missing response first.
- Set exactly one assignee on each ticket.
- Never infer an assignee from an Epic or related issue.
- If several people are named for one ticket, require either one DRI or independently completable scopes for separate standard tickets.

### Due date

- Require an explicit calendar date before any creation. Accept `YYYY-MM-DD` directly and convert an unambiguous Korean date such as `7월 31일` using the current `Asia/Seoul` date context.
- If the request uses an ambiguous relative date such as `다음 주` or `곧`, ask for an exact date in the same compact clarification.
- Do not infer today, a parent due date, a sprint end, or a default date.
- Apply one explicitly supplied common due date to several standard tickets only when the user clearly supplied it as a common date.
- Send the date through Jira's `duedate` field and verify it after creation.

### Story Points

- Require one of `1`, `2`, `3`, `5`, or `8` before creation.
- Do not estimate silently from prose, issue type, assignee, or a related ticket.
- Apply a common value to several tickets only when the user explicitly states that the estimate is shared.
- If the work is estimated above `8`, stop and ask for independently completable ticket boundaries instead of rounding down.
- Write the value to Jira's live Story Points field and verify the saved numeric value.

### Summary

Write a concise Korean work phrase from the requested outcome:

- Describe the work itself, not the conversation.
- Do not prefix the summary with a Jira key or Git commit type.
- Keep a shared user-value `스토리` domain-neutral and do not duplicate it by technical area. An `[FE]`, `[BE]`, or `[AI]` Story is allowed only when it represents a separate user-visible value and independent acceptance result, not merely a different implementation owner. `[COMMON]` is Task-only.
- When a `작업` is one technical execution unit split from a shared Story, use exactly one applicable prefix:
  - `[FE]` for Android, web, or another user client.
  - `[BE]` for server, API, or data-processing work.
  - `[AI]` for model, prompt, or AI-pipeline work.
  - `[COMMON]` for a shared foundation used by two or more areas.
- Do not add a domain prefix to planning, research, presentation, or another standalone single-scope Task merely because one team owns it.
- Do not invent another prefix. Ask one compact question when the execution domain is material but cannot be resolved to the allowed set.
- Avoid vague summaries such as `수정`, `확인`, or `작업` when the request supports a more specific phrase.
- Give split tickets summaries that distinguish each independently completable result.

## Generate the description and completion criteria

Generate the completion criteria yourself. The user should describe the work, not design a Jira template.

Derive observable results at the same abstraction level as the request and parent issue. Do not invent files, APIs, libraries, numeric targets, dates, screens, test commands, or product requirements that were not provided or visible in the parent context.

Use these reasoning patterns:

- Product or implementation change: the requested user-visible or system-visible behavior is available in the stated flow.
- Bug fix: the reported failure no longer occurs in the described condition, and the intended behavior can be observed.
- Research: findings, sources, comparison, and applicable conclusions are recorded and shared.
- Documentation: required decisions and information are present, consistent, and accessible to the intended reader.
- Setup or configuration: another teammate can reproduce the setup and observe a successful basic validation.
- Design: the requested flow or structure is represented, constraints are addressed, and unresolved items are marked.
- Scope or planning: included and excluded scope with rationale is recorded, and team-decision points are visible.
- Collaborative ticket: the single assignee's independent result and its relationship to the shared objective are clear.

For every new epic, story, task, or bug, use:

```markdown
[목적]

<why this work is needed, derived from the request and parent context>

[작업 내용]

* <2-4 concrete activities at the requested abstraction level>

[완료 기준]

* <1-3 observable results proving the work is complete>
```

Add `[기타 메모]` only when the user supplied constraints, exclusions, references, or dependencies. Never leave template bullets or headers empty.

## Prevent duplicate tickets

Before each creation, search the current project for active issues with the same normalized summary, intended Epic or relationship target, and overlapping purpose or completion result.

- Decide work identity primarily from the issue type, normalized summary, purpose, scope, observable completion result, relationship, and unfinished status.
- Treat an allowed domain prefix as meaningful scope metadata. Differently prefixed `[FE]`, `[BE]`, `[AI]`, and `[COMMON]` Tasks with independently completable domain results are not duplicates merely because their base phrase is similar.
- Treat assignee, due date, Story Points, and priority as attributes of the work, not as evidence that otherwise identical work is a separate ticket.
- Normalize superficial spacing and punctuation differences before deciding.
- When the same work exists with different attribute values, reuse/report the existing issue and list the discrepancies without editing it; changing an existing issue is outside this skill unless the user explicitly requests that separate mutation.
- Similar but materially different work is not a duplicate.

## Handle collaborative work

When the user says `공동 작업`, `팀 전체`, or names several participants:

1. Do not create subtasks or assign several people to one ticket.
2. Preserve one shared user-value Story with one DRI instead of cloning it per technical area.
3. Separate implementation by independently completable result, not merely by participant count.
4. Create each technical execution unit as a `작업` with `[FE]`, `[BE]`, `[AI]`, or `[COMMON]` when applicable.
5. Require one assignee, due date, and Story Points for every resulting standard ticket.
6. Put the tickets under the same Epic and connect each technical Task to the shared Story with `Relates`; use `Blocks` for actual sequencing.
7. Search for equivalent unfinished tickets before mutation.
8. If the work cannot be split meaningfully, create one ticket with one DRI only after that DRI is explicit; record other participants in the description.

If participant roles or ticket boundaries are unclear, ask once for the missing split or DRI decision. If some creations fail, keep successful issues and report the partial result; do not delete or recreate them automatically.

## Create and verify

Create the issue with the Atlassian connector using only fields supported by the live metadata. After every successful create response:

1. Fetch the created issue by its returned key.
2. Verify project, issue type, summary including the required or intentionally absent domain prefix, reporter, exactly one assignee, due date, Story Points, Epic or issue link when applicable, priority, and description.
3. Confirm that every description section is present and non-empty.
4. Confirm that every collaborative ticket has one distinct completion result and no duplicate scope.

Do not claim success from the create acknowledgement alone. If verification fails, report the created issue as an unverified partial result and do not create a replacement.

## Report and stop

For one issue, use:

```text
Jira 티켓 생성 완료

티켓: <JIRA_KEY> <summary>
유형: <issue type>
담당자: <display name>
기한: <YYYY-MM-DD>
Story Points: <1 | 2 | 3 | 5 | 8>
관계: <Epic/Blocks/Relates target | 없음>
우선순위: <priority>
URL: <canonical Jira URL>
다음 단계: jira-start-work
```

For collaborative creation, list each created or reused standard ticket with its assignee, due date, Story Points, and relationship, then finish with counts for created, reused, and failed items.

For a dry run, start with `Jira 티켓 생성 미실행` and show the proposed fields and generated description. Do not imply that Jira changed.

## Failure behavior

- Atlassian connector or Jira create metadata unavailable: make no mutation and report the connection or metadata problem.
- No actionable work after the single question: make no mutation.
- Subtask conversion or standard-ticket relationship unresolved: make no mutation.
- Required assignee missing, unresolved, or ambiguous: make no mutation.
- Required due date missing, invalid, or ambiguous: make no mutation.
- Required Story Points missing or invalid: make no mutation.
- Required technical-domain prefix is unresolved for a split implementation Task: make no mutation.
- Requested prefix conflicts with the Story-versus-Task role: make no mutation, ask one compact correction question, and do not silently remove the prefix or convert the issue type.
- Collaborative work has neither independently completable scopes nor one explicit DRI: make no mutation.
- Same unfinished work found: reuse/report it and any differing attributes without mutation.
- Create fails: report the failure and do not retry blindly.
- Create succeeds but verification fails: report the returned key and verification failure as a partial result.

Never fall back to browser automation, guess Jira identifiers, expose credentials, broaden the request into planning or implementation, or claim external state changed without fetching the saved issue.
