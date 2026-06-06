# /fix-all - TruthLens Batch Fix Command

Fix **every finding with status `open`** in `.truthlens/findings.json` in a single Bob session—without requiring the user to run `/fix-claim` once per ID.

## Usage

```
/fix-all
```

## Preconditions

- Workspace root contains `.truthlens/findings.json` from a prior `/audit`.
- At least one finding has `"status": "open"`.

## Strategy mapping (per finding)

Use each finding’s `suggestedFix.strategy` and map flags the same way as `commands/fix-claim.md`:

| `suggestedFix.strategy` | `/fix-claim` flag |
|-------------------------|-------------------|
| `rename_artifact` | `--strategy rename` |
| `fix_implementation` | `--strategy implement` |
| `add_validation` | `--strategy implement` |
| `update_documentation` | Prefer `--strategy rename` when the claim lives in names/titles; use `--strategy implement` when the docs must be rewritten to match reality. |

When uncertain for `update_documentation`, choose the smallest blast radius consistent with eliminating the mismatch.

## Execution flow

### Phase 1: Load and queue

1. **Read** `.truthlens/findings.json`.
2. **Select** findings where `status === "open"`.
3. **Sort** by severity (`critical` → `high` → `medium` → `low`), then by `id`.
4. **Announce** a short plan (count, severity breakdown, optional note if the list is large).

### Phase 2: Apply fixes sequentially

For **each** open finding in order:

1. Re-read `findings.json` if needed so IDs and statuses stay current.
2. Skip any finding that is no longer `open` (already fixed or dismissed).
3. Execute the **same remediation workflow** as a single `/fix-claim <id> --strategy <rename|implement>` run:
   - Respect blast radius and tests.
   - Apply minimal correct edits.
   - Prefer consistency with TruthLens severity (critical/high first).

### Phase 3: Findings file hygiene

After substantive progress:

1. When rewriting `.truthlens/findings.json`, use **UTF-8 without BOM**, strict JSON, and **recomputed `summary`** where every count reflects **only** `"status": "open"` findings (including full `byCategory`) — same rules as `/audit`.
2. Set fixed findings to `"status": "resolved"` with `resolvedAt` (ISO 8601) and `resolvedBy`: `"truthlens.fix-all"` where appropriate.
3. **Recompute** `summary` after status changes so totals stay consistent with the extension.
4. If you cannot safely edit JSON in-session, tell the user to run `/audit` after fixes.

### Phase 4: Summary

Emit a concise completion message:

- How many findings were addressed vs skipped.
- Any IDs still open and why (blocked, ambiguous, needs human choice).
- Reminder: run `/audit` in a **new** chat when they want a clean regenerated report.

## Notes

- Large repos may touch many files—**git commit or stash first**.
- Do **not** interleave a full `/audit` inside `/fix-all`; auditing is a separate pass after fixes settle.

---

**Run this command** when the user wants Bob to remediate all open TruthLens findings in one batch.
