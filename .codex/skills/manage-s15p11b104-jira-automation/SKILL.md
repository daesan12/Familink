---
name: manage-s15p11b104-jira-automation
description: Create, update, diagnose, and verify any Jira Automation rule for the S15P11B104 project. Always use this skill when the user asks in Korean or English to "create/make/set up a Jira automation" for any outcome, including requests shaped like "~하는 Jira 자동화 생성해줘", regardless of trigger or action type. Support scheduled, issue-created, issue-updated, field-changed, status-transitioned, manual, webhook, branching, notification, Slack, Rovo, issue-editing, issue-creation, assignment, commenting, and related automation workflows.
compatibility: Requires authenticated access to the S15P11B104 Jira Automation UI, `docs/team-rules/jira-convention.md`, and the in-app Browser when the Atlassian connector cannot manage Automation rules.
---

# Manage S15P11B104 Jira Automation

Turn a natural-language outcome into a working live Jira Automation rule through the authenticated Jira UI. Preserve unrelated settings and verify the saved live state before reporting completion.

## Load the right context

1. Read `docs/team-rules/jira-convention.md` so an Automation rule cannot bypass the team's current ticket policy.
2. Read [references/project-context.md](references/project-context.md) for stable project identifiers, destinations, current rules, and established behavior.
3. Read [references/automation-patterns.md](references/automation-patterns.md) when translating a new request into Jira triggers, conditions, branches, and actions.
4. Read [references/summary-prompts.md](references/summary-prompts.md) only when creating or editing a daily or weekly summary rule.
5. Before controlling Jira in a browser, use the `browser:control-in-app-browser` skill and read its `SKILL.md` completely.
6. Check whether an installed Jira connector exposes a tool that can create or edit Automation rules. Use it if it supports the complete requested change and live verification; otherwise use the Jira UI.

## Enforce the Jira ticket policy

- Never create, enable, or preserve an action that can create a new `하위 작업` while the live Jira convention prohibits new subtasks.
- A rule may inspect, transition, notify about, or otherwise finish an existing legacy subtask when the requested outcome is allowed by the convention.
- When a requested rule would create a subtask, explain the conflict and ask one compact question to confirm creation of a standard `작업`, `스토리`, or `버그` connected through the same Epic, `Blocks`, or `Relates`.
- When updating a rule that already creates subtasks, do not leave the prohibited creation action enabled merely because it is outside a wording-only edit. Make no change and ask exactly one compact policy-resolution question: whether to migrate the action to a standard issue relationship or disable the rule. Continue only after the user chooses one of those outcomes.
- Do not silently convert a subtask request into a different issue type because the relationship and ownership may materially change.
- Keep one shared user-value Story instead of creating domain-cloned Stories. An `[FE]`, `[BE]`, or `[AI]` Story is allowed only when it has a distinct user-visible value and independent acceptance result; `[COMMON]` is Task-only. When an Automation rule creates independently completable technical Tasks for a shared Story, give each Task exactly one `[FE]`, `[BE]`, `[AI]`, or `[COMMON]` prefix, one assignee, and the required relationship.
- When a requested creation action conflicts with the prefix role, make no Automation mutation and ask exactly one compact correction question. Do not silently strip the prefix, change Story to Task, or clone a shared Story.

## Recognize creation requests

- Treat any request equivalent to `~하는 Jira 자동화 생성해줘`, `Jira 자동화 만들어줘`, `Jira automation을 설정해줘`, or `create a Jira automation that ...` as an instruction to create the live rule, not merely draft steps or a prompt.
- Support any Jira Automation type available in the project's live UI. Do not limit creation to summaries, schedules, Rovo, or Slack.
- Extract the requested behavior into this model:
  - `WHEN`: event or schedule that starts the rule.
  - `SCOPE`: project, issue type, JQL result, or related issue set affected.
  - `IF`: conditions that must be true.
  - `BRANCH`: current issue, parent, subtasks, linked issues, assignee, or lookup results to iterate over.
  - `THEN`: issue mutation, transition, creation, assignment, comment, notification, Rovo action, webhook, or integration action.
- If the user describes only the business outcome, choose the narrowest reliable Jira components that implement it.
- Proceed without clarification when the request determines a safe trigger, scope, and action. Ask only when an essential value cannot be discovered and guessing could notify the wrong recipient, expose a secret, mutate the wrong issues, or create materially different behavior.

## Scope the requested change

- Treat the user's latest request as a narrow delta to the existing rule unless they explicitly ask for a redesign.
- Inspect the current rule before editing. Do not overwrite schedule, destination, prompt requirements, enabled state, or actions that are outside the requested change.
- Search the project Automation list before creating a rule. Update an equivalent existing rule instead of creating a duplicate.
- Default the scope to project `S15P11B104` when the user does not name another scope.
- Apply schedule, timezone, Slack, and message defaults from `project-context.md` only when they are relevant to the requested automation type.
- Ask only when a missing choice would materially change recipients, timing, permissions, or external effects.

## Create a rule

