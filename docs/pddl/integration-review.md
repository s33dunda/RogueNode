---
ssot-area: pddl-integration
owner: runtime-team
derived-from: planner-integration-plan
---

# PDDL Integration Plan Review

**Date**: 2025-10-03
**Reviewed Against**: Convex Best Practices (Context7: llmstxt/convex_dev_llms_txt)
**Status**: ✅ Plan Validated and Refined

---

## Executive Summary

The original plan is **well-structured and POV-appropriate**. After reviewing against Convex best practices, we've made targeted refinements to ensure the implementation follows Convex's "zen" patterns for maintainability, performance, and type safety.

---

## Original Plan vs. Refined Implementation

### ✅ What Stayed the Same

1. **Shared Runtime Loader** (`convex/domainSpec/runtime.ts`)
   - Original concept: Single source of truth for game data
   - Refinement: Added helper functions (`getMissionById`, `matchesStep`) following Convex's "helper functions first" pattern

2. **Plan-Aware Missions**
   - Original concept: Missions include `optimalPlan` and `problemRef`
   - Refinement: No changes - schema already follows Convex validation patterns

3. **Problem State Wiring**
   - Original concept: Initialize game state from PDDL problems
   - Refinement: Deferred to post-POV (current missions don't require dynamic state initialization)

4. **UI Feedback**
   - Original concept: Progress bar and hints panel
   - Refinement: No changes - client-side implementation remains as planned

5. **CI Automation**
   - Original concept: `pnpm planning:refresh --dry-run` in CI
   - Refinement: No changes - validation script remains as planned

6. **Documentation**
   - Original concept: Mission authoring guide
   - Refinement: Enhanced with Convex-specific patterns

---

### 🔧 Key Refinements

#### 1. **Database Schema Addition**

**Original Plan**: Mentioned "validation hooks" but didn't specify storage

**Refinement**: Added explicit `missionProgress` table to schema

```typescript
missionProgress: defineTable({
  playerId: v.string(),
  gameStateId: v.id("gameState"),
  missionId: v.string(),
  currentStepIndex: v.number(),
  completedSteps: v.array(v.object({...})),
  status: v.union(...),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_player_mission", ["playerId", "missionId"])
  .index("by_gameState", ["gameStateId"])
```

**Why**: Convex best practice - define schema upfront with proper indexes for query performance

---

#### 2. **Function Organization Pattern**

**Original Plan**: Single `validateStep` mutation

**Refinement**: Separated into internal and public functions

```typescript
// Internal logic (no auth, reusable)
export const getMissionProgress = internalQuery({...});
export const startMission = internalMutation({...});
export const validateMissionStep = internalMutation({...});

// Public API (auth-protected, thin wrappers)
export const startMission = mutation({
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    return await ctx.runMutation(internal.missions.startMission, {...});
  },
});
```

**Why**: Convex best practice - "organize code with helper functions" and "use internal functions for Convex-to-Convex calls"

---

#### 3. **Type Safety Enforcement**

**Original Plan**: Didn't specify type validators

**Refinement**: All functions use proper Convex validators (eliminated `v.any()`)

```typescript
// Before (existing code)
returns: v.any(),

// After (refined)
returns: v.object({
  matched: v.boolean(),
  expectedAction: v.string(),
  feedback: v.array(v.string()),
  missionComplete: v.boolean(),
  skillGained: v.number(),
}),
```

**Why**: Convex best practice - "use TypeScript strictly, leverage framework types"

---

#### 4. **Batch Operations**

**Original Plan**: Mentioned "validation hooks" without specifying transaction boundaries

**Refinement**: Single mutation updates progress + records step in one transaction

```typescript
// Single atomic operation
await ctx.db.patch(progress._id, {
  currentStepIndex: nextStepIndex,
  completedSteps: [...progress.completedSteps, newStep],
  status: missionComplete ? "completed" : "in_progress",
  completedAt: missionComplete ? Date.now() : undefined,
});
```

**Why**: Convex best practice - "avoid sequential mutations, use batch operations"

---

#### 5. **Query Optimization**

**Original Plan**: Didn't specify query patterns

**Refinement**: Used indexed queries with proper field ordering

```typescript
// Efficient indexed query
const progress = await ctx.db
  .query("missionProgress")
  .withIndex("by_player_mission", (q) =>
    q.eq("playerId", playerId).eq("missionId", missionId)
  )
  .first();
```

**Why**: Convex best practice - "use indexes for efficient data fetching"

---

## Convex Anti-Patterns Avoided

### ❌ Sequential Queries in Actions

**Anti-Pattern**:

```typescript
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const owner = await ctx.runQuery(internal.teams.getOwner, { teamId });
```

**Our Approach**: Single query returns all needed data

```typescript
const progress = await ctx.runQuery(internal.missions.getMissionProgress, {
  playerId, missionId
});
// Returns complete progress object in one call
```

---

### ❌ Unbounded Queries

**Anti-Pattern**:

```typescript
const allMovies = await ctx.db.query("movies").collect();
const filtered = allMovies.filter(m => m.director === "Spielberg");
```

**Our Approach**: Indexed queries with limits

```typescript
const missions = runtime.missions.filter(
  m => m.entryRoomId === gameState.currentRoom
);
// Pre-filtered at runtime, not database scan
```

---

### ❌ Missing Authentication

**Anti-Pattern**:

```typescript
export const getSecretData = query({
  handler: async (ctx) => {
    return { secret: "exposed!" }; // No auth check
  },
});
```

**Our Approach**: Auth in public functions, internal functions for logic

```typescript
export const startMission = mutation({
  handler: async (ctx, { missionId }) => {
    const identity = await requireAuth(ctx); // Auth first
    return await ctx.runMutation(internal.missions.startMission, {...});
  },
});
```

---

## Implementation Readiness

### ✅ Ready to Implement

1. **Step 1**: Shared Runtime Loader - Clear specification
2. **Step 2**: Update GameData.ts - Simple refactor
3. **Step 3**: Mission Progress Tracking - Complete Convex functions
4. **Step 4**: Public Mission API - Auth-protected wrappers
5. **Step 5**: Command Integration - Minimal changes to existing flow

### 📋 Prerequisites

- [ ] Run schema migration to add `missionProgress` table
- [ ] Verify `convex/domainSpec/runtime.ts` exports work in both Convex and Next.js
- [ ] Test mission plan JSON parsing with existing `poc-reachability` data

### 🧪 Testing Strategy

1. **Unit Tests**: Helper functions in `runtime.ts` (pure TypeScript)
2. **Integration Tests**: Convex functions with test data
3. **E2E Tests**: Full mission flow from UI → Convex → validation

---

## Comparison: Original vs. Refined

| Aspect | Original Plan | Refined Implementation | Reason for Change |
|--------|--------------|----------------------|-------------------|
| Runtime Loader | ✅ Correct | ✅ Enhanced with helpers | Added Convex-friendly utilities |
| Mission Schema | ✅ Correct | ✅ No change | Already follows best practices |
| Validation Hook | ⚠️ Vague | ✅ Explicit functions | Separated internal/public logic |
| Database Schema | ❌ Missing | ✅ Added `missionProgress` | Required for state tracking |
| Type Safety | ⚠️ Not specified | ✅ Full validators | Eliminated `v.any()` |
| Query Patterns | ⚠️ Not specified | ✅ Indexed queries | Performance optimization |
| Auth Pattern | ⚠️ Not specified | ✅ Public wrappers | Security best practice |
| Transaction Safety | ⚠️ Not specified | ✅ Batch operations | Atomicity guarantee |

---

## Conclusion

The original plan provided an excellent high-level roadmap. The refinements ensure the implementation:

1. **Follows Convex best practices** for maintainability
2. **Optimizes performance** with proper indexing
3. **Ensures type safety** with validators
4. **Maintains security** with auth patterns
5. **Preserves POV scope** - minimal, focused changes

**Recommendation**: Proceed with refined implementation in `docs/pddl-integration-implementation.md`

---

## Next Steps for Developer

1. Review `docs/pddl-integration-implementation.md` for detailed code
2. Start with Step 1 (Runtime Loader) - lowest risk, highest value
3. Add schema migration for `missionProgress` table
4. Implement Steps 2-4 in sequence
5. Test with existing `ping-tutorial` mission
6. Integrate Step 5 once validation is working

**Estimated Effort**: 4-6 hours for core implementation (Steps 1-4)
**Risk Level**: Low - follows existing patterns, minimal breaking changes
