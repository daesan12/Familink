---
name: notion-decision-sync
description: Audit and safely synchronize the S15P11B104 "2 AI" Notion documentation against the latest meeting records and user-provided evidence. Always use this skill when the user invokes `$notion-decision-sync`, asks to compare the latest meeting with Notion documents, find missing or conflicting decisions, fact-check whether meeting decisions are reflected, update documents from meeting notes, check OPENAI API decisions across documents, or prepare backend handoff differences. Use the Notion connector inside the fixed 2 AI root, report discrepancies before mutation, apply only explicitly approved items, and re-fetch every edited page to verify the saved result.
compatibility: Requires the Notion connector with read/write access to the 2 AI project root at https://app.notion.com/p/2-AI-a07e66fae192822d8862011c73e2305e.
---

# Notion Decision Sync

Keep the 2 AI project documents aligned with the newest confirmed decisions without broadening scope or inventing implementation details. The newest facts live in Notion and the user's current attachments, not in this skill.

## Load the project rules

Before using Notion:

1. Read `references/project-profile.md` completely for the allowed page graph, current write authority, and handoff target.
2. Read `references/comparison-rules.md` completely before extracting or comparing decisions.
3. Read `references/report-templates.md` completely before reporting findings or changing a page.

Use the Notion connector for every Notion read and mutation. If its tools are unavailable, make no mutation and ask the user to connect or authenticate the Notion connector. Do not fall back to browser automation.

## Choose the execution mode

Infer the narrowest safe mode from the request and conversation.

- **Scheduled audit or check-only request:** read and compare only. Never edit Notion. Report numbered discrepancies and wait for the user's choices.
- **Approval response in the same task:** apply only items explicitly marked `반영` or given a concrete correction. Treat `보류`, omitted items, silence, and ambiguous replies as no authorization.
- **Exact correction after a prior audit:** treat the correction as authorization only for the referenced items and fields.
- **Standalone request to update or correct documents without a prior discrepancy report:** perform the audit first. Apply only changes whose exact target and desired state are already explicit in the same request; otherwise report and ask once.
- **Draft, preview, or dry run:** do not mutate Notion.

A scheduled run stays read-only even if an automation prompt contains general language about helping with updates. A later user reply is a new approval step.

## Enforce the fixed boundary

- Start at the 2 AI root in the project profile and fetch it fresh on every run.
- Follow only the current links allowed by the profile. Do not run a workspace-wide search for related pages.
- Search only with the root page, an allowed child page, or an allowed data source as the search boundary.
- Treat a directly linked database or container as in scope together with its direct records. Do not recursively explore unrelated descendants.
- User-attached text, files, images, and exact links are allowed evidence. Do not explore neighboring pages or folders around an attachment unless the user explicitly adds them to scope.
- Treat ERD and API specifications as normal in-scope development documents. When the user explicitly approves an exact change, update the relevant source page directly and summarize backend-facing work in the configured handoff page when useful.
- Never delete or overwrite unrelated blocks, child pages, databases, comments, or properties.
- A current user instruction can narrow the profile for one run. It cannot silently broaden the root to disconnected workspace pages.

## Establish evidence authority

Use this order:

1. The user's current explicit instructions, including how supplied attachments should be interpreted.
2. The latest meeting set and user-provided materials explicitly designated as decision sources.
3. Official decision or source-of-truth documents inside the allowed graph.
4. Existing development documents being checked.

When sources at the same level conflict, do not invent a winner. Report the conflict and the decision needed. Do not use remembered project facts as current evidence; fetch the current pages.

### Select the latest meeting set

1. Inspect meeting-date properties first, then dates in the title and body.
2. Prefer the meeting-held date over the page's last-edited time.
3. When dates are equal, unclear, or missing, include every plausible latest record in the latest set.
4. Show the held date, document date, and last-edited time together when they matter. Do not declare one record authoritative solely because it was edited later.
5. An explicit `확정`, `최종`, or decision section can clarify finality, but conflicting confirmed statements still require user judgment.

## Discover the current page graph

1. Fetch the root page from the profile.
2. Confirm the three meeting containers and the four Software Architecture stages from the current root content.
3. Fetch the allowed containers and direct documents. For databases, fetch the data source schema before querying records.
4. Use one literal query per Notion search call. Keep the search bound to an allowed `page_url` or `data_source_url`, and use `filters: {}` when no narrower filter is needed.
5. Fetch every candidate result before treating it as evidence.
6. Record each source title, canonical URL, date signals, last-edited time, and reason it is in scope.