1. Open the project's Automation page from `project-context.md`.
2. Inspect existing rules for matching purpose, schedule, and destination.
3. Start a blank rule and give it a descriptive Korean name.
4. Translate the request into `WHEN → SCOPE/IF/BRANCH → THEN`, using `automation-patterns.md` as needed.
5. Add and fully configure the requested trigger.
   - For daily team summaries, default to 09:00 in `Asia/Seoul` with no end date.
   - For scheduled issue processing, add a project-scoped JQL or condition so the rule cannot affect unrelated issues.
   - Confirm that the UI displays the intended local time and recurrence.
6. Add the smallest set of conditions, branches, and actions needed.
   - Prefer explicit issue type, status, project, field, or JQL constraints over broad implicit behavior.
   - Configure every required field, smart value, destination, transition, or content value; do not leave action placeholders.
   - Create only standard issue types allowed by the live Jira convention. Give each new issue exactly one assignee, a calendar due date, and allowed Story Points.
   - Keep Story summaries domain-neutral. For technical Tasks split from a shared Story, configure exactly one allowed domain prefix and connect them to the same Epic plus the Story with `Relates`; use `Blocks` only for real sequencing.
   - For standalone planning, research, presentation, or single-scope work, configure no domain prefix and do not force an Epic or issue link.
   - Give every created issue a non-empty description containing its purpose, concrete work, and observable completion criteria.
   - For Rovo summaries, configure the prompt first and pass the response to the Slack action.
   - For Slack delivery, use the fixed project channel unless the user names another destination.
7. Review the rule from top to bottom and check that its trigger-to-action data context is valid.
8. Save the rule and enable it unless the user asks for a disabled draft.
9. Reopen the saved rule and verify the full trigger, scope, conditions, branches, actions, values, and enabled state.

## Update or diagnose a rule

1. Open the exact rule URL supplied by the user or locate the rule by name.
2. Read the entire rule canvas and the affected action's current configuration.
3. For diagnosis, inspect live issue data or audit results before concluding. Distinguish actual Jira field values from prompt-induced grouping or inference.
4. Modify only the requested fields. When editing a prompt, retain all unrelated constraints verbatim where practical.
5. Save, reopen, and confirm that the new text or setting is present. Confirm that the rule remains enabled unless the user explicitly requested or approved a disabled final state; in that case, verify that it is disabled.

## Apply summary-rule invariants

Unless the user explicitly overrides them, preserve these rules for worker task summaries:

- Use each issue's actual `assignee` only; never infer or inherit an assignee from a parent.
- Count an incomplete subtask only for its own assignee.
- Count an incomplete standard Task, Story, or Bug only when it has no subtasks.
- Exclude epics, unassigned issues, Done-category issues, and every parent that has one or more subtasks.
- Include incomplete overdue issues as well as undated, current, and future-dated issues.
- Output the Jira summary title as plain text only. Omit issue URLs, Slack link syntax, raw URLs, issue keys, and “view all” links to prevent link-preview cards.
- Group by assignee and compute counts only after all inclusion and exclusion filters are applied.

## Verify before completion

Confirm all applicable items from the live rule:

- Rule name matches its purpose.
- Trigger type and configuration implement the requested `WHEN` behavior.
- Project, JQL, issue-type, status, and field constraints implement the intended scope without spilling into unrelated issues.
- Conditions and branches operate on the intended issue context.
- Every action has its required values and implements the requested `THEN` behavior.
- Schedule and timezone are correct when the rule is scheduled.
- Recipient or destination is correct when the rule sends a notification.
- Prompt contains the requested inclusion, exclusion, formatting, and link rules when the rule uses Rovo.
- No duplicate or unintended action was added.
- No action can create a new subtask or otherwise bypass the live Jira convention.
- Every issue-creation action uses the correct Story-versus-Task role, conditional domain-prefix and relationship rules, one assignee, due date, Story Points, and a non-empty purpose/work/completion description.
- Rule is saved and enabled, except when the user explicitly requested or approved a disabled final state; then verify that it is saved and disabled.
- The Automation list shows the rule as updated.

Do not manually run the rule, send a notification, transition issues, or trigger a webhook unless the user asks for a live test. A live test can mutate Jira or notify external recipients and is a separate external effect.

## Report the result

Lead with whether the rule was created or updated. Summarize its `WHEN → THEN` behavior, scope, enabled state, and any relevant schedule or destination. Mention any part that could not be verified live.

## Failure behavior

- Jira convention unavailable: do not create, edit, enable, or disable a rule.
- Requested behavior would create a new subtask: make no Automation mutation until a standard-ticket relationship is explicitly confirmed.
- Requested issue-creation role conflicts with its prefix, or required description/field values are unavailable: make no Automation mutation and ask one compact correction question.
- Existing equivalent rule contains a prohibited subtask-creation action: make no change, report the exact rule, and ask exactly one compact question choosing migration or disabling. After approval, verify the selected policy-compliant final state.
- Connector and authenticated Jira UI both unavailable: make no mutation and report the access problem.
- Save or reopen verification fails: report the partial result and do not trigger the rule.
