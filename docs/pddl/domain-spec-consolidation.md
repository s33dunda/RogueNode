# Domain Spec Consolidation

**Date**: 2025-10-03
**Status**: ✅ Complete (Updated with PDDL separation)

## Summary

Consolidated domain specification schemas to use `convex/domainSpec/` as the single source of truth for runtime imports, with PDDL artifacts separated into `pddl/` directory.

## Motivation

Previously, we maintained duplicate domain schemas:

- `packages/domain-spec/schema.ts` - Original source
- `convex/domainSpec/schema.ts` - Synced copy for Convex runtime

This created:

- **Duplication risk**: Two identical files that could drift out of sync
- **Sync overhead**: Required `pnpm sync:domain` script to copy files
- **Confusion**: Unclear which was the canonical source

## Changes Made

### 1. Made `convex/domainSpec/` Canonical

Updated `convex/domainSpec/schema.ts` header to clarify it's the canonical source:

```typescript
/**
 * RogueNode MVP domain schema - CANONICAL SOURCE
 * -----------------------------------------------
 *
 * This is the single source of truth for domain entity schemas.
 */
```

### 2. Updated Scripts

**`scripts/generate-pddl-llm.mjs`**:

- Changed default context files from `packages/domain-spec/` to `convex/domainSpec/`

**`scripts/run-planning.mjs`**:

- Updated generated problems/domains directories to `convex/domainSpec/pddl/`
- Updated default PDDL output paths to `convex/domainSpec/pddl/`

### 3. Removed Sync Script

**`package.json`**:

- Removed `sync:domain` script (no longer needed)
- Removed `sync:domain` from `predev` hook
- Removed `sync:domain` from `planning:refresh` workflow

### 4. Deleted Duplicate Directory

Removed `packages/domain-spec/` entirely, including:

- `schema.ts`
- `data.ts`
- `runtime.ts`
- `planning.ts`
- `generated/` artifacts

### 5. Separated PDDL Artifacts

**Created `pddl/` directory** for PDDL artifacts that are NOT imported by Convex:

- `pddl/planning.ts` - PDDL configuration for LLM prompts
- `pddl/generated/domains/*.pddl` - PDDL domain files (used by Python planner)
- `pddl/generated/problems/*/problem.pddl` - PDDL problem files (used by Python planner)

**Kept in `convex/domainSpec/`** only what Convex imports:

- `schema.ts`, `data.ts`, `runtime.ts` - TypeScript source files
- `pddl/problems/*/plan.json` - Planner output (imported by data.ts)

**Rationale**: The `.pddl` files are intermediate artifacts used only by external Python scripts. Keeping them out of `convex/` prevents unnecessary bundling.

### 6. Updated Documentation

Updated `convex/domainSpec/index.ts` and created `pddl/README.md` to clarify separation.

## Benefits

1. **Single Source of Truth**: No more duplication or sync drift
2. **Simpler Workflow**: No sync step required
3. **Clearer Architecture**: Convex backend owns domain specs
4. **Easier Maintenance**: One place to update schemas

## Migration Guide

### For Developers

If you were importing from `packages/domain-spec/`:

```typescript
// ❌ Old (no longer exists)
import { roomSchema } from '../packages/domain-spec/schema';

// ✅ New (canonical source)
import { roomSchema } from '../convex/domainSpec/schema';
```

### For Scripts

Scripts now read directly from `convex/domainSpec/`:

```javascript
// ❌ Old
const defaultContextFiles = [
  "packages/domain-spec/schema.ts",
];

// ✅ New
const defaultContextFiles = [
  "convex/domainSpec/schema.ts",
];
```

### For Planning Workflow

The planning workflow is now simpler:

```bash
# ❌ Old workflow
pnpm planning:refresh  # Generated PDDL + synced to convex/

# ✅ New workflow
pnpm planning:refresh  # Generates PDDL directly in convex/domainSpec/ and pddl/
```

## Verification

To verify the consolidation:

1. **Check imports**: No references to `packages/domain-spec` in code

   ```bash
   rg "packages/domain-spec" --type ts --type tsx --type js --type mjs
   ```

2. **Check scripts**: Scripts reference `convex/domainSpec/`

   ```bash
   grep -r "convex/domainSpec" scripts/
   ```

3. **Run planning**: Verify PDDL generation works

   ```bash
   pnpm planning:refresh
   ```

4. **Run dev**: Verify no sync errors

   ```bash
   pnpm dev
   ```

## Related Documentation

- `convex/domainSpec/schema.ts` - Canonical domain schemas
- `convex/domainSpec/index.ts` - Directory overview
- `docs/ssot/README.md` - Single Source of Truth architecture (needs update)
- `docs/ssot/planning-workflow.md` - Planning workflow (needs update)

## Next Steps

Update documentation that still references `packages/domain-spec/`:

- [ ] `docs/ssot/README.md`
- [ ] `docs/ssot/planning-workflow.md`
- [ ] `docs/pddl-integration-*.md` files
- [ ] `docs/prompts/planning-domain.md`
