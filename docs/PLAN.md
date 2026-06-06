# TruthLens — Phased Implementation Plan

> **For agentic AI execution.** Each phase has explicit deliverables, testable success criteria, and a hard stop checkpoint. **Do not proceed to the next phase until the current phase's success criteria are 100% met and verified.** If a phase fails, stop and report the failure rather than working around it.

---

## Project Summary

**TruthLens** is an IBM Bob IDE extension that audits a codebase for "claims that no longer match reality" — lying function names, stale docstrings, false test names, broken README assertions, etc. The extension scaffolds Bob artifacts (custom mode, skills, slash commands) on activation, runs audits via Bob's reasoning, and surfaces findings through native VS Code UI primitives (tree view, code lens, status bar, webview dashboard).

**Target stack:**
- TypeScript + Node.js (extension host)
- VS Code Extension API (Bob is a VS Code fork)
- Bob IDE (analysis engine via custom mode + skills)
- Optional: watsonx.ai Granite for severity rationale generation
- Optional: watsonx Orchestrate for ticket routing

**Hard constraints:**
- Build time: ~36 working hours across 2 days
- All Bob session reports must be exported into `bob_sessions/` for judging
- Must run on a real public repo for the demo, not just the sample repo
- Must work end-to-end offline of any external dashboard (extension is the product)

---

## Global Conventions (Apply to Every Phase)

### File Layout
```
truthlens/
├── extension/                 # The .vsix source
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── bob_artifacts/             # Source-of-truth Bob files (copied into workspace on activation)
│   ├── modes/
│   │   └── auditor.md
│   ├── skills/
│   │   ├── claim-taxonomy.md
│   │   └── claim-verification.md
│   └── commands/
│       ├── audit.md
│       └── fix-claim.md
├── sample-repo/               # Repo with planted violations for testing
├── bob_sessions/              # Exported Bob session reports (for judging)
├── docs/
│   ├── findings-schema.json
│   └── demo-script.md
└── README.md
```

### Coding Standards
- TypeScript strict mode on
- All async operations wrapped in try/catch with user-visible error messages
- Every command registered must have a corresponding entry in `package.json` `contributes.commands`
- All file system writes use `vscode.workspace.fs` (never `fs` directly)
- All paths constructed via `vscode.Uri.joinPath` (never string concatenation)

### Bob Session Hygiene
- After every meaningful Bob task during development, export the task session via the History panel into `bob_sessions/`
- Name exports descriptively: `phase-2-scaffolding-logic.md`, `phase-4-claim-extraction.md`, etc.
- This is a judging deliverable. Do not skip.

### Phase Completion Protocol
At the end of every phase:
1. Run all phase tests in order
2. If any test fails, stop and report which test failed and why
3. If all tests pass, write a one-paragraph summary to `docs/phase-N-completion.md` describing what was built, what was tested, and what assumptions were made
4. Commit the work with a clear message like `feat(phase-N): <one-line summary>`
5. Only then proceed to the next phase

---

## Phase 0 — Environment Validation (1 hour, BLOCKING)

**Goal:** Confirm Bob IDE accepts standard `.vsix` extensions before writing any production code. If this phase fails, the entire plan is invalid and must be redesigned.

### Tasks

1. **Inspect Bob IDE extension host**
   - Open Bob IDE
   - Press `Cmd/Ctrl+Shift+P` → run "Developer: Show Running Extensions"
   - Confirm extension host is alive and lists currently running extensions
   - Take a screenshot, save as `docs/phase-0-evidence-1-running-extensions.png`

2. **Test marketplace extension install**
   - Open Extensions panel
   - Search for and install any small marketplace extension (e.g., "Code Spell Checker")
   - Confirm it activates without error
   - Uninstall it after confirmation

3. **Test sideload of a custom `.vsix`**
   - Generate a hello-world extension using `yo code` (TypeScript, New Extension)
   - Package with `vsce package` (install `@vscode/vsce` globally if needed)
   - In Bob IDE, Extensions panel → `…` menu → "Install from VSIX…"
   - Select the generated `.vsix`
   - Run the hello-world command from command palette
   - Confirm the "Hello World" notification appears
   - Take a screenshot, save as `docs/phase-0-evidence-2-helloworld.png`

4. **Probe Bob's command surface**
   - Open command palette
   - Type "bob"
   - Document every Bob-prefixed command that appears in `docs/phase-0-bob-commands.md`
   - For each, note whether it accepts arguments (try `vscode.commands.executeCommand('<command>')` from a debug console if possible)

