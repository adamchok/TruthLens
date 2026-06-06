# Claim Verification Skill

This skill defines the methodology for verifying claims against reality and determining if a violation exists.

## Overview

**Verification** is the process of comparing an extracted claim against the actual implementation to determine if they match. A **violation** occurs when there is a semantic mismatch between claim and reality.

## General Verification Process

For every claim:

1. **Understand the claim**: What specific behavior/property is promised?
2. **Locate the evidence**: Where should this behavior be implemented?
3. **Analyze the implementation**: What does the code actually do?
4. **Compare semantics**: Do claim and reality align?
5. **Assess confidence**: How certain are you of the mismatch?
6. **Determine severity**: What's the impact of this violation?

## Category-Specific Verification

### CAT-A: Function/Method Name vs. Behavior

**Verification Steps**:

1. **Parse the function name** into semantic components
   - Action verb: `validate`, `sanitize`, `hash`, `sort`, `delete`, `export`
   - Object: `email`, `password`, `user`, `task`
   - Qualifiers: `high_priority`, `completed`, `valid`

2. **Read the function body** completely
   - Trace all code paths
   - Identify all operations performed
   - Note what is NOT done

3. **Check for core operations**:
   - Does `validate_*` actually validate? (regex, format checks, rules)
   - Does `sanitize_*` actually sanitize? (remove/escape dangerous chars)
   - Does `hash_*` actually hash? (cryptographic function, not plain text)
   - Does `sort_*` actually sort? (comparison, ordering)
   - Does `delete_*` actually delete? (remove from storage, not just mark)
   - Does `export_*` export to claimed format? (JSON vs CSV vs XML)

4. **Compare semantics**:
   - **Exact match**: Implementation does exactly what name suggests → ✓ HONEST
   - **Subset**: Implementation does less → ✗ VIOLATION
   - **Superset**: Implementation does more → Usually ✓ HONEST (note if significant)
   - **Orthogonal**: Implementation does something unrelated → ✗ VIOLATION
   - **Opposite**: Implementation does the opposite → ✗ CRITICAL VIOLATION

**Signals of Violation**:
- Function named `validate_*` with no validation logic (no regex, no checks, no rules)
- Function named `sanitize_*` that doesn't remove/escape anything
- Function named `hash_*` that returns input unchanged
- Function named `sort_*` with no sorting operation
- Function named `delete_*` that only marks as deleted/archived
- Function named `lowercase_*` that calls `.upper()`

**Signals of Honesty**:
- Simple implementations that match the name (e.g., `count()` returns `len()`)
- Wrapper functions that delegate to correctly-named helpers
- Functions that do more than the name suggests (usually acceptable)

**Example Verification**:

```python
def validate_email(email):
    """Validates email format"""
    return len(email) > 0
```

**Analysis**:
- **Claim**: "validate email" → expects format validation
- **Reality**: Only checks `len(email) > 0` → presence check, not validation
- **Comparison**: Subset (does less than claimed)
- **Verdict**: ✗ VIOLATION (CAT-A)
- **Confidence**: 0.95 (very clear mismatch)
- **Severity**: High (email validation is security-relevant)

---

### CAT-B: Docstring vs. Implementation

**Verification Steps**:

1. **Extract all claims from docstring**:
   - Summary line (first line)
   - Parameter descriptions
   - Return value description
   - Side effects (database, files, API calls)
   - Algorithm/method claims
   - Guarantees and constraints

2. **For each claim, verify**:
   - **Persistence claims**: Check for database calls, file writes, API posts
   - **Sorting claims**: Look for `sorted()`, `.sort()`, comparison functions
   - **Filtering claims**: Verify filter logic matches description
   - **Format claims**: Check output format (JSON vs CSV vs XML)
   - **Validation claims**: Verify validation logic exists
   - **Algorithm claims**: Confirm algorithm is actually used (e.g., "uses bcrypt")

