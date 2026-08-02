@AGENTS.md

## Claude Code 실행 규약

위 `AGENTS.md`가 이 저장소의 공식 작업 지침이며 Codex와 공유한다. 아래는 같은 지침을 Claude Code에서 동일하게 수행하기 위한 표기·경로 대응 규칙이다.

### Skill 호출 표기

- `AGENTS.md`와 각 Skill 문서의 `$skill-name` 표기는 Codex 문법이다. Claude Code에서는 `/skill-name`(또는 Skill 도구 호출)로 읽는다.
- 예: `$review-agent` → `/review-agent`, `$spec-change-recorder` → `/spec-change-recorder`, `$jira-commit` → `/jira-commit`.
- Skill 원본은 `.codex/skills/` 하나뿐이다. `.claude/skills/`는 여기로 연결된 로컬 정션이므로 Skill 내용을 고칠 때는 `.codex/skills/` 경로를 수정한다.

### 하위 에이전트

- `AGENTS.md`가 지칭하는 `reviewer`, `explorer`는 `.claude/agents/`에 같은 이름으로 정의되어 있다. Codex의 `.codex/agents/*.toml`과 역할이 같다.
- 두 에이전트의 읽기 전용 제약은 `Write`/`Edit` 도구 미부여와 각 에이전트의 지침으로 보장한다. `permissionMode: plan`도 걸려 있으나 부모 세션이 `acceptEdits`, `auto`, `bypassPermissions`이면 무시되므로, Codex의 `sandbox_mode = "read-only"`와 달리 도구 계층에서 완전히 강제되지는 않는다.
- `.codex/agents/`의 `default`, `worker`는 Claude Code 기본 제공 `general-purpose` 에이전트와 역할이 같으므로 별도로 정의하지 않는다. 범용 위임은 `general-purpose`를 쓴다.
- "완료 전 리뷰" 절차는 `reviewer` 에이전트에 위임한다. 이 에이전트는 `review-agent` Skill을 컨텍스트에 미리 로드하므로 위임 프롬프트에는 검토 대상(미커밋 변경 또는 기준 브랜치 diff)만 명시하면 된다.

### 조건부 가이드

- `.codex/guides/codegraph.md`, `.codex/guides/context7.md`는 도구 이름과 무관한 절차 문서이므로 Claude Code에서도 그대로 따른다.
- CodeGraph는 `codegraph explore "<질문>"` CLI로 사용한다. Context7은 세션에 연결된 문서 조회 MCP로 대체한다.

### 새 클론에서의 준비

`.claude/skills/` 정션은 커밋되지 않으므로 저장소를 새로 클론한 뒤 한 번 생성한다. 저장소 루트에서 실행한다.

PowerShell:

```powershell
cmd /c mklink /J ".claude\skills" ".codex\skills"
```

Git Bash에서는 MSYS 경로 변환을 피하기 위해 `cmd //c` 로 실행한다.

```bash
cmd //c mklink /J ".claude\skills" ".codex\skills"
```

정션을 만들지 않으면 Claude Code에서 프로젝트 Skill이 하나도 로드되지 않는다. Codex는 `.codex/skills/`를 직접 읽으므로 영향받지 않는다. 같은 이유로 저장소를 클론해 실행되는 Claude Code 클라우드 세션과 routine에서는 프로젝트 Skill을 사용할 수 없다.