5. **Probe writable workspace APIs**
   - In the hello-world extension, add code that writes a test file to `.bob-test/hello.md` in the open workspace using `vscode.workspace.fs.writeFile`
   - Run the command, confirm file appears
   - Take a screenshot, save as `docs/phase-0-evidence-3-fs-write.png`

6. **Probe webview API**
   - In the hello-world extension, add a command that creates a `WebviewPanel` displaying basic HTML
   - Run, confirm panel renders
   - Take a screenshot, save as `docs/phase-0-evidence-4-webview.png`

### Success Criteria (ALL MUST PASS)

- [ ] Bob IDE shows running extension host
- [ ] Marketplace extension installs and activates
- [ ] Custom `.vsix` sideloads successfully
- [ ] Custom command runs and shows notification
- [ ] Custom extension can write to workspace via `vscode.workspace.fs`
- [ ] Custom extension can render a webview panel
- [ ] Bob's command surface is documented (even if empty)

### Failure Protocol

If any criterion fails, **stop**. Report:
- Which step failed
- The exact error message
- A screenshot of the failure
- Whether Bob's documentation site mentions extension API restrictions

Do not proceed. Decision on architecture pivot (e.g., to Bob Shell subprocess approach) must be made by a human reviewer before continuing.

---

## Phase 1 — Sample Repository with Planted Violations (2 hours)

**Goal:** Create a small, realistic codebase containing 12 deliberately planted "claim violations" across the supported categories. This becomes the test fixture for every subsequent phase.

### Tasks

1. **Create `sample-repo/`** as a small Python or TypeScript project (pick one — Python recommended for clearer claim semantics).

2. **Decide on supported claim categories for v1.** For 2 days, support exactly these four:
   - **CAT-A: Function name vs. behavior** (name promises X, body does Y)
   - **CAT-B: Docstring vs. implementation** (docstring claims X, implementation does Y)
   - **CAT-C: Test name vs. test body** (test name asserts X, body tests Y)
   - **CAT-D: README claims vs. repo state** (e.g., "zero dependencies" with `requirements.txt` present)

3. **Plant exactly 12 violations**, distributed as:
   - 4 in CAT-A (function name lies)
   - 4 in CAT-B (docstring lies)
   - 3 in CAT-C (test name lies)
   - 1 in CAT-D (README lie)

4. **Document every plant** in `sample-repo/PLANTED_VIOLATIONS.md` with:
   - Violation ID (V01–V12)
   - Category
   - File path and line number
   - The claim text (verbatim)
   - The contradicting reality
   - Expected severity (low/medium/high)
   - Expected blast radius (number of callers / references)

5. **Plant control cases (decoys):** Add 5 functions/docstrings that *look* suspicious but are actually honest. These test for false positives. Document in `sample-repo/HONEST_DECOYS.md`.

### Example Plant (Reference Format)

```markdown
## V01 — CAT-A — Function Name Lies

**File:** `sample-repo/src/auth/validators.py:14`
**Function:** `validate_email`
**Claim (from name):** Function validates email format
**Reality:** Function only checks `len(email) > 0`. No format validation, no regex, no domain check.
**Severity:** High
**Blast radius:** 8 callers across 3 files
**Expected fix:** Either rename to `is_email_present` or restore validation logic
```

### Success Criteria

- [ ] `sample-repo/` exists and runs (`python -m pytest` or equivalent passes basic smoke test)
- [ ] Exactly 12 violations planted, distributed per the spec
- [ ] `PLANTED_VIOLATIONS.md` documents all 12 with full schema
- [ ] `HONEST_DECOYS.md` documents 5 decoys
- [ ] Repo has at least 15 source files (large enough that "scan whole repo" is meaningful)
- [ ] Repo has a real `README.md`, `requirements.txt`/`package.json`, and a small test suite

### Test

Manual review: a second person (or fresh Claude session) reads `PLANTED_VIOLATIONS.md` and `HONEST_DECOYS.md`, then opens the actual files, and confirms every documented plant is present and every decoy is genuinely honest. **Do not skip this — your audit logic in Phase 4 will be tested against this ground truth.**

---

## Phase 2 — Bob Artifacts (3 hours)

**Goal:** Author the Bob-side intelligence: the custom mode, the skills, and the slash commands that will perform the actual claim extraction and verification.

### Tasks

1. **Author `bob_artifacts/modes/auditor.md`** — custom mode definition.

   The mode should:
   - Define role as a "claim auditor" focused on detecting silent contract violations
   - Restrict tool access to read-only operations during audit phase (no file modifications)
   - Specify output format as JSON matching `findings.schema.json` (defined in Phase 3)
   - Reference the claim-taxonomy and claim-verification skills

