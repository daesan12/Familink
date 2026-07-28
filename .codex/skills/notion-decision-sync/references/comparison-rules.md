# Decision comparison rules

Use these rules to avoid false mismatches and speculative updates.

## Normalize the source without weakening it

- Split compound meeting notes into independently checkable decisions.
- Preserve qualifiers such as `MVP`, `일단`, `추후`, `최대`, `기본`, `표시하지 않음`, and `별도 저장`.
- Preserve whether a statement applies to UI, storage, an internal AI contract, an external API, or backend handoff only.
- Treat examples, candidate options, and questions as non-final unless the source marks the selected outcome.
- Treat an action item as work to perform, not proof that its proposed design is approved.

## Interpret user-provided material

- A direct instruction such as `이 기준으로 통일`, `반영`, or `정정` defines the intended result.
- `참고` adds evidence but does not automatically resolve a conflict unless the surrounding instruction says it is authoritative.
- Plain text and attachments without a URL must still be cited in the report as user-provided evidence.
- If an attachment conflicts with the latest meeting and the user did not state which wins, classify the item as `충돌/판단 필요`.

## Compare exact meaning

Check all relevant dimensions:

- actor, trigger, precondition, action, result, and exceptional branch;
- UI visibility, wording, and location;
- persistence, field separation, nullable state, and retention;
- names and casing of tools, models, endpoints, fields, and enums;
- numbers, units, time windows, maximum lengths, and counts;
- phase boundary: MVP, extension, experiment, or deferred;
- ownership boundary between frontend, backend, AI server, and documentation-only handoff.

A document is `이미 반영` only when its meaning matches across all dimensions relevant to that document. Cosmetic wording differences alone are not mismatches.

## Status tests

### 이미 반영

- The current document expresses the confirmed decision accurately.
- It does not retain an active contradictory rule in the same scope.
- Any omitted detail is irrelevant to that document's purpose.

### 일부 반영

- The main idea is present but an implementation-relevant qualifier, field, limit, or display boundary is missing.
- The document contains both new and stale wording.

### 미반영

- The relevant document lacks the confirmed decision entirely.
- The document still describes only the superseded behavior.

### 충돌/판단 필요

- Two current sources make incompatible confirmed statements.
- The latest meeting set cannot be resolved safely by date or finality.
- The desired destination, field name, or behavior remains genuinely undecided.

## Recommendation discipline

- Recommend the smallest edit that makes the target accurate.
- Reuse the target page's existing vocabulary and structure.
- Do not fill unknown schema fields or exception behavior for completeness.
- Do not infer backend contracts merely because they would be conventional.
- When an ERD or API change is explicitly approved, update the relevant source page directly. Use the backend handoff only for remaining implementation work or coordination.
- Keep unresolved items explicit instead of hiding them behind a guessed default.
