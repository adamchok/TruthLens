# TruthLens

**Continuous semantic integrity for IBM Bob — surface where code, tests, and documentation diverge from reality, then remediate with structured, Bob-driven audits inside the IDE.**

> *When your AI assistant says "done," TruthLens checks.*

---

## The Problem: Agentic Coding Creates a New Class of Risk

Modern development teams ship faster by delegating scaffolding, refactors, and glue code to AI assistants. That velocity has a hidden cost: **semantic dishonesty**.

Assistants stop early, skip edge cases, and leave stubs behind while signalling completion in natural language. The codebase still looks authored — plausible names, confident docstrings, tests that read authoritative — even when behavior is incomplete or wrong. Classic tooling catches syntax and style; it never asks whether **what the code claims matches what it does**.

| Tool | What it catches | What it misses |
|------|----------------|----------------|
| Linter (ESLint, Pylint) | Style, syntax, shallow bugs | Name ↔ behavior mismatches |
| Static analyzer (SonarQube) | Bug patterns, security hotspots | Docstring ↔ implementation drift |
| Code review | Human-spotted issues | Systematic, repo-scale semantic gaps |
| **TruthLens** | **All of the above semantic mismatches** | — |

**The blast radius compounds over time.** A function named `validate_email` that only checks string length is called by 8 services. A test named `test_rejects_invalid_token` that asserts acceptance ships with 100% coverage. A README that claims zero external dependencies anchors onboarding for every new hire. These are not edge cases — they are the natural output of velocity-first, agentic development.

TruthLens targets this **honesty gap at repository scale**, using IBM Bob's reasoning to audit claims systematically and remediate them with explicit user confirmation.

---

## What It Looks Like in Practice

A single `/audit` run over your workspace produces structured findings like this:

```
Finding  F-001 · CAT-A · CRITICAL · confidence 0.95
File     src/auth/validators.py : 14
Claim    validate_email(email)  → implies RFC-format validation
Reality  return len(email) > 0  → only checks presence
Callers  8 callers across src/auth/login.py, src/api/users.py …
Fix A    Rename to is_email_present() — 3 files touched
Fix B    Implement RFC 5322 validation — 1 file touched
```

```
Finding  F-007 · CAT-C · HIGH · confidence 0.91
File     tests/auth/test_tokens.py : 42
Claim    test_rejects_invalid_token → asserts rejection
Reality  assert response.status_code == 200  → asserts acceptance
Fix      Rename to test_accepts_invalid_token or invert assertion
```

```
Finding  F-012 · CAT-D · MEDIUM · confidence 0.87
File     README.md : 18
Claim    "zero external dependencies"
Reality  requirements.txt lists 7 packages (requests, pydantic …)
Fix      Update README to list actual dependencies
```

Every finding carries a **severity**, **confidence score**, **blast radius** (caller count + affected files), and a **suggested remediation strategy**. All findings are written to `.truthlens/findings.json` — a versioned, schema-validated contract readable by the extension, CI pipelines, and external tooling.

---

## How TruthLens Works

```
1. Developer triggers /audit (command palette, tree view button, or `autoAuditOnSave`)
        │
        ▼
2. Bob activates Auditor mode + loads TruthLens skills
   ├── claim-taxonomy  — defines what counts as a claim per CAT-A through CAT-D
   └── claim-verification — evidence location, confidence scoring, severity rules
        │
        ▼
3. Bob scans every source, test, and documentation file in the workspace
   ├── CAT-A: extracts claims from function/method names
   ├── CAT-B: extracts claims from docstrings and inline comments
   ├── CAT-C: extracts claims from test names and assertion labels
   └── CAT-D: extracts factual claims from README, docs, and config
        │
        ▼
4. Bob writes .truthlens/findings.json (UTF-8, strict JSON, schema-validated)
        │
        ▼
5. Extension file watcher triggers; all five UI surfaces refresh instantly
   ├── Findings Explorer  — severity-grouped tree with click-to-jump
   ├── Status Bar          — live count, color-coded by highest severity
   ├── Code Lens           — inline annotation at each violation's exact line
   ├── Editor Decorations  — underlines + gutter icons
   └── Dashboard Webview   — heat map, top offenders, filterable findings table
        │
        ▼
6. Developer selects a finding → confirms strategy → Bob applies the edit
   ├── /fix-claim <id> --strategy rename   — renames the misleading artifact
   └── /fix-claim <id> --strategy implement — fills the missing implementation
        │
   Or: /fix-all — processes every open finding sequentially (batch mode)
```

