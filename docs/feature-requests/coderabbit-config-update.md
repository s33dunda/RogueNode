---
ssot-area: tooling
owner: runtime-team
derived-from: .coderabbit.yaml
---

# CodeRabbit Configuration Update

**Date**: 2025-10-03
**Status**: ✅ Complete
**Related**: PDDL Integration Implementation

---

## Summary

Updated `.coderabbit.yaml` to reflect current RogueNode architecture including PDDL integration, backend consolidation, and packages structure.

---

## Key Changes

### 1. Updated Project Description

**Before**: "PoC/MVP Mode - DevOps Adventure Game + Visual Service Topology Manager"

**After**: "POV Mode - DevOps Adventure Game with PDDL-Driven Mission System"

**Rationale**: Focus on PDDL integration as core feature, removed topology manager (not in current scope)

---

### 2. Enhanced Tone Instructions

**Added**:

- PDDL integration validation
- Backend consolidation patterns
- No backwards compatibility (POV mode)
- Clean architecture over legacy support

**Removed**:

- References to rapid prototyping
- Permissive code style guidance

---

### 3. New Labels

Added labels for current architecture:

- **`pddl-integration`** - PDDL planner, mission validation, plan generation
- **`domain-spec`** - Changes to packages/domain-spec
- **`architecture`** - Structural changes, backend consolidation, migrations

Removed:

- `topology-visual` (not in current scope)
- `devops-education` (merged into game-mechanics)

---

### 4. Updated Path Filters

**Added**:

```yaml
- "packages/**"  # Include domain-spec package AND generated artifacts
- "*.pddl"       # Include PDDL files
```

**Changed**:

```yaml
# Only exclude Convex runtime codegen
- "!convex/_generated/**"

# Include domain-spec generated/ (committed source files, not runtime codegen)
# These are reviewed because they're committed to VCS
```

**Removed**:

```yaml
- "utils/**"  # No longer needed (moved to convex/)
```

**Rationale**: domain-spec generated files are committed source artifacts (like compiled PDDL plans), not runtime codegen like Convex's _generated/. They should be reviewed for correctness.

---

### 5. New Path-Specific Instructions

#### `convex/gameData.ts` (New)

- Verify imports from packages/domain-spec/runtime
- Ensure single source of truth
- Backend-only module validation

#### `packages/domain-spec/**` (New)

- Validate schema.ts for game entities
- Check data.ts for mission definitions
- Verify runtime.ts helper functions
- Review generated/ artifacts (committed source files)
- Validate PDDL syntax
- Ensure generated artifacts match source data

#### `packages/domain-spec/generated/**` (New)

- Verify PDDL domain/problem files are syntactically correct
- Check plan.json contains valid action sequences
- Flag if out of sync with data.ts
- These are committed source files, not runtime codegen

#### `convex/missions.ts` (New)

- PDDL plan validation logic
- Mission progress tracking
- Skill point awards
- Type safety with validators

---

### 6. Enhanced Custom Checks

**New Checks**:

1. **Backend Consolidation** (error)
   - Ensure imports from convex/gameData.ts
   - Verify single source of truth from runtime

2. **PDDL Integration** (warning)
   - Validate mission definitions
   - Check PDDL domain/problem syntax

3. **No Dead Code** (error)
   - POV mode: Remove deprecated files immediately
   - No backwards compatibility layers

4. **Documentation Standards** (warning)
   - YAML front-matter required
   - No references to removed files

**Updated Checks**:

- **Convex Function Standards**: Now error (was warning), no v.any() allowed
- **Game State Integrity**: Added PDDL plan validation

---

### 7. Knowledge Base Updates

**Added File Patterns**:

```yaml
- ".augment/rules/**/*.md"
- "packages/domain-spec/README.md"
```

**Purpose**: Include project-specific guidelines and domain-spec documentation

---

### 8. Code Generation Updates

#### Docstrings

- Added PDDL integration notes
- Internal vs public function distinction
- Mission validation logic documentation

#### Unit Tests

- Mission validation test cases
- PDDL plan checking tests
- Runtime utility tests
- Storage architecture tests

---

## Review Focus Areas

### Critical (Error Level)

1. **Security**: No hardcoded secrets, proper Clerk auth
2. **Convex Standards**: New syntax, validators, no v.any()
3. **Backend Consolidation**: Correct import paths
4. **No Dead Code**: Remove deprecated files immediately

### Important (Warning Level)