2. **Author `bob_artifacts/skills/claim-taxonomy.md`** — defines what counts as a claim per category.

   For each of CAT-A, CAT-B, CAT-C, CAT-D:
   - What artifact is being inspected
   - What constitutes the "claim" (extraction rule)
   - What evidence proves or disproves the claim
   - Severity heuristics
   - Examples of true positives and decoys

3. **Author `bob_artifacts/skills/claim-verification.md`** — defines the verification methodology.

   Specify:
   - For CAT-A: How to compare function name semantics to body semantics. What signals indicate divergence.
   - For CAT-B: How to extract structured claims from docstrings (uses NumPy/Google/JSDoc conventions). How to verify against AST.
   - For CAT-C: How to extract assertion intent from test names. How to compare against test body assertions.
   - For CAT-D: How to extract factual claims from README. How to verify against repo state (deps, files, configs).

4. **Author `bob_artifacts/commands/audit.md`** — slash command that orchestrates the full audit.

   Behavior:
   - Activate Auditor mode
   - Walk every source file in the workspace (respect `.gitignore` and `.bobignore`)
   - For each file, extract candidate claims per the taxonomy
   - Verify each claim per the verification skill
   - Aggregate findings into a single JSON report
   - Write report to `.truthlens/findings.json`
   - Print summary table to chat

5. **Author `bob_artifacts/commands/fix-claim.md`** — slash command that fixes a specific finding by ID.

   Behavior:
   - Accept argument: finding ID (e.g., `F-007`)
   - Load `.truthlens/findings.json` and locate the finding
   - Present two fix strategies to the user: (a) update artifact to match code, (b) update code to match artifact
   - Apply the chosen strategy
   - Update findings.json to mark the finding as resolved

### Success Criteria

- [ ] All four artifacts exist as markdown files in `bob_artifacts/`
- [ ] Each is internally consistent (commands reference skills that exist; mode references skills that exist)
- [ ] Manual test: copy artifacts into a Bob workspace, activate the mode, run `/audit` on `sample-repo/`. Bob produces a `findings.json` file.
- [ ] The findings file contains at least 8 of the 12 planted violations (target: 10+; below 8 means the skills need refinement)
- [ ] No more than 2 false positives from the 5 decoys

### Test

Run the manual audit against `sample-repo/`. Save the resulting `findings.json` as `docs/phase-2-test-findings.json`. Cross-reference against `PLANTED_VIOLATIONS.md`:

| Metric | Threshold |
|---|---|
| True positive rate | ≥ 67% (8 of 12) |
| False positive rate | ≤ 40% (2 of 5 decoys) |
| Output is valid JSON parseable by `JSON.parse` | Required |

If thresholds are not met, iterate on `claim-taxonomy.md` and `claim-verification.md` and re-run. Do not proceed to Phase 3 until thresholds are met. Export the Bob session for this iteration into `bob_sessions/phase-2-audit-iteration-N.md`.

---

## Phase 3 — Findings Schema and Mock Data (1 hour)

**Goal:** Lock down the data contract between Bob (producer) and the extension (consumer). Generate mock findings to unblock UI development in parallel.

### Tasks

1. **Author `docs/findings-schema.json`** — JSON Schema (draft 2020-12) defining the findings file structure.

   Required fields per finding:
   - `id` (string, format: `F-NNN`)
   - `category` (enum: `CAT-A`, `CAT-B`, `CAT-C`, `CAT-D`)
   - `severity` (enum: `low`, `medium`, `high`)
   - `confidence` (number, 0.0–1.0)
   - `file` (string, workspace-relative path)
   - `line` (integer, 1-indexed)
   - `endLine` (integer, optional)
   - `claim` (object: `text`, `source`, `extractedFrom`)
   - `reality` (object: `description`, `evidence`)
   - `blastRadius` (object: `callerCount`, `affectedFiles`)
   - `suggestedFix` (object: `strategy`, `summary`)
   - `status` (enum: `open`, `resolved`, `dismissed`)

   Top-level fields:
   - `version` (string)
   - `generatedAt` (ISO 8601 timestamp)
   - `repository` (object: `root`, `commit`)
   - `summary` (object: total counts per severity)
   - `findings` (array of finding objects)

2. **Generate `docs/mock-findings.json`** with 12 mock findings exactly mirroring the planted violations from Phase 1. This unblocks Phase 5 (UI development) before Phase 4 (Bob integration) is complete.

