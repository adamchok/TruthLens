# /audit - TruthLens Repository Audit Command

Performs a comprehensive claim violation audit on the current workspace.

## Usage

```
/audit [options]
```

## Options

- `--scope <path>` - Limit audit to specific directory (default: entire workspace)
- `--categories <list>` - Comma-separated categories to check (default: all)
  - Valid: `CAT-A`, `CAT-B`, `CAT-C`, `CAT-D`
  - Example: `--categories CAT-A,CAT-B`
- `--min-confidence <float>` - Minimum confidence threshold (default: 0.5)
- `--output <path>` - Custom output path (default: `.truthlens/findings.json`)

## Examples

```bash
# Full repository audit
/audit

# Audit only source directory
/audit --scope src/

# Check only function names and docstrings
/audit --categories CAT-A,CAT-B

# High-confidence findings only
/audit --min-confidence 0.8
```

## Execution Flow

### Phase 1: Initialization

1. **Activate Auditor Mode**
   ```
   /mode auditor
   ```

2. **Load Skills**
   - Load `claim-taxonomy` skill
   - Load `claim-verification` skill

3. **Prepare Output Directory**
   - Create `.truthlens/` directory if it doesn't exist
   - Initialize findings structure

4. **Discover Project Structure**
   - List all files in workspace
   - Respect `.gitignore` and `.bobignore`
   - Identify file types (Python, JavaScript, TypeScript, etc.)
   - Count total files to audit

5. **Display Audit Plan**
   ```
   🔍 TruthLens Audit Starting
   
   Workspace: /path/to/workspace
   Scope: entire repository
   Categories: CAT-A, CAT-B, CAT-C, CAT-D
   Files to scan: 47
   
   This may take 2-3 minutes...
   ```

### Phase 2: File Scanning

For each file in scope:

1. **Determine File Type**
   - Python: `.py`
   - JavaScript/TypeScript: `.js`, `.ts`, `.jsx`, `.tsx`
   - Documentation: `.md`, `.rst`, `.txt`
   - Tests: Files in `tests/`, `test/`, `__tests__/` or matching `test_*.py`, `*.test.js`

2. **Read File Content**
   ```
   read_file(path)
   ```

3. **Extract Claims** (using claim-taxonomy skill)
   
   **For source files (CAT-A, CAT-B)**:
   - List all function/method definitions
   - For each function:
     - Extract claim from function name (CAT-A)
     - Extract claims from docstring (CAT-B)
     - Store for verification

   **For test files (CAT-C)**:
   - List all test functions (starting with `test_` or `@test`)
   - For each test:
     - Extract claim from test name
     - Store for verification

   **For documentation files (CAT-D)**:
   - Extract factual claims from README, docs
   - Focus on verifiable statements
   - Store for verification

4. **Progress Update**
   ```
   [12/47] Scanning src/auth/validators.py... (4 claims found)
   ```

### Phase 3: Claim Verification

For each extracted claim:

1. **Verify Against Reality** (using claim-verification skill)
   
   **CAT-A Verification**:
   - Read function body
   - Analyze what it actually does
   - Compare to function name semantics
   - Determine if violation exists

   **CAT-B Verification**:
   - Read function body
   - Check for claimed operations (database, sorting, validation, etc.)
   - Compare to docstring claims
   - Determine if violation exists

   **CAT-C Verification**:
   - Read test body
   - Identify assertions
   - Compare to test name claim
   - Determine if violation exists

   **CAT-D Verification**:
   - Check repository state (files, dependencies, structure)
   - Compare to documentation claims
   - Determine if violation exists

2. **Assess Confidence**
   - Calculate confidence score (0.0-1.0)
   - Only keep findings with confidence ≥ min-confidence threshold

3. **Determine Severity**
   - Assess impact (Critical, High, Medium, Low)
   - Consider security, functionality, and blast radius

4. **Estimate Blast Radius**
   - Search for callers/references
   - Count affected files
   - Document dependencies

5. **Generate Suggested Fix**
   - Determine fix strategy (rename artifact vs. fix implementation)
   - Provide concrete suggestion

### Phase 4: Output Generation

1. **Aggregate Findings**
   - Collect all verified violations
   - Sort by severity (Critical → High → Medium → Low)
   - Assign sequential IDs (F-001, F-002, etc.)

2. **Generate Summary Statistics**
   ```json
   {
     "total": 12,
     "critical": 2,
     "high": 5,
     "medium": 4,
     "low": 1,
     "byCategory": {
       "CAT-A": 4,
       "CAT-B": 4,
       "CAT-C": 3,
       "CAT-D": 1
     }
   }
   ```