**Audits are read-only.** Remediation requires explicit user confirmation before Bob touches any file.

---

## Claim Taxonomy

TruthLens classifies violations into four categories, each with its own extraction and verification methodology:

| ID | Claim Source | Example Violation | Default Strategy |
|----|-------------|-------------------|-----------------|
| **CAT-A** | Function / method name | `sort_by_priority` returns unsorted list | `rename_artifact` or `fix_implementation` |
| **CAT-B** | Docstring / inline comment | `"""Persists record to database"""` but no DB call exists | `fix_implementation` or `update_documentation` |
| **CAT-C** | Test name / assertion label | `test_rejects_expired_token` asserts HTTP 200 | `rename_artifact` (rename test) |
| **CAT-D** | README / docs / config | `"zero dependencies"` with a populated `requirements.txt` | `update_documentation` |

Bob's **claim-verification** skill scores each finding on a 0.0–1.0 confidence scale and derives severity:

| Severity | Signal |
|----------|--------|
| **Critical** | Opposite behavior (validation that always passes, auth that never checks) |
| **High** | Core contract broken; callers rely on the promised behavior |
| **Medium** | Partial implementation; behavior is a subset of what is claimed |
| **Low** | Naming inconsistency with no functional impact |

Only findings at or above `truthlens.minimumConfidence` (default 0.7) appear in the UI.

---

## Architecture

```
Workspace
  ├── .bob/                         ← Scaffolded on first activation
  │   ├── modes/auditor.md          ← Claim Auditor persona + constraints
  │   ├── skills/claim-taxonomy.md  ← Extraction rules per category
  │   ├── skills/claim-verification.md ← Evidence checks, confidence, severity
  │   ├── commands/audit.md         ← /audit orchestration (5-phase)
  │   ├── commands/fix-claim.md     ← /fix-claim single-finding workflow
  │   └── commands/fix-all.md       ← /fix-all batch remediation
  │
  └── .truthlens/findings.json      ← Canonical output; watched by extension
                                       Schema: docs/findings-schema.json

TruthLens Extension (TypeScript, ~2 000 LOC)
  ├── Activation & scaffolding
  ├── Bob invocation (chat clipboard)
  ├── File watcher → reactive UI refresh
  └── UI surfaces
      ├── FindingsProvider    — Explorer tree view
      ├── StatusBarManager    — Live severity indicator
      ├── CodeLensProvider    — Inline annotations
      ├── DecorationProvider  — Editor underlines + gutter icons
      └── DashboardPanel      — Interactive webview
```

### Bob Integration Depth

TruthLens is **native to IBM Bob**, not a wrapper around a generic LLM call:

- **Custom Auditor mode** (`auditor.md`) — a scoped persona with read-only constraints, evidence-first reasoning, and false-positive avoidance rules baked in.
- **Two domain skills** — `claim-taxonomy.md` teaches Bob *what to extract*; `claim-verification.md` teaches Bob *how to verify* it. Skills are composable and independently testable.
- **Three slash commands** — `/audit`, `/fix-claim`, and `/fix-all` operate as first-class Bob commands with structured argument parsing, multi-phase execution, and deterministic output contracts.
- **Bob chat integration** — the extension copies the slash command to the clipboard and opens the Bob chat panel. The user pastes and runs; the file watcher detects the updated `findings.json` and refreshes all UI surfaces automatically.

