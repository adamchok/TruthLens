# /fix - TruthLens Fix Claim Violation Command

Resolves a specific claim violation by either updating the artifact (name/docstring) or fixing the implementation.

## Usage

```
/fix <finding-id> [--strategy <strategy>]
```

## Arguments

- `<finding-id>` - Required. The finding ID from audit results (e.g., `F-001`)
- `--strategy <strategy>` - Optional. Fix strategy to use:
  - `rename` - Update the artifact (function name, docstring, test name, documentation)
  - `implement` - Fix the implementation to match the claim
  - `ask` - Prompt user to choose (default)

## Examples

```bash
# Interactive fix (asks user to choose strategy)
/fix F-001

# Rename function to match implementation
/fix F-001 --strategy rename

# Fix implementation to match claim
/fix F-001 --strategy implement
```

## Execution Flow

### Phase 1: Load Finding

1. **Read Findings File**
   ```
   read_file(.truthlens/findings.json)
   ```

2. **Locate Finding by ID**
   - Parse JSON
   - Find finding with matching ID
   - Validate finding exists

3. **Display Finding Details**
   ```
   📋 Finding F-001
   
   Category: CAT-A (Function name vs. behavior)
   Severity: Critical 🔴
   File: src/auth/validators.py:41
   
   Claim: "hash_password" (function name)
   Reality: Returns password unchanged, no hashing
   
   Blast Radius:
   - 12 callers
   - 3 affected files
   ```

### Phase 2: Strategy Selection

If `--strategy` not provided, present options:

```
🔧 How would you like to fix this?

1. Rename artifact (update function name to match behavior)
   → Rename to: return_password_unchanged
   → Impact: 12 callers need updating
   → Risk: Medium (breaking change)

2. Fix implementation (add hashing to match claim)
   → Add: bcrypt hashing logic
   → Impact: Behavior changes for 12 callers
   → Risk: High (security-sensitive)

3. Cancel

Choose [1/2/3]:
```

Wait for user input.

### Phase 3: Strategy-Specific Execution

#### Strategy: Rename Artifact

**For CAT-A (Function Name)**:

1. **Generate New Name**
   - Analyze actual behavior
   - Suggest honest name
   - Example: `hash_password` → `return_password_unchanged` or `store_password_plaintext`

2. **Find All References**
   ```
   search_files(
     path: workspace_root,
     regex: "hash_password\\(",
     file_pattern: "*.py"
   )
   ```

3. **Show Refactoring Plan**
   ```
   📝 Refactoring Plan
   
   Will rename: hash_password → return_password_unchanged
   
   Files to update:
   - src/auth/validators.py (definition)
   - src/auth/login.py (3 calls)
   - src/api/users.py (5 calls)
   - src/auth/register.py (4 calls)
   - tests/test_validators.py (1 call)
   
   Total changes: 14 locations
   
   Proceed? [y/n]:
   ```

4. **Apply Changes**
   - Update function definition
   - Update all call sites
   - Update imports if needed
   - Update related docstrings

5. **Verify Changes**
   - Re-read modified files
   - Confirm all references updated

**For CAT-B (Docstring)**:

1. **Generate Honest Docstring**
   - Analyze actual implementation
   - Write accurate docstring
   - Match existing style (NumPy, Google, JSDoc)

2. **Show Proposed Change**
   ```
   📝 Docstring Update
   
   Current:
   """
   Creates a new task and persists it to the database.
   """
   
   Proposed:
   """
   Creates a new task and stores it in memory.
   
   Note: Tasks are not persisted to database. Use save_to_db()
   to persist tasks permanently.
   """
   
   Proceed? [y/n]:
   ```

3. **Apply Change**
   - Update docstring in place
   - Preserve formatting

**For CAT-C (Test Name)**:

1. **Generate Honest Test Name**
   - Analyze test assertions
   - Suggest accurate name
   - Example: `test_rejects_invalid` → `test_accepts_any_nonempty`

2. **Show Proposed Change**
   ```
   📝 Test Rename
   
   Current: test_validate_email_rejects_invalid_format
   Proposed: test_validate_email_accepts_any_nonempty_string
   
   Proceed? [y/n]:
   ```

3. **Apply Change**
   - Rename test function
   - Update test docstring if present

**For CAT-D (Documentation)**:

1. **Generate Accurate Documentation**
   - Check actual repository state
   - Write factual statement
   - Example: "zero dependencies" → "minimal dependencies (pytest, requests, sqlalchemy)"

2. **Show Proposed Change**
   ```
   📝 Documentation Update
   
   File: README.md:3
   
   Current:
   "A lightweight Python task management system with zero external dependencies."
   
   Proposed:
   "A lightweight Python task management system with minimal dependencies."
   
   (Add dependency list to installation section)
   
   Proceed? [y/n]:
   ```