3. **Validate** the Phase 2 test output (`docs/phase-2-test-findings.json`) against the schema using a JSON schema validator (`ajv-cli` recommended).

### Success Criteria

- [ ] `findings-schema.json` exists and is valid JSON Schema
- [ ] `mock-findings.json` exists, has 12 entries, validates against schema
- [ ] `phase-2-test-findings.json` validates against schema (if it doesn't, fix the schema or fix Bob's output until they agree)

### Test

```bash
npx ajv-cli validate -s docs/findings-schema.json -d docs/mock-findings.json
npx ajv-cli validate -s docs/findings-schema.json -d docs/phase-2-test-findings.json
```

Both must report `valid`.

---

## Phase 4 — Extension Skeleton and Bob Artifact Scaffolding (3 hours)

**Goal:** Build the minimal extension that, on activation, writes the Bob artifacts into the workspace. This is the "auto-provisioning" core.

### Tasks

1. **Scaffold extension** with `yo code` (TypeScript, New Extension). Move into `extension/`.

2. **Update `package.json`:**
   - `displayName`: "TruthLens"
   - `description`: "Continuous codebase honesty audit, powered by IBM Bob"
   - `activationEvents`: `["onStartupFinished"]`
   - `contributes.commands`: register stub commands (`truthlens.audit`, `truthlens.scaffold`, `truthlens.fix`, `truthlens.openDashboard`)

3. **Build artifact bundling.** The Bob artifacts from Phase 2 need to be embedded inside the extension and copied into the user's workspace on activation.
   - Add a build script that copies `bob_artifacts/**/*.md` into `extension/dist/bob_artifacts/` at compile time
   - Ensure these are included in the `.vsix` bundle (check `.vscodeignore`)

4. **Implement `scaffoldBobArtifacts()`** function:
   - Detect workspace root via `vscode.workspace.workspaceFolders[0].uri`
   - Check if `.bob/modes/auditor.md` already exists
   - If not, copy all bundled artifacts to corresponding `.bob/` paths in workspace
   - If yes, prompt: "TruthLens artifacts already exist. Overwrite?" with Yes/No/Show Diff

5. **Implement activation flow:**
   - On `activate()`, check workspace state for `truthlens.scaffolded` flag
   - If not scaffolded, call `scaffoldBobArtifacts()`
   - Show a one-time welcome notification: "TruthLens is ready. Run `TruthLens: Audit Repository` to begin."
   - Set the flag

6. **Implement `truthlens.scaffold` command** as a manual re-trigger of the same logic.

### Success Criteria

- [ ] Extension compiles without TypeScript errors
- [ ] `vsce package` produces a valid `.vsix`
- [ ] `.vsix` installs into Bob IDE without errors
- [ ] On first activation in a fresh workspace, `.bob/modes/auditor.md`, `.bob/skills/claim-taxonomy.md`, `.bob/skills/claim-verification.md`, `.bob/commands/audit.md`, `.bob/commands/fix-claim.md` all exist
- [ ] Welcome notification appears exactly once
- [ ] `TruthLens: Scaffold Bob Artifacts` command works as manual re-trigger
- [ ] On second activation, scaffolding does not silently re-run (idempotency)

### Test

Manual test sequence:
1. Open Bob IDE with no workspace open. Confirm extension activates without error (no workspace = no scaffold attempted).
2. Open `sample-repo/` (delete any pre-existing `.bob/` first). Confirm artifacts are written. Open one of the markdown files, confirm content matches `bob_artifacts/`.
3. Reload Bob IDE. Confirm welcome notification does not reappear.
4. Run `TruthLens: Scaffold Bob Artifacts` manually. Confirm overwrite prompt appears.
5. Open Bob's chat, manually run `/audit`. Confirm audit produces a findings file. (Cross-check with Phase 2 results.)

Export the Bob session as `bob_sessions/phase-4-end-to-end-audit.md`.

---

## Phase 5 — Findings Tree View and Status Bar (3 hours)

**Goal:** Surface findings in the IDE sidebar and status bar. This is the first user-visible feedback loop.

### Tasks

1. **Implement `FindingsProvider`** (`vscode.TreeDataProvider<FindingNode>`):
   - Reads `.truthlens/findings.json` from workspace
   - Top level: groups by severity (High/Medium/Low) with counts
   - Second level: individual findings with file:line and one-line claim summary
   - Each finding node has icon based on category
   - Implements `getChildren`, `getTreeItem`, `onDidChangeTreeData`

2. **Register tree view** in `package.json` `contributes.views.explorer` under id `truthlensFindings` with display name "TruthLens Findings".

