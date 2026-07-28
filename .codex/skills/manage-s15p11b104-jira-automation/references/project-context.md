# S15P11B104 Jira Automation context

## Fixed project values

- Jira site: `https://ssafy.atlassian.net`
- Jira project key: `S15P11B104`
- Jira project ID: `21752`
- Automation settings: `https://ssafy.atlassian.net/jira/software/c/projects/S15P11B104/settings/automate`
- Atlassian cloud ID: `15a21def-11f5-4358-ab48-074194685963`
- Team Slack channel URL: `https://ssafy-c6k4428.slack.com/archives/C0BHTDKJ4RZ`
- Team Slack channel ID: `C0BHTDKJ4RZ`
- Default timezone: `Asia/Seoul`

## Existing summary rules

### Daily worker task summary

- Rule name: `Rovo 에이전트를 사용하여 Jira 스페이스 일일요약을 Slack에 보내기`
- Rule URL: `https://ssafy.atlassian.net/jira/software/c/projects/S15P11B104/settings/automate#/rule/019f7467-7207-79f8-a299-f1ec2bbdc357`
- Schedule: every day at 09:00, `Asia/Seoul`
- Expected state: enabled
- Delivery: the team Slack channel above

### Weekly project summary

- Rule name: `Rovo 에이전트를 사용하여 Jira 스페이스 주간요약을 Slack에 보내기`
- Rule URL: `https://ssafy.atlassian.net/jira/software/c/projects/S15P11B104/settings/automate#/rule/019f6ed9-d9df-75b7-920e-6fcccf8218cf/95276da2-29f8-47d3-b218-aad076b3afbc`
- Expected state: enabled
- Delivery: the team Slack channel above

Treat rule IDs, enabled state, and current configuration as live data: verify them in Jira before relying on them.

## Team-specific display conventions

- Write Slack output in concise Korean `mrkdwn`.
- Remove `[대전_1반_B104]팀원` and `[대전_1반_B104]팀장` from displayed names.
- Put one blank line between assignee sections.
- Avoid tables and code blocks in Slack summaries.
- Avoid Jira links and issue keys when a compact message is requested, because Slack link-preview cards consume too much space.
