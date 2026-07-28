# Jira Automation patterns

Use the live Jira UI labels, which may differ by locale or product version. Select the narrowest pattern that produces the user's requested outcome.

## Project policy guard

Read `docs/team-rules/jira-convention.md` before applying these patterns. For S15P11B104, new subtasks are prohibited. Automation may process existing legacy subtasks, but it must not create a new subtask or keep a subtask-creation action enabled. Keep one domain-neutral Story for shared user value; create an `[FE]`, `[BE]`, or `[AI]` Story only for a genuinely distinct user-visible value and acceptance result; never use `[COMMON]` on a Story. Create independently completable technical Tasks with exactly one `[FE]`, `[BE]`, `[AI]`, or `[COMMON]` prefix, connect them through the same Epic and `Relates` to the Story, and use `Blocks` for actual sequencing.

## Trigger selection

| User intent | Preferred trigger | Typical constraints |
|---|---|---|
| Run at a time or interval | Scheduled | `Asia/Seoul`, project-scoped JQL when processing issues |
| React when an issue is created | Issue created | Project and issue-type condition |
| React when an issue changes | Issue updated | Add field or value conditions to avoid firing on irrelevant edits |
| React to a specific field change | Field value changed | Select the exact field and change type |
| React to workflow movement | Issue transitioned | Constrain source and/or destination status when relevant |
| Let a person run it on demand | Manual trigger | Add input fields when the action needs user-supplied values |
| Accept an external event | Incoming webhook | Validate scope and do not expose webhook secrets in messages |
| Handle comments, assignments, versions, deployments, or development events | Matching Jira trigger | Constrain project and event details in the rule |

For inactivity, approaching due dates, overdue work, periodic summaries, and batch cleanup, prefer a Scheduled trigger with narrow JQL rather than waiting for an issue event.

## Scope and condition selection

- Use a project condition or `project = S15P11B104` in JQL for project-local rules.
- Add issue-type conditions for Task, Story, Bug, Epic, or Subtask-specific behavior.
- Add status-category or status conditions before transitions, reminders, or cleanup actions.
- Add user, assignee, reporter, priority, label, component, sprint, version, due-date, or field conditions only when required by the outcome.
- Use JQL for multi-field selection and scheduled batches; keep it readable and as restrictive as practical.
- Prevent loops when the rule's own edit could retrigger the same rule. Use a value comparison, actor condition, marker field, or trigger-specific restriction.

## Branch selection

Use a branch only when the action targets something other than the trigger issue or must iterate over several issues:

- Parent for a subtask-to-parent update.
- Subtasks for propagating a deliberate parent change.
- Linked issues for dependency synchronization.
- JQL or lookup results for batch operations.
- Assignee or other grouping only when Jira supports the required branch context.

Never infer a subtask's assignee from its parent unless the user explicitly requests assignment propagation.

## Action selection

| User intent | Preferred action |
|---|---|
| Change fields, dates, labels, priority, or assignee | Edit issue fields or Assign issue |
| Move workflow status | Transition issue |
| Add contextual information | Comment on issue |
| Create work | Create an allowed standard issue with one assignee, due date, Story Points, a purpose/work/completion description, and only the prefix or relationship required by its Story-versus-Task role; standalone work remains unprefixed and may remain unrelated |
| Notify Slack or another recipient | Matching notification action with explicit destination |
| Produce an AI summary or classification | Rovo action, followed by an action that consumes its response |
| Call another service | Send web request with the required authentication and payload |
| Find and reuse issue data | Lookup issues, then branch or reference returned smart values |

Configure all mandatory fields and confirm that smart values are available in the action's current issue or branch context.

## Composition examples

- `긴급 버그가 생성되면 담당 채널에 알려주는 Jira 자동화 생성해줘` → Issue created → project/type/priority conditions → Slack notification.
- `작업이 완료되면 완료일을 오늘로 기록하는 Jira 자동화 생성해줘` → Issue transitioned to Done → edit the completion-date field with a Jira date smart value.
- `마감 1일 전 담당자에게 알리는 Jira 자동화 생성해줘` → Daily schedule → project/status/due-date JQL → notification to the actual assignee.
- `기존 하위 작업의 부모가 완료되면 남은 하위 작업을 전환하는 Jira 자동화 생성해줘` → Parent transition trigger → existing-subtask branch → incomplete-status condition → transition action. This is valid only for legacy subtasks and creates no new subtask.
- `스토리 아래 FE·BE·AI 실행 작업을 자동 생성해줘` → Trigger → preserve one domain-neutral Story → create `[FE]`, `[BE]`, and `[AI]` Tasks with one assignee, due date, and Story Points → connect them to the same Epic and `Relates` to the Story.
- `매주 진행상황을 요약해 Slack으로 보내는 Jira 자동화 생성해줘` → Weekly schedule → Rovo summary → Slack notification.

These are mappings, not fixed templates. Preserve the user's exact outcome and use the live project's available fields, statuses, transitions, integrations, and permissions.