3. **Implement file watcher** on `.truthlens/findings.json` using `vscode.workspace.createFileSystemWatcher`. On change, fire `onDidChangeTreeData`.

4. **Implement click-to-jump**: when a finding node is clicked, open the file at the specified line using `vscode.window.showTextDocument`.

5. **Implement status bar item:**
   - Position: `StatusBarAlignment.Left`, priority 100
   - Text: `$(eye) TruthLens: <N> claims violated` where N = total open findings
   - Tooltip: severity breakdown (e.g., "3 high, 7 medium, 2 low")
   - Click: opens the tree view (or runs `truthlens.openDashboard` once Phase 7 is done)
   - Color: red if any high severity, yellow if any medium, default otherwise

6. **Implement empty state**: if no `findings.json` exists, tree view shows "Run TruthLens: Audit Repository to begin" with a button.

### Success Criteria

- [ ] Tree view appears in Explorer sidebar after extension activation
- [ ] When `.truthlens/findings.json` is present, tree view shows findings grouped by severity
- [ ] Counts match the JSON exactly
- [ ] Clicking a finding opens the correct file at the correct line
- [ ] Status bar item shows correct count
- [ ] Modifying the JSON externally (e.g., resolving a finding) updates the tree within 1 second
- [ ] Empty state renders when no findings file exists

### Test

1. Copy `docs/mock-findings.json` to `sample-repo/.truthlens/findings.json`. Open `sample-repo/` in Bob IDE.
2. Confirm tree view shows 12 findings grouped by severity.
3. Click each finding, confirm correct file opens at correct line. Document any mismatches in `docs/phase-5-test-results.md`.
4. Edit `findings.json` and remove 3 findings. Confirm tree updates within 1 second.
5. Delete `findings.json`. Confirm empty state renders.
6. Run "TruthLens: Audit Repository" command (still a stub at this point — should at least display a "not yet implemented" message, OR if Phase 6 is done, should run the full audit).

---

## Phase 6 — Bob Integration: Triggering Audits Programmatically (4 hours)

**Goal:** Wire the `truthlens.audit` command to actually run a Bob audit. This is the most uncertain phase — outcome depends on Phase 0's findings about Bob's command surface.

### Tasks

**Decision tree based on Phase 0 results:**

#### Path A — Bob exposes a callable command

If `docs/phase-0-bob-commands.md` lists a command like `bob.chat.sendMessage` or `bob.runSlashCommand`:

1. Implement `truthlens.audit` to call `vscode.commands.executeCommand('<bob-command>', '/audit')`
2. Listen for completion via either a callback, a returned promise, or a file watcher on `.truthlens/findings.json`
3. Show progress notification while running

#### Path B — Bob does not expose programmatic invocation, but has a chat panel

1. Implement `truthlens.audit` to:
   - Open Bob's chat panel via the discovered command (e.g., `bob.openChat` or via `workbench.action.openView`)
   - Copy `/audit` to clipboard
   - Show a notification: "Bob chat is open. Press Cmd+V then Enter to run audit." with a "Got it" button
2. Watch `.truthlens/findings.json` for creation/modification
3. When the file appears or changes, refresh the tree view automatically

#### Path C — Bob exposes nothing; fall back to Bob Shell

1. Detect if `bob` CLI is on PATH (`which bob` / `where bob`)
2. Implement `truthlens.audit` to spawn `bob shell --non-interactive --prompt "/audit"` as a child process in the workspace directory
3. Stream output to a VS Code OutputChannel ("TruthLens")
4. Parse the resulting `.truthlens/findings.json` on completion

### Common to all paths

- Add progress UI via `vscode.window.withProgress` (Notification location)
- Handle errors gracefully — if audit fails, show notification with "View Logs" action
- Add an `OutputChannel` named "TruthLens" for diagnostic logs
- Add a setting `truthlens.bobIntegration` with values `auto | command | chat | shell` so the user can override the auto-detected path

### Success Criteria

- [ ] `truthlens.audit` command is wired to a real Bob trigger (not a stub)
- [ ] Running the command on `sample-repo/` produces `.truthlens/findings.json` with at least 8 of the 12 planted violations
- [ ] Progress UI is visible during the audit
- [ ] Errors are surfaced to the user (not silently swallowed)
- [ ] Tree view auto-refreshes when audit completes
- [ ] Status bar updates to reflect new findings count

### Test

