---
name: jira-commit
description: Safely create convention-compliant commits for one S15P11B104 Jira work branch and push only when the user explicitly requests it. Always use this skill when the user says `$jira-commit`, asks to commit or push the current work, says "커밋해줘" or "커밋하고 푸시해줘", wants logical commit splitting, or asks how changes should be committed. Read both local Jira and Git conventions, infer the single Jira key from the current branch, inspect and verify actual changes, block secrets and work from other tickets, create precise Korean commit messages, keep commit-only requests local, and normally push only the current work branch when explicitly authorized. Do not create an MR, modify Jira, rewrite history, or force-push.
compatibility: Requires Git access to the current repository, its configured remote, `docs/team-rules/jira-convention.md`, and `docs/team-rules/git-convention.md`.
---

# Jira Commit

Turn the current Jira worktree into the smallest safe set of reviewable commits. A request to commit authorizes ordinary staging and commits only. A normal push additionally requires explicit wording such as `푸시해줘` or `커밋하고 푸시해줘`; ask for input only when the intended scope or safe split cannot be determined.

## Keep this execution boundary

Complete only these outcomes:

1. Load the local Jira and Git conventions.
2. Validate the repository, current work branch, Jira key, remote state, and worktree.
3. Inspect all staged, unstaged, and untracked changes without discarding user work.
4. Exclude secrets, unrelated work, and accidental artifacts.
5. Plan one or more logical commits from the actual diff.
6. Run relevant verification before mutation.
7. Stage only the intended paths or unambiguous hunks, commit them, and validate the resulting commits.
8. Push the current work branch with a normal push only when the user explicitly requested it.
9. Report exact commits, verification, exclusions, and the push decision or result.

Stop after reporting. Do not create a Merge Request, edit or transition Jira, send messages, merge branches, delete branches, or broaden into implementation work.

## Choose the requested mode

- **Commit only** is the default when the user asks to commit or save the work without explicitly mentioning a push or remote publication.
- **Commit and push** applies only when the user explicitly asks to push, publish the branch, or commit and push.
- **Plan only** applies when the user asks how to divide or name commits without authorizing a commit.

Ambiguous wording such as `마무리해줘` does not by itself authorize a push. Ask one compact question only when it is unclear whether the user wants a commit or a plan. In plan-only mode, perform every read-only inspection needed to produce the plan, then stop before staging, committing, or pushing.

## Follow the workflow

### 1. Load the project conventions

Read both `docs/team-rules/jira-convention.md` and `docs/team-rules/git-convention.md` at the start of every run. Treat them together as the authority for one-ticket ownership, traceability, branch names, allowed types, commit format, protected branches, and push rules. If either file is missing or unreadable, stop before any mutation.

The current established rules include:

- One work branch and its commits belong to one Jira ticket.
- Work branch format: `<type>/<JIRA_KEY>-<short-work-name>`
- Commit format: `[JIRA_KEY] <type>: <작업 내용>`
- Allowed commit types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- One commit contains one logical change.
- `main` and `develop` do not accept direct commits or pushes.
- The Jira key cannot be omitted, and sensitive files or work for another ticket cannot be mixed.
- Shared branches cannot be force-pushed.
- Jira domain prefixes such as `[FE]`, `[BE]`, `[AI]`, and `[COMMON]` classify Jira issue scope; they do not change the Git commit format.

When the file changes, follow the live file instead of this summary.

### 2. Validate the Git context without changing it

Inspect the repository root, current branch, status, index, remotes, upstream, and unresolved files.

- Reject detached HEAD and protected branches such as `main`, `master`, and `develop`.
- Require the current branch to match the live work-branch convention and extract its Jira key. Do not ask the user to retype a key already encoded in the branch.
- Reject unresolved conflicts, an in-progress merge, rebase, cherry-pick, or revert.
- Preserve existing staged changes. Treat them as user intent, but verify that they form a safe logical commit before using them.
- Confirm that the current remote and upstream refer to the current work branch.

Before creating a commit, fetch the configured remote without pruning or changing branches. Re-evaluate ahead/behind state afterward. If the upstream is ahead or histories have diverged, stop before staging or committing; do not merge, rebase, reset, or force-push on the user's behalf.

For a new branch without an upstream, allow commits and later publish it with `git push -u <remote> <current-branch>` only when the remote is unambiguous. Otherwise ask the user to identify the intended remote.

### 3. Inspect changes and protect sensitive data

Inspect staged, unstaged, and untracked paths plus their relevant diffs. Never use broad staging such as `git add .`, `git add -A`, or an equivalent wildcard.

Block before mutation when any intended change contains or appears to contain:

- `.env` files, private keys, credentials, access tokens, passwords, signing material, or secret configuration;
- unresolved conflict markers;
- temporary files, IDE state, build output, logs, or generated artifacts that are not clearly required;
- changes belonging to another Jira issue or unrelated work whose disposition is ambiguous.

Do not print secret values while reporting a blocked file. Report only the path and reason. An untracked sensitive file may remain untouched while safe work proceeds only when it is clearly excluded from every commit and its presence does not indicate that the intended files also contain secrets.