---

## Key Capabilities

| Area | Detail |
|------|--------|
| **Structured audit** | Bob scans source, tests, and docs in a single pass; produces a versioned JSON report with severity, confidence, blast radius per finding |
| **Schema-validated output** | `docs/findings-schema.json` (JSON Schema draft-07) is the contract between Bob, the extension, and CI — no ambiguity in the data format |
| **Five IDE surfaces** | Findings explorer · status bar · code lens · editor decorations · interactive dashboard — violations are visible wherever the developer looks |
| **Batch remediation** | `/fix-all` processes every open finding sequentially, highest severity first, re-reading findings.json after each step to stay current |
| **Blast radius analysis** | Every finding reports caller count and affected file list; high-blast findings are surfaced prominently in the dashboard heat map |
| **CI-ready output** | `.truthlens/findings.json` can gate pipelines on critical or high findings without the IDE present |
| **Confidence filtering** | `minimumConfidence` threshold suppresses uncertain findings; teams tune the signal-to-noise ratio per project |
| **Explicit confirmation** | Every remediation requires user approval of the fix strategy and impacted files — no silent edits |

---

## Repository Layout

| Path | Contents |
|------|---------|
| `extension/` | TypeScript source (`src/`), `package.json`, build scripts — produces the installable `.vsix` |
| `bob_artifacts/` | Source-of-truth Bob materials copied to `.bob/` on scaffold (modes, skills, commands) |
| `docs/` | `findings-schema.json` (shared data contract), `PLAN.md` (implementation plan) |

---

## Prerequisites

- **IBM Bob IDE** (VS Code–compatible host) or VS Code with a compatible Bob integration.
- **Node.js ≥ 18** — to build the extension from source.
- A **workspace folder** containing the codebase to audit.

---

## Quick Start

```bash
# From repository root
cd extension
npm install
npm run compile        # TypeScript → out/

# Optional: package a distributable
npm run package        # produces truthlens-1.0.0.vsix
```

Then in Bob IDE:

1. Open the target workspace folder.
2. Allow TruthLens to scaffold `.bob/` on first activation — or run **TruthLens: Scaffold Bob Artifacts** from the command palette.
3. Run **TruthLens: Audit Repository** (or type `/audit` in Bob chat).
4. Open **TruthLens: Open Dashboard** to review findings.
5. Select any finding → **Fix Claim Violation** to remediate, or **Fix All Open Findings** for batch mode.

---

## Configuration

All settings use the `truthlens.` prefix:

| Setting | Values | Default | Effect |
|---------|--------|---------|--------|
| `decorationStyle` | `codelens` · `decoration` · `both` | `both` | Which inline surfaces appear in the editor |
| `autoAuditOnSave` | boolean | `false` | Re-runs audit whenever a file is saved |
| `minimumConfidence` | 0.0 – 1.0 | `0.7` | Hides findings below this confidence threshold |

---

## Measurable Impact

| Metric | Target |
|--------|--------|
| Detection rate on seeded violations | ≥ 67 % |
| False positive rate | ≤ 40 % |
| Extension activation time | < 500 ms |
| Tree view refresh on findings.json change | < 100 ms |
| Dashboard render time | < 300 ms |
| Audit completion (medium repo) | < 5 min |

Findings output is **machine-readable from day one** — `.truthlens/findings.json` can feed CI quality gates, dashboards, or ticket systems without any additional tooling. The `blastRadius` field quantifies downstream exposure per violation, giving teams a prioritization signal beyond severity alone.

---

## License

MIT — see `extension/package.json` and repository licensing files.

---

## Acknowledgments

TruthLens is built for **IBM Bob** and demonstrates how **agentic IDE workflows**, a rigorous claim taxonomy, schema-validated findings, and native editor UX can narrow the gap between what software **claims** and what it **does** — without replacing human judgment in review and release decisions.

**Repository:** [github.com/adamchok/TruthLens](https://github.com/adamchok/TruthLens)