3. **Write Findings File**
   - Write **one** JSON document to `.truthlens/findings.json` (or `--output`) using the schema below
   - Follow **every** rule under [Extension compatibility (required)](#extension-compatibility-required) so the TruthLens VS Code extension can parse the file

4. **Display Summary**
   ```
   ✅ Audit Complete
   
   📊 Summary:
   - Total findings: 12
   - Critical: 2 🔴
   - High: 5 🟠
   - Medium: 4 🟡
   - Low: 1 🟢
   
   📁 Output: .truthlens/findings.json
   
   Top violations:
   1. [CRITICAL] hash_password returns plain text (src/auth/validators.py:41)
   2. [CRITICAL] test_hash_password_uses_bcrypt tests plain text (tests/test_validators.py:32)
   3. [HIGH] validate_email has no validation logic (src/auth/validators.py:14)
   
   Run /fix <finding-id> to resolve a specific violation.
   ```

### Phase 5: Cleanup

1. **Deactivate Auditor Mode** (optional, user can stay in mode)
2. **Log Audit Metadata**
   - Timestamp
   - Duration
   - Files scanned
   - Findings count

## Output Format

The findings file (`.truthlens/findings.json`) follows this structure.

### Extension compatibility (required)

The VS Code extension loads this path with `JSON.parse` on **UTF-8** text. Wrong encoding or schema breaks the Findings tree, dashboard, and code lens.

#### File encoding (critical on Windows)

- Write **UTF-8 only**. Do **not** use UTF-16 / UTF-32, and do **not** use “Unicode” or “UTF-16 LE” saves (common in some Windows editors and tools).
- **No BOM**: do **not** write a UTF-8 byte-order mark. The **first byte** of the file must be `0x7B` (`{`). No invisible characters, markers, or prose before `{`.
- The file must contain **only** the JSON object—no markdown fences, no commentary before or after.

#### JSON syntax

- **Strict JSON**: double-quoted keys and strings, no `//` or `/* */` comments, no trailing commas, no `undefined`/`NaN`/`Infinity`.
- Prefer serializing from a proper JSON encoder (conceptually `JSON.stringify` with stable formatting).

#### `summary` must match **open** findings

Counts must reflect **only** findings where `"status": "open"`:

- `summary.total` = number of `findings[]` entries with `status === "open"`.
- `summary.critical` / `high` / `medium` / `low` = counts among **open** findings only.
- `summary.byCategory["CAT-A"]` … `"CAT-D"` = counts among **open** findings per category (use `0` when none).

For a **new audit**, every finding should be `"status": "open"`, so totals match the full `findings` array.

#### Required enums (exact strings)

| Field | Allowed values |
|-------|----------------|
| `finding.category` | `CAT-A`, `CAT-B`, `CAT-C`, `CAT-D` |
| `finding.severity` | `critical`, `high`, `medium`, `low` |
| `finding.claim.source` | `function_name`, `docstring`, `test_name`, `comment`, `documentation` |
| `finding.suggestedFix.strategy` | `rename_artifact`, `fix_implementation`, `update_documentation`, `add_validation` |
| `finding.status` (new audits) | `open` |

#### Paths and primitives

- `repository.root`: workspace root path string; `repository.commit`: string — use `"N/A"` if no git SHA (do not omit `commit`).
- `repository.branch`: optional string.
- `file` and `blastRadius.affectedFiles`: **repo-relative** paths; prefer forward slashes (e.g. `src/foo/bar.py`).
- `line`: integer ≥ `1`; `confidence`: number in `0`..`1`.
- `reality.evidence`: a **string** or an **array of strings**.

### Example document

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-05-01T21:00:00Z",
  "repository": {
    "root": "/workspace/path",
    "commit": "abc123def" 
  },
  "summary": {
    "total": 12,
    "critical": 2,
    "high": 5,
    "medium": 4,
    "low": 1,
    "byCategory": {
      "CAT-A": 4,
      "CAT-B": 4,
      "CAT-C": 3,
      "CAT-D": 1
    }
  },
  "findings": [
    {
      "id": "F-001",
      "category": "CAT-A",
      "severity": "critical",
      "confidence": 0.98,
      "file": "src/auth/validators.py",
      "line": 41,
      "endLine": 43,
      "claim": {
        "text": "hash_password",
        "source": "function_name",
        "extractedFrom": "Line 41: def hash_password(password):"
      },
      "reality": {
        "description": "Function returns password unchanged, no hashing performed",
        "evidence": "Line 43: return password"
      },
      "blastRadius": {
        "callerCount": 12,
        "affectedFiles": ["src/auth/login.py", "src/api/users.py", "src/auth/register.py"]
      },
      "suggestedFix": {
        "strategy": "fix_implementation",
        "summary": "Implement bcrypt hashing: import bcrypt; return bcrypt.hashpw(password.encode(), bcrypt.gensalt())"
      },
      "status": "open"
    }
  ]
}
```

## Error Handling

If audit fails:

1. **Workspace Not Found**
   ```
   ❌ Error: No workspace open. Please open a folder first.
   ```

2. **Permission Denied**
   ```
   ❌ Error: Cannot write to .truthlens/ directory. Check permissions.
   ```

3. **Invalid Options**
   ```
   ❌ Error: Invalid category 'CAT-X'. Valid categories: CAT-A, CAT-B, CAT-C, CAT-D
   ```

4. **Partial Failure**
   ```
   ⚠️  Warning: Could not scan 3 files due to encoding errors.
   Audit completed with 44/47 files scanned.
   ```

## Performance Considerations

- **Small repos (<100 files)**: ~1-2 minutes
- **Medium repos (100-500 files)**: ~3-5 minutes
- **Large repos (500+ files)**: ~10-15 minutes

Progress is shown during execution to indicate activity.

## Integration with Extension

The TruthLens extension will:
1. Watch for `.truthlens/findings.json` creation/modification
2. Parse the findings
3. Update UI (tree view, status bar, code lens)
4. Provide interactive actions

## Notes

- Audit is **read-only** - no files are modified
- Findings are **deterministic** - same code produces same findings
- Confidence scores are **calibrated** - high confidence means high accuracy
- Suggested fixes are **actionable** - can be applied via `/fix` command

---

**Run this command** to start a comprehensive claim violation audit of your codebase.