3. **Apply Change**
   - Update documentation text
   - Add clarifying details if needed

#### Strategy: Fix Implementation

**For CAT-A & CAT-B (Function/Method)**:

1. **Analyze Required Implementation**
   - Determine what needs to be added
   - Check for required imports
   - Estimate complexity

2. **Show Implementation Plan**
   ```
   🔨 Implementation Fix
   
   Function: hash_password
   Required: Add bcrypt hashing
   
   Changes needed:
   1. Add import: import bcrypt
   2. Replace: return password
      With: return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
   3. Update return type hint if present
   
   Complexity: Medium
   Risk: High (security-sensitive, changes behavior)
   
   Proceed? [y/n]:
   ```

3. **Apply Implementation**
   - Add required imports
   - Update function body
   - Preserve existing logic where appropriate
   - Add error handling if needed

4. **Suggest Testing**
   ```
   ✅ Implementation updated
   
   ⚠️  Important: This changes behavior for 12 callers.
   
   Recommended next steps:
   1. Run tests: python -m pytest tests/test_validators.py
   2. Check affected callers for compatibility
   3. Update related tests if needed
   
   Run tests now? [y/n]:
   ```

**For CAT-C (Test)**:

1. **Fix Test Assertions**
   - Analyze test name claim
   - Update assertions to match
   - Example: Change `assert result == True` to `assert result == False`

2. **Show Proposed Fix**
   ```
   🔨 Test Fix
   
   Test: test_validate_email_rejects_invalid_format
   
   Current assertions:
   assert validate_email("not-an-email") == True
   assert validate_email("@@@") == True
   
   Fixed assertions:
   assert validate_email("not-an-email") == False
   assert validate_email("@@@") == False
   
   Proceed? [y/n]:
   ```

3. **Apply Fix**
   - Update test assertions
   - Preserve test structure

**For CAT-D (Documentation)**:

Not applicable - documentation violations are fixed by updating documentation (rename strategy).

### Phase 4: Post-Fix Actions

1. **Update Findings File**
   - Mark finding as `resolved`
   - Add resolution metadata:
     ```json
     {
       "status": "resolved",
       "resolvedAt": "2026-05-01T21:10:00Z",
       "resolution": {
         "strategy": "fix_implementation",
         "summary": "Added bcrypt hashing to hash_password function"
       }
     }
     ```

2. **Re-verify (Optional)**
   - Re-run verification on the fixed artifact
   - Confirm violation is resolved
   - Update confidence if still present

3. **Display Success**
   ```
   ✅ Finding F-001 Resolved
   
   Strategy: Fix implementation
   Changes: 1 file modified (src/auth/validators.py)
   Status: Resolved
   
   Remaining violations: 11
   
   Next critical finding: F-002 (test_hash_password_uses_bcrypt)
   Run /fix F-002 to continue.
   ```

### Phase 5: Cleanup

1. **Save All Changes**
   - Ensure all file modifications are written
   - Update findings.json — **UTF-8, no BOM**, strict JSON; `summary` recomputed from **open** findings only (same rules as `/audit` output)

2. **Trigger Extension Refresh**
   - Extension watches findings.json
   - UI updates automatically

## Error Handling

**Finding Not Found**:
```
❌ Error: Finding F-999 not found in .truthlens/findings.json
Run /audit to generate findings first.
```

**Already Resolved**:
```
ℹ️  Finding F-001 is already resolved.
Resolved at: 2026-05-01T21:10:00Z
Strategy used: fix_implementation

Re-open this finding? [y/n]:
```

**Conflicting Changes**:
```
⚠️  Warning: File src/auth/validators.py has unsaved changes.
Save changes before applying fix? [y/n]:
```

**Fix Failed**:
```
❌ Error: Could not apply fix to src/auth/validators.py
Reason: File is read-only

Manual fix required. See suggested changes above.
```

## Safety Features

1. **Confirmation Required**
   - All fixes require user confirmation
   - Show full impact before applying

2. **Blast Radius Warning**
   - Warn if fix affects many files
   - Show list of affected locations

3. **Risk Assessment**
   - Label fixes as Low/Medium/High risk
   - Explain potential issues

4. **Rollback Support**
   - Suggest creating git commit before fix
   - Provide undo instructions

## Integration with Extension

The extension will:
1. Provide "Fix with Bob" buttons in UI
2. Pre-populate finding ID when clicked
3. Show fix progress in status bar
4. Refresh UI after fix completes
5. Fail to refresh if findings.json is not **UTF-8 without BOM** or breaks strict JSON — preserve extension compatibility whenever you rewrite the file

## Notes

- Fixes are **interactive** - user confirms each change
- Fixes are **targeted** - only modify what's necessary
- Fixes are **documented** - resolution recorded in findings.json
- Fixes are **reversible** - can be undone via git or manual edit

---

**Run this command** to resolve a specific claim violation identified by the audit.