Run `git diff --check` for intended tracked changes. Inspect both staged and unstaged diffs so an incomplete staged subset is not mistaken for the whole logical change.

### 4. Build the commit plan

Group by logical purpose, not merely by directory or file count. Each planned commit should be independently understandable, reviewable, and safe to revert. Avoid an intermediate commit that knowingly breaks the build or depends on a later commit to be coherent.

Use these defaults:

- Keep a behavior change with the focused tests that prove that behavior.
- Keep a bug fix with its regression test.
- Separate an independent behavior-preserving refactor from a feature or bug fix, ordering the refactor first.
- Separate documentation-only work when it is independently useful; keep documentation with the code when separating it would make either commit misleading or incomplete.
- Separate build, dependency, or configuration maintenance when it is an independent prerequisite; otherwise keep it with the change that requires it.
- Keep generated files with the source or configuration that deterministically produces or requires them.
- Use partial-file staging only when the hunks are unambiguously independent and the remaining file stays valid. If that cannot be guaranteed, ask the user instead of constructing a fragile patch.
- Never mix different Jira keys in one commit or push operation.

Choose the narrowest accurate commit type from the live convention. The commit type need not match the branch type. Describe the observed outcome in concise Korean and reject vague subjects containing only words such as `update`, `수정`, or `작업`.

If the Jira summary begins with an allowed domain prefix, use it only to understand scope. Do not insert that marker before the commit type or duplicate it mechanically in every subject. The commit remains `[JIRA_KEY] <type>: <작업 내용>`; the Jira key and commit type already provide Git traceability.

Examples:

```text
[S15P11B104-82] refactor: 실시간 응답 상태 관리 구조 정리
[S15P11B104-82] fix: 응답 종료 이벤트 누락 처리
[S15P11B104-82] docs: 실시간 음성 실행 방법 보완
```

If all boundaries are clear, briefly state the plan and continue without requesting a second confirmation. Stop and ask for the minimum necessary decision when the issue scope, staged intent, generated-file ownership, or same-file split is ambiguous.

### 5. Verify before mutation

Derive relevant verification from the repository's documented commands, build files, and changed modules. Run narrow checks first, followed by any required project gate that is practical for the change, such as formatting, static analysis, unit tests, or build.

- Do not claim a check passed unless it was run and observed.
- If a required check fails, stop before staging, committing, or pushing.
- If no automated check exists for documentation-only or configuration-only work, perform the strongest available structural validation and report its limit.
- Do not modify product code merely to make verification pass; implementation fixes require a separate user request.

### 6. Stage and commit one logical unit at a time

For each planned commit:

1. Stage only its explicit paths or unambiguous hunks.
2. Inspect the exact staged diff and staged file list.
3. Recheck that no secret, unrelated path, or incomplete dependency entered the index.
4. Commit with the extracted Jira key and planned type. Allow normal hooks to run; never use `--no-verify`.
5. Verify the new commit subject and inspect its file list.

If a commit or hook fails, stop immediately. Preserve successful commits and remaining worktree changes; do not amend, reset, stash, or discard them automatically.

After all planned commits, validate every new commit created during this run against the live message format and Jira key. Also report any intentional uncommitted exclusions.

### 7. Push safely

Skip this step unless the selected mode is **Commit and push**. The absence of `푸시하지 마` is not permission to push.

Push all newly created commits once, using a normal push to the current work branch. Set upstream only for an unambiguous new branch. Never push another branch, push directly to a protected branch, use force push, or bypass hooks.

If the normal push is rejected, keep the local commits and report the rejection. Do not attempt history rewriting or an automatic merge/rebase.

### 8. Report and stop

For successful commit and push, use this compact structure:

```text
커밋 및 푸시 완료

티켓: <JIRA_KEY>
브랜치: <branch>
검증: <checks and observed results>
커밋:
- <short-hash> <subject>
- <short-hash> <subject>
제외: <none | intentionally uncommitted paths and reasons>
푸시: <remote>/<branch>
다음 단계: Merge Request 생성
```

For the default commit-only mode, start with `커밋 완료`, show `푸시: 수행하지 않음 (명시적 요청 없음)`, and set the next step to `푸시 또는 Merge Request 생성`. For plan-only mode, start with `커밋 계획` and list each proposed subject, paths or hunks, reason for separation, verification, and blockers without claiming any mutation.

When stopped or partially complete, identify the last successful mutation, list the local commits that now exist, and state exactly what prevented the next step.

## Failure behavior

- Jira or Git convention unavailable: make no Git mutation.
- Invalid, detached, or protected branch: make no Git mutation.
- Conflict or history operation in progress: make no Git mutation.
- Upstream ahead or diverged: make no Git mutation.
- Sensitive intended file or detected credential: make no Git mutation and do not reveal the value.
- Unrelated or ambiguous work: do not stage it; ask for the minimum scope decision.
- Verification failure: make no Git mutation.
- Hook or commit failure after earlier commits: preserve successful commits and remaining work; do not rewrite or discard.
- Push rejection after commits: preserve local commits and report the remote condition; never force-push.

Never silently weaken verification, broaden the Jira scope, stage everything, invent commit contents, rewrite history, or claim a push succeeded without verifying the remote result.
