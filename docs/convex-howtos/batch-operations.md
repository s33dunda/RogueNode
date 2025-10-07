---
ssot-area: convex-patterns
owner: backend-team
derived-from: docs/feature-requests/1.3.optimize-cache-hit-mission-validation.md
canonical-examples: convex/missions.ts:24-188
implementation-story: docs/implementation-notes/1.3-batch-mission-validation-implementation.md
---

# HOWTO: Batch Operations in Convex

**Pattern**: Optimize multiple database operations by batching queries while maintaining transaction atomicity.

**When to use**:

- Multiple items need the same validation/processing
- Performance matters (high-frequency paths, cache hits)
- You need to maintain atomicity across all operations

**Real-world example**: Mission validation optimization (Story 1.3) reduced O(N) queries to O(1) while maintaining full atomicity.

---

## The Problem

When processing multiple items in a loop, naive implementations create N separate queries:

```typescript
// ❌ INEFFICIENT - N separate queries
for (const missionId of missionIds) {
  const progress = await ctx.db
    .query("missionProgress")
    .withIndex("by_player_mission", (q) =>
      q.eq("playerId", playerId).eq("missionId", missionId)
    )
    .first();

  // Validate and patch
  await validateAndPatch(progress);
}
```

**Problems**:

- N database queries (one per item)
- Multiplies latency and cost
- Still atomic, but inefficient

---

## The Solution: Batch Query Pattern

### Step 1: Extract Pure Validation Function

Create a pure function with **no database operations**:

```typescript
/**
 * Pure validation function - no database operations
 *
 * Takes a document and returns validation result + changes to apply.
 * This enables in-memory batch processing.
 */
export function validateAndPrepareUpdate(
  progress: Doc<"missionProgress">,
  playerCommand: string,
): {
  id: Id<"missionProgress">;
  changes: Partial<Doc<"missionProgress">> | null;
  result: ValidationResult;
} {
  // All validation logic here - no ctx.db calls!
  const matched = matchesStep(playerCommand, currentStep);

  return {
    id: progress._id,
    changes: matched ? { /* updates */ } : null,
    result: { matched, feedback, skillGained }
  };
}
```

**Key characteristics**:

- ✅ No side effects
- ✅ No database operations
- ✅ Returns both result and changes to apply
- ✅ Testable in isolation

### Step 2: Create Batch Processing Function

Process all items in a single transaction:

```typescript
/**
 * Batch validation - optimized for performance
 *
 * 1. Single query to get all items
 * 2. In-memory validation using pure function
 * 3. Sequential patches within same transaction
 */
export async function validateAllInBatch(
  ctx: MutationCtx,
  playerId: string,
  command: string,
): Promise<{ feedback: string[]; totalSkillGained: number }> {
  // 1. Single query for all items (O(1) query)
  const allProgress = await ctx.db
    .query("missionProgress")
    .withIndex("by_player_status", (q) =>
      q.eq("playerId", playerId).eq("status", "in_progress")
    )
    .collect();

  // 2. Validate all in memory (no DB operations)
  const updates = allProgress.map((progress) =>
    validateAndPrepareUpdate(progress, command)
  );

  // 3. Apply all patches sequentially within same transaction
  const aggregatedFeedback: string[] = [];
  let totalSkillGained = 0;

  for (const update of updates) {
    if (update.changes) {
      await ctx.db.patch(update.id, update.changes);
    }

    aggregatedFeedback.push(...update.result.feedback);
    totalSkillGained += update.result.skillGained;
  }

  return { feedback: aggregatedFeedback, totalSkillGained };
}
```

**Benefits**:

- ✅ Single query instead of N queries
- ✅ All operations in same transaction (atomic)
- ✅ No sub-transactions created
- ✅ Maintains correctness while optimizing

---

## Performance Impact

### Database Operations

| Items | Before (Queries) | After (Queries) | Improvement |
|-------|------------------|-----------------|-------------|
| 1     | 2                | 1               | 50%         |
| 2     | 3                | 1               | 67%         |
| 5     | 6                | 1               | 83%         |
| 10    | 11               | 1               | 91%         |

**Note**: Patch operations remain N (sequential within same transaction), but query overhead is eliminated.

### Expected Latency Improvements

