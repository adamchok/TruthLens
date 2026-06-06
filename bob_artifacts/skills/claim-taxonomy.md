# Claim Taxonomy Skill

This skill defines what constitutes a "claim" in each category and how to extract claims from code artifacts.

## Overview

A **claim** is any statement (explicit or implicit) about what code does, how it behaves, or what properties it has. Claims can be:
- **Explicit**: Written in documentation, docstrings, comments
- **Implicit**: Conveyed through naming, structure, conventions

## Category Definitions

### CAT-A: Function/Method Name vs. Behavior

**What is being inspected**: Function and method identifiers

**What constitutes the claim**: The semantic meaning conveyed by the function/method name

**Claim extraction rules**:
1. Parse the identifier into semantic components (e.g., `validate_email` → "validate" + "email")
2. Interpret action verbs: `validate`, `sanitize`, `hash`, `sort`, `filter`, `delete`, `export`, etc.
3. Interpret object nouns: `email`, `password`, `user`, `task`, etc.
4. Interpret qualifiers: `high_priority`, `completed`, `valid`, etc.

**Evidence location**: Function/method body implementation

**Common violation patterns**:
- **Opposite behavior**: `lowercase()` returns uppercase
- **Missing core logic**: `validate_email()` with no validation
- **Partial implementation**: `sort_by_date()` that doesn't sort
- **Wrong operation**: `delete_tasks()` that archives instead

**Examples**:

✓ **HONEST**:
```python
def count_items(items):
    return len(items)  # Name matches behavior
```

✗ **VIOLATION**:
```python
def validate_email(email):
    return len(email) > 0  # Claims validation, only checks presence
```

---

### CAT-B: Docstring vs. Implementation

**What is being inspected**: Function/method/class docstrings

**What constitutes the claim**: Any factual statement about behavior, parameters, return values, side effects, or guarantees

**Claim extraction rules**:
1. **Summary line**: First line of docstring (most important claim)
2. **Parameter descriptions**: What each parameter does/expects
3. **Return value description**: What is returned and its properties
4. **Side effects**: Database writes, file operations, API calls, state changes
5. **Guarantees**: "always", "never", "ensures", "validates", "checks"
6. **Algorithm claims**: "sorted by", "filtered by", "using bcrypt", etc.

**Evidence location**: Function/method body, called functions, imported modules

**Common violation patterns**:
- **Claimed persistence without implementation**: "saves to database" but only in-memory
- **Claimed sorting without sorting**: "returns sorted list" but no sort operation
- **Claimed validation without checks**: "validates format" but no validation logic
- **Wrong format**: "returns JSON" but returns CSV
- **Missing operations**: "deletes records" but only marks as deleted

**Examples**:

✓ **HONEST**:
```python
def filter_by_priority(tasks, priority):
    """Filters tasks by the specified priority level."""
    return [t for t in tasks if t.priority == priority]
```

✗ **VIOLATION**:
```python
def create_task(title, priority):
    """Creates a new task and persists it to the database."""
    task = Task(title, priority)
    self.tasks.append(task)  # Only in-memory, no database!
    return task
```

---

### CAT-C: Test Name vs. Test Body

**What is being inspected**: Test function names (functions starting with `test_` or decorated with `@test`)

**What constitutes the claim**: The assertion or behavior being tested, as conveyed by the test name

**Claim extraction rules**:
1. Parse test name into components: `test_<function>_<behavior>_<condition>`
2. Identify assertion verbs: `accepts`, `rejects`, `validates`, `returns`, `raises`, `handles`
3. Identify expected outcomes: `valid`, `invalid`, `error`, `success`, `empty`, `none`
4. Interpret negations: `not`, `no`, `without`, `missing`

**Evidence location**: Test body assertions (`assert`, `assertEqual`, `assertRaises`, etc.)

**Common violation patterns**:
- **Opposite assertion**: Test name says "rejects" but asserts acceptance
- **Wrong behavior tested**: Test name says "validates format" but tests length
- **Missing assertions**: Test name claims check but no relevant assertion
- **Inverted logic**: Test name says "accepts valid" but tests invalid input

**Examples**:

✓ **HONEST**:
```python
def test_validate_email_accepts_valid_format():
    """Test name claims acceptance of valid format"""
    assert validate_email("user@example.com") == True  # Matches claim
```

✗ **VIOLATION**:
```python
def test_validate_email_rejects_invalid_format():
    """Test name claims rejection of invalid format"""
    assert validate_email("not-an-email") == True  # Asserts acceptance!
```

---

### CAT-D: Documentation vs. Repository State

**What is being inspected**: README.md, CHANGELOG.md, docs/, package.json, setup.py, etc.

**What constitutes the claim**: Factual statements about:
- Dependencies ("zero dependencies", "requires X")
- Features ("supports Y", "includes Z")
- File structure ("contains A", "organized as B")
- Configuration ("uses C", "configured for D")
- Status ("stable", "production-ready", "deprecated")

**Claim extraction rules**:
1. Identify factual assertions (not marketing language)
2. Focus on verifiable statements
3. Look for quantifiers: "zero", "all", "no", "every", "only"
4. Check feature lists, installation instructions, architecture descriptions

**Evidence location**: Actual files, directories, dependencies, configuration files

**Common violation patterns**:
- **Dependency claims**: "zero dependencies" but requirements.txt/package.json exists
- **Feature claims**: "includes API" but no API code found
- **Structure claims**: "organized by feature" but organized by type
- **Status claims**: "production-ready" but marked as alpha in package.json

**Examples**:

✓ **HONEST**:
```markdown
# MyProject
A Python tool with minimal dependencies (pytest for testing).
```
```
# requirements.txt
pytest==7.4.0
```

✗ **VIOLATION**:
```markdown
# MyProject
A lightweight Python tool with **zero external dependencies**.
```
```
# requirements.txt
pytest==7.4.0
requests==2.31.0
sqlalchemy==2.0.19
```

---

## Claim Strength Indicators

### Strong Claims (High Confidence)
- Specific verbs: "validates", "hashes", "sorts", "deletes"
- Quantifiers: "all", "every", "always", "never", "zero"
- Technical terms: "bcrypt", "RFC 5322", "ISO 8601", "JSON"
- Guarantees: "ensures", "guarantees", "must", "will"

### Weak Claims (Lower Confidence)
- Vague verbs: "handles", "processes", "manages"
- Qualifiers: "usually", "typically", "may", "might"
- General terms: "data", "information", "stuff"
- Suggestions: "should", "could", "recommended"

## Extraction Process

For each file:

1. **Identify claim-bearing artifacts**:
   - Functions/methods (CAT-A, CAT-B)
   - Test functions (CAT-C)
   - Documentation files (CAT-D)

2. **Extract claims**:
   - Read the artifact
   - Parse semantic meaning
   - Document exact claim text and location

3. **Categorize**:
   - Assign to CAT-A, CAT-B, CAT-C, or CAT-D
   - Note if multiple categories apply (e.g., function name AND docstring both lie)

4. **Prepare for verification**:
   - Identify where evidence should be found
   - Note what would prove or disprove the claim

## Edge Cases

### When NOT to extract a claim:

- **Marketing language**: "best-in-class", "revolutionary", "amazing"
- **Subjective statements**: "easy to use", "intuitive", "clean"
- **Future intentions**: "will support", "planned feature", "coming soon"
- **Obvious truths**: "written in Python" (when file is .py)
- **Tautologies**: "this function is a function"

### When to extract despite ambiguity:

- **Implicit contracts**: Function named `save_user` implies persistence
- **Convention-based claims**: `test_*` implies testing behavior
- **Standard patterns**: `validate_*` implies validation logic

## Output Format

For each extracted claim, document:

```json
{
  "text": "validate email format according to RFC 5322",
  "source": "function_name" | "docstring" | "test_name" | "readme",
  "extractedFrom": "Line 14: def validate_email(email):",
  "category": "CAT-A",
  "strength": "strong" | "weak",
  "components": {
    "action": "validate",
    "object": "email",
    "qualifier": "RFC 5322 format"
  }
}
```

---

**Use this skill** when analyzing code to ensure consistent claim extraction across all categories.