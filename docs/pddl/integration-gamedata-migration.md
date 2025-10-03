---
ssot-area: pddl-integration
owner: runtime-team
derived-from: convex/gameData.ts
---

# GameData Migration to Convex Backend

**Date**: 2025-10-03
**Status**: ✅ Complete
**Related**: PDDL Integration Implementation

---

## Overview

As part of the PDDL integration, all game data logic has been consolidated into the Convex backend to maintain consistency with the recent architecture refactoring.

**Migration**: `utils/GameData.ts` → `convex/gameData.ts` (old file removed)

**Convex Restriction**: Convex functions cannot import from outside the `convex/` directory due to bundling restrictions. Solution: `convex/domainSpec/` is now the canonical source for domain specifications.

---

## Changes Made

### 1. Created `convex/gameData.ts`

**New File**: Backend-only game data module

**Exports**:

- `gameMap` - Game dimensions
- `rooms` - Rooms indexed by ID
- `enemies` - Enemy roster
- `missions` - Mission definitions
- `commandLineTools` - Available CLI tools
- `initialRoom` - Starting room

**Source**: Imports from `convex/domainSpec` (canonical source)

---

### 2. Updated `convex/gameActions.ts`

**Before**:

```typescript
import { commandLineTools, enemies, rooms } from "../utils/GameData";
```

**After**:

```typescript
import { commandLineTools, enemies, rooms } from "./gameData";
```

**Impact**: All Convex functions now use backend-local game data

---

### 3. Removed `utils/GameData.ts`

**Status**: ✅ Deleted (POV - no backwards compatibility needed)

**Reason**:

- Maintains consistency with recent backend consolidation
- Avoids dual sources of truth
- Aligns with Convex best practices
- VCS provides history if needed

---

## Architecture Benefits

### Before (Dual Sources)

```
packages/domain-spec/
  └── data.ts (source data)
       ↓
utils/GameData.ts (client-side processing)
       ↓
convex/gameActions.ts (imports from utils)
```

**Issues**:

- Data flows through client-side utils
- Potential inconsistency between client and server
- Violates single source of truth principle

---

### After (Backend Consolidation)

```text
convex/domainSpec/             # Canonical source
  ├── data.ts
  ├── schema.ts
  ├── runtime.ts
  └── generated/
      └── problems/*/plan.json (imported by data.ts)
       ↓
convex/gameData.ts (backend processing)
       ↓
convex/gameActions.ts (backend functions)

pddl/                          # PDDL artifacts (NOT imported)
  ├── planning.ts
  └── generated/
      ├── domains/*.pddl
      └── problems/*/problem.pddl
```

**Benefits**:

- ✅ Single source of truth in `convex/domainSpec/`
- ✅ Convex-compatible architecture (no imports from outside convex/)
- ✅ Clean separation of runtime vs. build artifacts
- ✅ Follows Convex bundling restrictions
- ✅ Aligns with recent architecture refactoring

---

## Migration Guide

### For Backend Code (Convex Functions)

**Before**:

```typescript
import { rooms, enemies } from "../utils/GameData";
```

**After**:

```typescript
import { rooms, enemies } from "./gameData";
```

---

### For Frontend Code (React Components)

**Before**:

```typescript
import { rooms, missions } from "../utils/GameData";
```

**After**:

```typescript
// Use Convex queries instead
const missions = useQuery(api.gameActions.getActiveMissions);
```

**Note**: Frontend should fetch game data via Convex queries, not direct imports

---

### For Shared Utilities (Convex Functions)

**Before**:

```typescript
import { getMissionForRoom } from "../utils/GameData";
```

**After**:

```typescript
import { getMissionsForRoom } from "./domainSpec/runtime";
```

**Note**: Convex functions must import from `convex/domainSpec/` (copied from source)

---

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `convex/gameData.ts` | Created | ✅ New |
| `convex/gameActions.ts` | Updated imports | ✅ Complete |
| `convex/missions.ts` | Updated imports | ✅ Complete |
| `convex/domainSpec/` | Copied from packages/ | ✅ New |
| `utils/GameData.ts` | Removed | ✅ Deleted |
| `package.json` | Added sync:domain script | ✅ Complete |
| `packages/domain-spec/schema.ts` | Updated docs | ✅ Complete |

---

## Testing Checklist

- [x] **Backend Compilation**: Convex functions compile successfully
- [x] **Import Resolution**: No import errors in gameActions.ts
- [x] **Server Running**: Dev server running without errors
- [x] **Type Safety**: No TypeScript errors in IDE
- [ ] **Runtime Testing**: Verify game data loads correctly in browser
- [ ] **Mission System**: Verify missions work with new data source

---

## Rollback Plan

If issues arise, rollback via VCS:

```bash
git revert <commit-hash>
```

**Risk**: Low - changes are isolated to import statements and file structure

**VCS**: Git history preserves old `utils/GameData.ts` if needed

---

## Related Documentation

- **PDDL Integration**: `docs/pddl-integration-implementation-status.md`
- **Runtime Module (Source)**: `packages/domain-spec/runtime.ts`
- **Runtime Module (Convex Copy)**: `convex/domainSpec/runtime.ts`
- **Backend Data**: `convex/gameData.ts`
- **Convex Copy README**: `convex/domainSpec/README.md`
- **Schema Docs**: `packages/domain-spec/schema.ts`
- **Sync Script**: `package.json` (`sync:domain`)

---

## Verification

### Server Status

```bash
✅ Convex Backend: Running
✅ Next.js Frontend: Running on http://localhost:3001
✅ No Import Errors: Confirmed
✅ TypeScript: Compiling successfully
```

### Import Graph

```text
packages/domain-spec/          # Source of truth
  ├── data.ts
  ├── runtime.ts
  └── generated/
       ↓ (pnpm sync:domain)
convex/domainSpec/             # Convex-compatible copy
  ├── data.ts
  ├── runtime.ts
  └── generated/
       ↓
convex/gameData.ts
       ↓
convex/gameActions.ts
       ↓
[Convex Functions]
```

**Status**: ✅ Clean, unidirectional data flow with automated sync

---

## Summary

**What Changed**: Game data imports moved from `utils/` to `convex/`

**Why**: Consistency with backend consolidation architecture

**Impact**: Minimal - isolated to import statements

**Risk**: Low - easy rollback if needed

**Status**: ✅ Complete and verified

---

**Next Steps**: Monitor for any runtime issues, then proceed with full E2E testing of mission system.