End-to-end test with stopwatch:
1. Open `sample-repo/` (delete any existing `.truthlens/` and `.bob/` folders)
2. Reload Bob IDE
3. Confirm scaffolding completes
4. Run "TruthLens: Audit Repository"
5. Time the full flow until findings appear in tree view
6. Document timing in `docs/phase-6-timing.md`
7. Cross-reference findings against `PLANTED_VIOLATIONS.md`. Document hit rate.

Export Bob session as `bob_sessions/phase-6-real-audit.md`. **This is the most important Bob session for the judging deliverable** — it shows Bob doing the actual analysis work.

If hit rate is below 67%, iterate on Phase 2 artifacts (claim-taxonomy.md, claim-verification.md) and re-run. Document each iteration as `bob_sessions/phase-6-iteration-N.md`.

---

## Phase 7 — Code Lens and Inline Decorations (3 hours)

**Goal:** Surface findings inline in the editor where developers actually read code. This is the "spell check" experience.

### Tasks

1. **Implement `FindingsCodeLensProvider`** (`vscode.CodeLensProvider`):
   - For each open file, read findings whose `file` matches the document's path
   - For each matching finding, emit a CodeLens at the specified line
   - CodeLens title: `⚠️ Claim violated: <one-line summary>`
   - CodeLens command: `truthlens.showFindingDetail` with finding ID as argument

2. **Register provider** for languages: `python`, `javascript`, `typescript`, `markdown` (extend later if needed).

3. **Implement `truthlens.showFindingDetail` command:**
   - Accepts finding ID
   - Opens a markdown preview pane (or a webview) showing:
     - The claim text
     - The contradicting evidence
     - Severity and confidence
     - Blast radius
     - Two action buttons: "Fix with Bob (update artifact)" and "Fix with Bob (update code)"

4. **Implement decoration provider** (alternative to code lens, more subtle):
   - For each finding, decorate the relevant line range with `vscode.window.createTextEditorDecorationType`
   - Style: subtle red squiggly underline + gutter icon
   - Hover provider: shows the finding detail in hover
   - Add a setting `truthlens.decorationStyle` with values `codelens | decoration | both` (default `both`)

5. **Refresh logic:** when `findings.json` changes, fire `onDidChangeCodeLenses` and update decorations on all visible editors.

### Success Criteria

- [ ] Opening a file with planted violations shows visible code lens / decorations on the correct lines
- [ ] Hovering shows finding details
- [ ] Clicking the code lens opens the detail view
- [ ] Decorations clear when finding is resolved
- [ ] Setting `truthlens.decorationStyle` changes the visual presentation

### Test

1. With Phase 6 complete, run audit on `sample-repo/`
2. Open each file containing a planted violation
3. Confirm code lens / decoration appears on the correct line for every finding
4. Document any misalignments in `docs/phase-7-alignment.md`
5. Click each code lens, confirm detail view shows correct finding data
6. Change setting to `decoration` only, confirm code lens disappears, decorations remain
7. Take screenshots for each violation category for the demo deck

---

## Phase 8 — Webview Dashboard (4 hours)

**Goal:** Build the repo-wide visual dashboard that lands in the demo as the "money shot."

### Tasks

1. **Create `truthlens.openDashboard` command** that opens a `WebviewPanel` (column: Beside, retainContextWhenHidden: true).

2. **Build webview HTML+JS+CSS as a single file** (or use Vite/esbuild to bundle a minimal React app — judge based on remaining time; vanilla is faster).

3. **Dashboard sections:**

   **Section A — Header strip:**
   - Total findings count, broken down by severity
   - Repo name + last audit timestamp
   - "Re-run audit" button

   **Section B — Severity heat map:**
   - Grid of files (rows) × claim categories (columns)
   - Cell color intensity = number of findings in that file/category
   - Click a cell → filters Section D to that file/category

   **Section C — Top offenders:**
   - List of top 5 files by total findings
   - Each shows file path, finding count, severity breakdown bar

   **Section D — Findings list:**
   - Sortable, filterable table of all findings
   - Columns: severity, category, file:line, claim, action
   - Action column has "View" (jumps to file) and "Fix with Bob" buttons
   - Filter controls: severity multi-select, category multi-select, search box (matches claim text)

4. **Communication between webview and extension:**
   - Webview → Extension: `postMessage` for actions (view finding, run audit, fix)
   - Extension → Webview: `postMessage` for data updates (new findings, finding resolved)
   - Use a simple message protocol: `{ type: 'action' | 'data', payload: ... }`

5. **Auto-refresh:** when `findings.json` changes, push update to webview without reloading.

6. **Style:** match VS Code theme using CSS variables (`var(--vscode-foreground)`, `var(--vscode-editor-background)`, etc.). Do not hardcode colors.