Based on Story 1.3 measurements:

| Items | Before      | After       | Improvement |
|-------|-------------|-------------|-------------|
| 1     | 100-200ms   | 85-170ms    | ~15%        |
| 2     | 150-250ms   | 90-150ms    | ~40%        |
| 5     | 250-400ms   | 88-140ms    | ~65%        |
| 10    | 300-500ms   | 60-100ms    | ~80%        |

---

## Integration Example

### Before: Sequential Validation

```typescript
// ❌ OLD - N queries in loop
const activeMissions = await ctx.db.query(...).collect();

for (const mission of activeMissions) {
  const result = await validateMissionStepInternal(
    ctx,
    playerId,
    mission.missionId,
    command
  );
  // Each call: 1 query + 1 patch
}
```

### After: Batch Validation

```typescript
// ✅ NEW - Single batch operation
const { feedback, totalSkillGained } =
  await validateAllInBatch(ctx, playerId, command);
// 1 query + N patches (all in same transaction)
```

---

## Atomicity Compliance

✅ **VERIFIED**: This pattern maintains full transaction atomicity

- All operations remain within single transaction
- No `ctx.runMutation` calls introduced
- All database operations use direct `ctx.db` methods
- Sequential patches occur within parent mutation transaction
- Follows guidelines in `docs/convex-howtos/transaction-atomicity.md`

---

## Implementation Checklist

When implementing batch operations:

- [ ] Extract pure validation function (no `ctx.db` calls)
- [ ] Single query fetches all items using appropriate index
- [ ] In-memory processing using pure function
- [ ] All patches applied sequentially in same transaction
- [ ] No sub-transactions created (`ctx.runMutation`)
- [ ] Results aggregated correctly
- [ ] Empty collection handled gracefully
- [ ] Type safety maintained (use `Doc<"tableName">`, `Id<"tableName">`)

---

## Common Pitfalls

### ❌ Don't: Use `ctx.runMutation` in loops

```typescript
// ❌ WRONG - Creates sub-transactions
for (const item of items) {
  await ctx.runMutation(internal.validate, { item });
}
```

### ❌ Don't: Sacrifice atomicity for performance

```typescript
// ❌ WRONG - Breaks atomicity
for (const item of items) {
  await ctx.runMutation(internal.processItem, { item });
  // If this fails, previous items already committed!
}
```

### ✅ Do: Keep everything in same transaction

```typescript
// ✅ CORRECT - All operations atomic
const items = await ctx.db.query(...).collect();
const updates = items.map(item => prepareUpdate(item));
for (const update of updates) {
  await ctx.db.patch(update.id, update.changes);
}
```

---

## When NOT to Use This Pattern

- **Small N**: If you typically process 1-2 items, optimization may not be worth complexity
- **Different operations**: If each item needs different processing, batch pattern doesn't apply
- **External APIs**: If validation requires external calls, use actions instead
- **Complex dependencies**: If items depend on each other's results, sequential may be clearer

---

## Real-World Example

**Story 1.3**: Mission validation optimization

**Files**:

- Pure function: `convex/missions.ts:24-126` (`validateAndPrepareUpdate`)
- Batch function: `convex/missions.ts:138-188` (`validateAllMissionsInBatch`)
- Integration: `convex/gameActions.ts:107-152` (cache hit path)

**Results**:

- Reduced 11 queries to 1 query (with 10 active missions)
- ~80% latency improvement in high-mission scenarios
- Maintained full transaction atomicity
- Implementation time: ~2 hours

**Full documentation**: `docs/implementation-notes/1.3-batch-mission-validation-implementation.md`

---

## Related Patterns

- **[Transaction Atomicity](./transaction-atomicity.md)** - CRITICAL: Understand atomicity before optimizing
- **Query Optimization** - Using indexes effectively (coming soon)
- **Pure Functions** - Separating logic from side effects (coming soon)

---

## References

- **Implementation Story**: `docs/feature-requests/1.3.optimize-cache-hit-mission-validation.md`
- **Canonical Code**: `convex/missions.ts:24-188`
- **Transaction Atomicity**: `docs/convex-howtos/transaction-atomicity.md`
- **Convex Best Practices**: CLAUDE.md:123-131 (Transaction Boundaries)