1. **PDDL Integration**: Mission definitions, plan validation
2. **Game State Integrity**: Command validation against plans
3. **Documentation**: YAML front-matter, no dead references
4. **Type Safety**: Proper TypeScript usage

---

## Path-Specific Review Matrix

| Path | Focus | Level |
|------|-------|-------|
| `convex/**` | Auth, validators, internal/public separation | Critical |
| `convex/gameData.ts` | Single source of truth, backend-only | Critical |
| `convex/missions.ts` | PDDL validation, progress tracking | Important |
| `packages/domain-spec/**` | Schema, runtime, PDDL syntax | Important |
| `components/**` | Mission feedback, command integration | Normal |
| `docs/**` | YAML front-matter, no dead references | Important |
| `**/*.test.*` | Mission validation, PDDL integration | Normal |

---

## Excluded Paths

```yaml
!dist/**
!node_modules/**
!.next/**
!coverage/**
!convex/_generated/**  # Runtime codegen only
```

**Rationale**: Only runtime-generated code is excluded. PDDL artifacts in `packages/domain-spec/generated/` are committed source files and should be reviewed.

**Key Distinction**:

- `convex/_generated/` = Runtime codegen (excluded)
- `packages/domain-spec/generated/` = Committed PDDL artifacts (included)

---

## Label Application Guide

### When to Use Each Label

- **`security`**: Auth changes, secrets, game state integrity
- **`game-mechanics`**: Command parsing, inventory, navigation
- **`pddl-integration`**: Mission validation, plan generation
- **`convex-backend`**: Schema, queries, mutations, actions
- **`domain-spec`**: packages/domain-spec changes
- **`architecture`**: File migrations, structural refactoring
- **`documentation`**: Docs with YAML front-matter
- **`breaking`**: Schema changes, API changes (no backwards compat)

---

## Testing Expectations

### Required Test Coverage

1. **Mission Validation**: PDDL plan checking
2. **Progress Tracking**: Database operations
3. **Security**: Auth scenarios
4. **Storage Architecture**: File storage tests

### Test Generation

CodeRabbit will suggest tests for:

- Convex mission functions
- Runtime utilities
- Component mission feedback
- PDDL integration flows

---

## Documentation Standards

### Required Front-Matter

All `docs/**/*.md` files must include:

```yaml
---
ssot-area: <area>
owner: <team>
derived-from: <source>
---
```

### Validation

CodeRabbit will flag:

- Missing front-matter
- References to removed files (e.g., utils/GameData.ts)
- Incomplete migration guides

---

## POV Mode Philosophy

**Key Principles**:

1. **No Backwards Compatibility**: Remove old code immediately
2. **Clean Architecture**: Single source of truth
3. **VCS as Safety Net**: Git history provides rollback
4. **Fast Iteration**: No legacy support burden

**CodeRabbit Enforcement**:

- Error on dead code
- Error on incorrect import paths
- Warning on missing documentation
- Focus on clean patterns over legacy support

---

## Migration from Old Config

### Removed Concepts

- ❌ Visual topology manager references
- ❌ utils/ path instructions
- ❌ Permissive "any is OK" guidance
- ❌ Backwards compatibility considerations

### Added Concepts

- ✅ PDDL integration validation
- ✅ Backend consolidation patterns
- ✅ packages/ structure support
- ✅ POV mode philosophy
- ✅ No dead code enforcement

---

## Next Steps

### For Developers

1. Review updated custom checks (especially error-level)
2. Ensure imports use convex/gameData.ts
3. Add YAML front-matter to new docs
4. Write tests for mission validation

### For Reviewers

1. Use new labels (pddl-integration, domain-spec, architecture)
2. Focus on critical checks (security, backend consolidation)
3. Validate PDDL integration patterns
4. Ensure no dead code in PRs

---

## Verification

**Config Status**: ✅ Valid YAML
**Schema**: ✅ Matches coderabbit.ai/integrations/schema.v2.json
**Coverage**: ✅ All current paths included
**Exclusions**: ✅ Generated files excluded

---

## Related Documentation

- **PDDL Integration**: `docs/pddl-integration-complete.md`
- **Backend Migration**: `docs/pddl-integration-gamedata-migration.md`
- **Project Guidelines**: `.augment/rules/CLAUDE.md`

---

**Summary**: CodeRabbit configuration updated to reflect PDDL integration, backend consolidation, and POV mode philosophy. Focus on clean architecture, no dead code, and proper validation patterns.