### Success Criteria

- [ ] `truthlens.openDashboard` opens the webview panel
- [ ] Dashboard renders all sections with correct data from `findings.json`
- [ ] Heat map cells are clickable and filter the findings list
- [ ] "View" button jumps to file:line in editor
- [ ] "Fix with Bob" button triggers the fix flow (Phase 9 — stub for now if needed)
- [ ] Filtering and sorting work correctly
- [ ] Theme adapts to light/dark VS Code themes
- [ ] Auto-refresh works when findings change

### Test

1. With audit complete, run "TruthLens: Open Dashboard"
2. Verify all 12 mock/real findings appear in the table
3. Click each section's interactive element, document behavior in `docs/phase-8-dashboard-test.md`
4. Switch VS Code theme between light and dark, confirm dashboard adapts
5. Resolve a finding via tree view, confirm dashboard updates within 1 second
6. Take screenshots for the demo deck

---

## Phase 9 — Fix With Bob Action (2 hours)

**Goal:** Close the loop. Each finding can be one-click fixed via Bob.

### Tasks

1. **Implement `truthlens.fix` command** that accepts a finding ID:
   - Loads the finding from `findings.json`
   - Builds a Bob prompt referencing the finding by ID and the desired strategy
   - Triggers Bob via the same integration path used in Phase 6
   - On completion, marks the finding as `resolved` in `findings.json`

2. **Pre-fix confirmation modal** (in the detail webview):
   - Show the proposed change strategy
   - Show which files will be modified (call out blast radius)
   - "Apply" / "Cancel" buttons

3. **Post-fix verification:**
   - After fix applies, automatically re-run the audit on just the affected files (cheap re-check)
   - If the finding is gone, mark resolved
   - If it persists, leave open and notify user

4. **Undo support:**
   - Use Bob's checkpoint feature
   - Add "Revert this fix" action on resolved findings within the dashboard
   - This calls Bob's checkpoint restore for the relevant task

### Success Criteria

- [ ] "Fix with Bob" button on any finding produces a real code/artifact change
- [ ] Modified files actually resolve the planted violation
- [ ] Finding moves from `open` to `resolved` in findings.json
- [ ] Tree view, status bar, dashboard, and code lens all update accordingly
- [ ] At least 3 of the 12 planted violations can be successfully fixed end-to-end

### Test

For 3 specific planted violations (one CAT-A, one CAT-B, one CAT-C):
1. Click "Fix with Bob" from the detail view
2. Confirm the proposed change in the modal
3. Apply
4. Verify the file is modified correctly
5. Verify the finding is marked resolved across all UIs
6. Document the full flow with screenshots in `docs/phase-9-fix-flow.md`

Export the Bob session as `bob_sessions/phase-9-fix-cycles.md`.

---

## Phase 10 — Demo Polish and Real-Repo Validation (3 hours)

**Goal:** Ensure the demo lands. Test on something other than the sample repo.

### Tasks

1. **Pick a real public repo** for the demo. Criteria:
   - Mid-size (500-3000 LOC)
   - Has README, docstrings, tests
   - Public license (MIT/Apache/BSD)
   - Old enough to have accumulated real drift (2+ years of history)
   - Suggested candidates: a small Flask/Express utility, an OSS CLI tool, a deprecated-but-maintained library

2. **Run end-to-end on the real repo:**
   - Clone fresh
   - Open in Bob IDE with TruthLens installed
   - Run audit
   - Document findings in `docs/phase-10-real-repo-findings.md`
   - **Identify the 3 most demo-worthy real findings** — ones a senior engineer would clearly recognize as real lies

3. **Build demo script** in `docs/demo-script.md`:
   - Opening line (the pitch)
   - Setup: open the real repo
   - Beat 1: install extension → scaffolding happens automatically
   - Beat 2: run audit → progress visible → findings appear
   - Beat 3: open dashboard → heat map shows hot spots
   - Beat 4: click into a real finding → show the lie
   - Beat 5: click "Fix with Bob" → watch it resolve
   - Beat 6: close with the tagline

4. **Record a backup video** of the full demo at 1x speed. If the live demo fails, you can fall back to the recording.

5. **Final README.md** at repo root:
   - 60-second pitch
   - Architecture diagram (one image)
   - How to install the `.vsix`
   - How to run an audit
   - Link to `bob_sessions/`
   - Roadmap (mention CAT-E through CAT-J as future work)

6. **Verify all `bob_sessions/` exports** are present per the judging criteria.

