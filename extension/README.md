# TruthLens

**Semantic honesty audit for your codebase, powered by IBM Bob.**

TruthLens detects *claim violations* — cases where function names, docstrings, test names, or documentation contradict the actual implementation — and surfaces them across five native IDE surfaces with one-click Bob-powered remediation.

## Features

- **Automated claim detection** — Bob audits every source file, test, and doc in a single `/audit` pass, producing a schema-validated `findings.json`
- **Five IDE surfaces** — findings appear in the Explorer tree view, status bar, inline code lens, editor decorations, and an interactive dashboard webview
- **Blast radius analysis** — every finding reports caller count and affected files so high-impact violations are prioritized
- **Batch remediation** — `/fix-all` processes every open finding sequentially, highest severity first
- **Confidence filtering** — suppress uncertain findings with the `minimumConfidence` threshold

## Claim Categories

| ID | Source | Example |
|----|--------|---------|
| CAT-A | Function / method name | `sort_by_priority` returns unsorted list |
| CAT-B | Docstring / inline comment | `"""Persists record to DB"""` but no DB call |
| CAT-C | Test name / assertion label | `test_rejects_expired_token` asserts HTTP 200 |
| CAT-D | README / docs / config | `"zero dependencies"` with a populated `requirements.txt` |

## Requirements

- IBM Bob IDE (VS Code-compatible host)
- Node.js >= 18 (to build from source)

## Getting Started

1. Install the extension (`.vsix` sideload or marketplace)
2. Open a workspace — TruthLens scaffolds Bob artifacts into `.bob/` on first activation
3. Run **TruthLens: Audit Repository** from the command palette
4. Review findings in the Explorer sidebar or open the dashboard with **TruthLens: Open Dashboard**
5. Select any finding and choose **Fix Claim Violation** to remediate, or use **Fix All Open Findings** for batch mode

## Commands

| Command | Description |
|---------|-------------|
| `TruthLens: Audit Repository` | Run a full codebase audit via Bob |
| `TruthLens: Open Dashboard` | Open the interactive findings dashboard |
| `TruthLens: Fix Claim Violation` | Fix a specific violation with Bob |
| `TruthLens: Fix All Open Findings` | Batch-fix all open findings |
| `TruthLens: Scaffold Bob Artifacts` | Manually re-scaffold Bob configuration |
| `TruthLens: Refresh Findings` | Reload findings from disk |

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `truthlens.decorationStyle` | `codelens` \| `decoration` \| `both` | `both` | Which inline surfaces appear in the editor |
| `truthlens.autoAuditOnSave` | boolean | `false` | Re-run audit on file save |
| `truthlens.minimumConfidence` | 0.0 – 1.0 | `0.7` | Hide findings below this confidence threshold |

## Architecture

```
TruthLens Extension (TypeScript, ~2 000 LOC)
├── Activation & Bob artifact scaffolding
├── Bob invocation via chat clipboard
├── File watcher on .truthlens/findings.json → reactive UI refresh
└── UI surfaces
    ├── FindingsProvider     Explorer tree view (severity-grouped)
    ├── StatusBarManager     Live severity indicator
    ├── CodeLensProvider     Inline annotations at violation lines
    ├── DecorationProvider   Editor underlines + gutter icons
    └── DashboardPanel       Interactive webview (heat map, table, filters)
```

## Release Notes

### 1.0.0

Initial release — automated scaffolding, four claim categories, five IDE surfaces, one-click Bob-powered fixes.