If a configured link is disconnected, inaccessible, or replaced, do not search the whole workspace to recover it. Report the broken boundary and the user confirmation needed.

## Build a decision ledger

Extract decisions into independent units. For each unit record:

- short topic key;
- exact confirmed statement;
- kind: confirmed decision, change, requirement, action item, or unresolved item;
- source page and link;
- meeting-held date and relevant edit time;
- likely affected documents;
- explicit exclusions and unknowns.

Keep action items and discussion questions separate from product decisions. Preserve `미정`, `보류`, examples, and drafts as non-final. Do not turn an example value into an operational default.

## Compare with development documents

Map each confirmed unit only to relevant in-scope documents, then compare:

- behavior and user flow;
- state transitions and role rules;
- field names, types, enums, nullability, lengths, and storage boundaries;
- Tool, model, endpoint, request, and response names;
- UI visibility and display location;
- limits for time, count, size, and retention;
- MVP versus extension boundaries;
- wording that incorrectly presents an unresolved item as final.

Classify every unit as exactly one of:

- `이미 반영`
- `일부 반영`
- `미반영`
- `충돌/판단 필요`

Do not propose speculative retries, error codes, concurrency controls, extra schema fields, cleanup jobs, or validation rules unless a source explicitly requires them. The goal is alignment, not unsolicited redesign.

## Report before changing anything

Summarize `이미 반영` items briefly. Number only `일부 반영`, `미반영`, and `충돌/판단 필요` items.

Each numbered item must include:

- meeting or attachment evidence and its direct link when available;
- current document state and target-page link;
- a concrete minimal change recommendation;
- uncertainty or user decision needed;
- destination rule when ERD or API differences must go to the backend handoff page.

Finish an audit report with one-response instructions such as:

```text
1 반영
2 보류
3 필드명은 emotion_category로 수정
```

If no discrepancy exists, report that comparison is complete with no missing reflection. Do not ask for unnecessary approval.

## Re-check before an approved mutation

Immediately before every write:

1. Re-fetch the decision source.
2. Re-fetch the target page and, for a database record, its current schema.
3. Compare the new snapshot with the audit snapshot.
4. If an intermediate change affects the proposed patch, stop that item and report the new conflict. If it does not affect the approved result, continue with the current content.

This second read prevents a previously correct patch from overwriting a teammate's newer work.

## Apply only the approved minimum

- Use targeted content updates or property updates against freshly fetched content.
- Preserve the page's title, section order, tone, terminology, child links, and database structure.
- Prefer the smallest exact replacement that removes the contradiction and adds the confirmed fact.
- Never use a whole-page replacement when a targeted update is sufficient.
- Never enable deletion of child content without showing the affected children and receiving explicit confirmation.
- Apply explicitly approved ERD and API changes directly to their freshly fetched source pages, then update the backend handoff only when implementation work or coordination remains.
- Keep unresolved details visibly unresolved.
- If one page fails, do not roll back or recreate successful unrelated updates. Report the partial result.

## Verify saved state independently

After every mutation, fetch each edited page again and verify:

- the approved content is present;
- the stale contradictory content is absent where removal was intended;
- unapproved sections and structure remain intact;
- every approved item has a verified destination;
- ERD and API changes match the user's explicit approval and no unrelated source content changed;
- links still resolve within the allowed graph.

Do not claim completion from an update acknowledgement alone. Report each item as `반영 완료`, `보류`, `추가 확인 필요`, or `반영 실패`, with the edited page link.

## Failure behavior

- Notion unavailable or unauthenticated: no mutation; ask the user to connect the connector.
- Root or allowed link inaccessible: no workspace-wide recovery search; report the exact broken link.
- Meeting date ambiguous: report all date signals and avoid an arbitrary latest claim.
- Conflicting confirmed decisions: no mutation for that item; ask for the deciding rule.
- Approval unclear or incomplete: leave the item unchanged.
- Write verification fails: report the page as an unverified partial result and do not repeat the write blindly.

Always answer in Korean, lead with the outcome, use concise human-readable bullets, and link every relevant Notion page.