### Success Criteria

- [ ] Real repo audit produces ≥ 3 genuinely demo-worthy real findings
- [ ] Full demo runs end-to-end without errors at least 3 times in a row
- [ ] Demo script exists and is rehearsed
- [ ] Backup demo recording exists
- [ ] `bob_sessions/` contains at least 6 exported sessions covering meaningful work
- [ ] README is publishable

### Test

1. Run the full demo script three times back to back. Each run must succeed without manual intervention.
2. On the third run, time it. Target: under 4 minutes total.
3. Have a teammate (not the builder) install the `.vsix` from scratch and run the demo following only the README. Document any friction in `docs/phase-10-cold-install-feedback.md` and fix.

---

## Phase 11 — Optional watsonx Integration (Time-permitting only)

**Goal:** Strengthen the IBM stack story without compromising the core demo.

**Only proceed if Phase 10 is fully green and ≥ 4 hours remain.**

### Tasks (pick one, not both)

#### Option A — watsonx.ai Granite for severity rationale

- For each finding, after Bob produces it, call watsonx.ai Granite to generate a 1-2 sentence "why this matters" explanation tailored to a senior engineer audience
- Store in `finding.severity_rationale` field
- Display in the detail view

#### Option B — watsonx Orchestrate for ticket creation

- Add a "Send to Jira" / "Send to Linear" action on findings
- Use a watsonx Orchestrate agent that consumes findings JSON and creates tickets
- Show in dashboard as "X findings tracked in Linear"

### Success Criteria (whichever option)

- [ ] Integration works end-to-end on at least one finding
- [ ] Failure modes are graceful (if watsonx is unreachable, feature degrades quietly — does not break core extension)
- [ ] At least one screenshot for the demo

---

## Cross-Cutting Concerns

### Error Handling Standards

Every external operation (file read/write, Bob invocation, watsonx call) wraps in:

```typescript
try {
  // operation
} catch (err) {
  outputChannel.appendLine(`[<phase>] ${err.message}\n${err.stack}`);
  vscode.window.showErrorMessage(
    `TruthLens: <user-facing message>`,
    'View Logs'
  ).then(action => {
    if (action === 'View Logs') outputChannel.show();
  });
}
```

### Logging Standards

Every command and major function logs entry/exit to the OutputChannel with timestamp and phase tag. Example:

```
[2026-05-02T03:14:22Z] [audit] Starting audit on workspace: /path/to/repo
[2026-05-02T03:14:22Z] [audit] Bob integration mode: command
[2026-05-02T03:15:01Z] [audit] Audit complete. 12 findings written to .truthlens/findings.json
```

### Performance Budgets

- Extension activation: < 500ms (do not block on scaffolding; defer with `setImmediate`)
- Tree view refresh: < 100ms after findings.json change
- Webview initial render: < 300ms after panel open
- Audit on `sample-repo/`: < 60 seconds end-to-end

If any budget is exceeded, document in `docs/perf-issues.md` and decide whether to fix or accept.

### Security Notes

- Never read or write outside `vscode.workspace.workspaceFolders`
- Never execute arbitrary code from findings.json (treat as untrusted data)
- Sanitize all strings going into webview HTML (use `escapeHtml` helper)
- `.bobignore` and `.gitignore` must be respected during audit

---

## Final Deliverables Checklist

Before declaring the project complete, verify:

- [ ] `extension/` builds a valid `.vsix`
- [ ] `.vsix` installs cleanly into a fresh Bob IDE
- [ ] Sample repo has 12 documented planted violations and 5 honest decoys
- [ ] Audit on sample repo finds ≥ 67% of plants with ≤ 40% false positive rate
- [ ] Audit on real repo produces ≥ 3 demo-worthy genuine findings
- [ ] All five UI surfaces work: tree view, status bar, code lens, decorations, webview dashboard
- [ ] Fix-with-Bob works for at least 3 finding categories
- [ ] `bob_sessions/` contains all required exports per judging criteria
- [ ] README is complete and publishable
- [ ] Demo script is rehearsed and a backup recording exists
- [ ] Project repo is committed, branches merged, ready for submission

---

## What To Do When Stuck

If a phase test fails and you cannot resolve it within 90 minutes:

1. Stop coding
2. Write a `docs/blocker-phase-N.md` describing exactly what is failing
3. List the three most plausible causes
4. List the three smallest experiments that would distinguish between them
5. Run one experiment, document result, repeat or escalate

Do not work around blockers silently. The cost of a hidden architectural problem grows exponentially with phase number.

---

*End of plan.*
