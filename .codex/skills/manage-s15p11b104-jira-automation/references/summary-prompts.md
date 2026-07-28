# Summary prompt patterns

Use these as constraints and structure, not as a reason to replace a user's newer prompt wholesale. Preserve live wording that implements additional requirements.

## Daily worker task summary

The prompt must direct Rovo to analyze Jira project ID `21752` (`S15P11B104`) and apply all of the following:

### Inclusion

1. Include incomplete subtasks and assign each only to the subtask's actual assignee.
2. Include incomplete independent Task, Story, or Bug issues only when they have no subtasks.
3. Include overdue incomplete work, work due today or later, and work without a due date.

### Exclusion

- Exclude epics.
- Exclude any parent with at least one subtask, regardless of child status.
- Exclude unassigned issues.
- Exclude issues whose `statusCategory` is `Done`.
- Never infer or inherit a subtask assignee from its parent.

### Counting and display

- Apply all filters before calculating each assignee's count.
- Omit assignees with zero eligible issues.
- Show each work item using its Jira `summary` only; preserve an existing `[FE]`, `[BE]`, `[AI]`, or `[COMMON]` prefix and do not output an issue key.
- Do not output Jira URLs, issue links, “view all” links, raw URLs, or Slack `<URL|text>` syntax.
- Use this compact structure:

```text
*☀️ 오늘의 작업자별 Jira 할 일*
_YYYY-MM-DD 기준 · 완료 이슈 및 부모 작업 제외_

*👤 담당자 이름 (N건)*
• 작업 제목 · 상태 · 우선순위 · 기한 초과 YYYY-MM-DD / 마감 YYYY-MM-DD / 마감일 없음
```

- Use `{{now.convertToTimeZone("Asia/Seoul").format("yyyy-MM-dd")}}` for the date when Jira smart values are supported in the Rovo prompt.
- Remove the project role suffixes listed in `project-context.md` from assignee names.
- Output no analysis narrative, links, tables, or code blocks.

## Weekly project summary

Optimize for scanability in Slack:

- Start with a one-line headline and reporting period.
- Use short sections such as completed, in progress, blockers or risks, and next week.
- Put the most decision-relevant items first.
- Prefer compact bullets and explicit counts over paragraphs.
- Merge repeated or near-duplicate facts.
- Omit empty sections.
- Keep names and issue titles readable, preserve allowed domain prefixes, and follow the project's no-link convention when compact output is requested.
- Do not invent progress, owners, dates, or blockers that are absent from Jira data.