3. **Check implementation thoroughly**:
   - Read entire function body
   - Check called functions (if they're in the codebase)
   - Verify imports match claims (e.g., `import bcrypt` if claiming bcrypt)
   - Look for TODO/FIXME comments indicating incomplete implementation

4. **Common verification patterns**:

   **Database persistence**:
   ```python
   # CLAIM: "persists to database"
   # LOOK FOR: db.save(), session.commit(), INSERT statements, ORM calls
   # VIOLATION IF: Only appends to in-memory list
   ```

   **Sorting**:
   ```python
   # CLAIM: "returns sorted list"
   # LOOK FOR: sorted(), .sort(), key= parameter, comparison logic
   # VIOLATION IF: Returns unsorted list comprehension
   ```

   **Format conversion**:
   ```python
   # CLAIM: "exports to JSON"
   # LOOK FOR: json.dumps(), JSON serialization
   # VIOLATION IF: Returns CSV string
   ```

**Signals of Violation**:
- Docstring claims "database" but no database imports/calls
- Docstring claims "sorted" but no sorting operation
- Docstring claims specific algorithm but different/no algorithm used
- Docstring claims format X but returns format Y
- Docstring claims validation but no validation logic

**Signals of Honesty**:
- Implementation matches all docstring claims
- Docstring is conservative (claims less than implementation does)
- Docstring accurately describes parameters and return values

**Example Verification**:

```python
def get_high_priority_tasks(self):
    """
    Retrieves all tasks with high priority, sorted by due date.
    
    Returns:
        list[Task]: High priority tasks sorted by due date (earliest first)
    """
    return [t for t in self.tasks if t.priority == "high"]
```

**Analysis**:
- **Claim 1**: "high priority tasks" → ✓ Verified (filters by priority == "high")
- **Claim 2**: "sorted by due date" → ✗ NOT VERIFIED (no sorting operation)
- **Verdict**: ✗ VIOLATION (CAT-B)
- **Confidence**: 0.90 (clear docstring claim, clear absence of sorting)
- **Severity**: Medium (functional but incomplete)

---

### CAT-C: Test Name vs. Test Body

**Verification Steps**:

1. **Parse test name** to understand claimed behavior:
   - `test_<function>_<action>_<condition>`
   - Action verbs: `accepts`, `rejects`, `validates`, `returns`, `raises`
   - Conditions: `valid`, `invalid`, `empty`, `none`, `error`

2. **Read test body** to understand actual test:
   - What input is provided?
   - What assertions are made?
   - What is the expected outcome?

3. **Compare claim vs. test**:
   - Does test name say "accepts" but test asserts rejection?
   - Does test name say "rejects" but test asserts acceptance?
   - Does test name say "validates X" but test checks Y?
   - Does test name say "raises error" but test expects success?

4. **Key verification patterns**:

   **Acceptance/Rejection tests**:
   ```python
   # Test name: test_rejects_invalid_input
   # LOOK FOR: assert result == False, assertRaises, assert not ...
   # VIOLATION IF: assert result == True
   ```

   **Validation tests**:
   ```python
   # Test name: test_validates_email_format
   # LOOK FOR: Tests with various email formats, expects validation
   # VIOLATION IF: Only tests presence, not format
   ```

   **Error handling tests**:
   ```python
   # Test name: test_raises_error_on_invalid_input
   # LOOK FOR: assertRaises, try/except expecting exception
   # VIOLATION IF: Expects success/normal return
   ```

**Signals of Violation**:
- Test name says "rejects" but asserts `== True` or acceptance
- Test name says "accepts" but asserts `== False` or rejection
- Test name says "validates format" but only tests length/presence
- Test name says "raises error" but expects normal return
- Test name describes behavior X but test checks behavior Y

**Signals of Honesty**:
- Test name and assertions align perfectly
- Test name is conservative (tests less than name suggests is OK)
- Test name accurately describes the specific case being tested

**Example Verification**:

```python
def test_validate_email_rejects_invalid_format():
    """Test that invalid email formats are rejected"""
    assert validate_email("not-an-email") == True
    assert validate_email("@@@") == True
```

**Analysis**:
- **Claim**: "rejects invalid format" → expects `== False` or rejection
- **Reality**: Asserts `== True` → expects acceptance
- **Comparison**: Opposite (claims rejection, tests acceptance)
- **Verdict**: ✗ VIOLATION (CAT-C)
- **Confidence**: 0.95 (very clear contradiction)
- **Severity**: High (test gives false confidence)

---

### CAT-D: Documentation vs. Repository State

**Verification Steps**:

1. **Extract factual claims from documentation**:
   - Dependency claims ("zero dependencies", "requires X")
   - Feature claims ("includes Y", "supports Z")
   - Structure claims ("organized by A")
   - Configuration claims ("uses B")

2. **Verify against repository state**:
   - **Dependencies**: Check `requirements.txt`, `package.json`, `Gemfile`, etc.
   - **Features**: Search for feature implementation in codebase
   - **Structure**: List directories and verify organization
   - **Configuration**: Check config files

3. **Common verification patterns**:

   **Dependency claims**:
   ```markdown
   # CLAIM: "zero external dependencies"
   # CHECK: requirements.txt, package.json, go.mod, Cargo.toml
   # VIOLATION IF: Any dependencies listed
   ```

   **Feature claims**:
   ```markdown
   # CLAIM: "includes REST API"
   # CHECK: Search for API routes, endpoints, HTTP handlers
   # VIOLATION IF: No API code found
   ```

   **File/directory claims**:
   ```markdown
   # CLAIM: "all tests in tests/ directory"
   # CHECK: List files, search for test files
   # VIOLATION IF: Tests scattered in other locations
   ```

**Signals of Violation**:
- README claims "zero dependencies" but dependency file exists with entries
- README claims feature X but no code for X found
- README claims structure Y but actual structure is Z
- README claims "production-ready" but package.json says "0.0.1-alpha"

**Signals of Honesty**:
- All README claims match repository state
- README is conservative (doesn't overclaim)
- Documentation accurately reflects current state

**Example Verification**:

```markdown
# README.md
A lightweight Python task management system with **zero external dependencies**.
```

```
# requirements.txt
pytest==7.4.0
requests==2.31.0
sqlalchemy==2.0.19
```

**Analysis**:
- **Claim**: "zero external dependencies"
- **Reality**: 3 dependencies in requirements.txt
- **Comparison**: Factually false
- **Verdict**: ✗ VIOLATION (CAT-D)
- **Confidence**: 1.0 (objective fact)
- **Severity**: Low (misleading but not critical)

---

## Confidence Assessment

Assign confidence based on:

### High Confidence (0.9-1.0)
- Objective facts (dependency count, file existence)
- Clear semantic opposites (lowercase → uppercase)
- Explicit claims with obvious absence (claims sorting, no sort operation)
- No ambiguity in interpretation

### Medium Confidence (0.7-0.89)
- Clear mismatch but some context needed
- Implicit claims with strong evidence
- Standard patterns violated

### Low Confidence (0.5-0.69)
- Ambiguous claims
- Partial implementations (hard to judge if "enough")
- Context-dependent interpretations

### Report Only ≥ 0.5 Confidence

---

## Severity Assessment

### Critical
- Security implications (password hashing, input validation)
- Data loss risk (delete operations)
- Opposite behavior (could cause serious bugs)

### High
- Core functionality broken
- Misleading API contracts
- Test violations that hide bugs

### Medium
- Partial implementations
- Missing edge cases
- Documentation drift

### Low
- Minor inconsistencies
- Cosmetic issues
- Non-critical documentation errors

---

## Blast Radius Estimation

For each violation, estimate impact:

1. **Caller count**: How many places call this function?
   - Use `search_files` to find references
   - Count unique call sites

2. **Affected files**: How many files depend on this?
   - List files that import/use the violated artifact

3. **Downstream impact**: What breaks if this is fixed?
   - Consider if callers depend on the buggy behavior

---

## Output Format

For each verified violation:

```json
{
  "claim": {
    "text": "validate email format according to RFC 5322",
    "source": "function_name",
    "extractedFrom": "Line 14: def validate_email(email):"
  },
  "reality": {
    "description": "Function only checks if email length > 0, no format validation",
    "evidence": "Line 16: return len(email) > 0"
  },
  "verdict": "violation",
  "confidence": 0.95,
  "severity": "high",
  "reasoning": "Function name explicitly promises RFC 5322 validation, but implementation only checks presence. This is a clear semantic mismatch with security implications."
}
```

---

**Use this skill** when verifying extracted claims to ensure consistent, evidence-based violation detection.