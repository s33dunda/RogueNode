---
ssot-area: runtime-performance
owner: runtime-team
derived-from: convex/gameActions.ts
---

# Story: Atomic Cache Hit Mutation

**Epic**: Performance & Cost Optimization
**Priority**: High
**Estimated Effort**: 4-6 hours
**Cost Savings**: $6-10/month at 1M cache hits/month (43-71% reduction)

## Problem Statement

The current cache hit path in `gameActions.ts:106-142` breaks transaction atomicity by executing 3-5 separate database operations:

1. `incrementCacheHit` mutation (analytics)
2. `getActiveMissions` query (mission validation)
3. `validateAllMissionSteps` mutation (mission progress)
4. `terminalOutput` insert (player output)
5. `persistCommandGameState` mutation (skill points, session state)

**Issues**:

- **Atomicity violation**: If system crashes between operations, data is inconsistent
- **Cost**: 5+ function calls per cache hit = $10-14/month at 1M cache hits
- **Latency**: 50-100ms overhead from multiple round trips
- **Zen violation**: Breaking transaction boundaries (Convex Zen Principle #1)

## Success Criteria

- [ ] Cache hit path reduced to 1-2 function calls (down from 5+)
- [ ] All cache hit operations are atomic (single transaction)
- [ ] Cost reduced by 43-71% ($6-10/month savings at 1M cache hits)
- [ ] Latency reduced by 50-100ms per cache hit
- [ ] All existing tests pass
- [ ] No regression in mission validation or game state updates

## Technical Design

### Current Flow (Non-Atomic)

```typescript
// gameActions.ts:106-142
if (cached) {
  // Operation 1: Analytics (DEBATABLE - costs $2/million)
  await ctx.runMutation(internal.utils.cacheUtils.incrementCacheHit, {
    cacheId: cached._id,
  });

  // Operation 2-3: Mission validation (NECESSARY)
  const { appendLines, totalSkillGained } = await collectMissionFeedback(ctx, ...);
  // ↳ calls getActiveMissions query + validateAllMissionSteps mutation

  // Operation 4: Terminal output (NECESSARY)
  const outputId = await ctx.db.insert("terminalOutput", { ... });

  // Operation 5: Game state update (NECESSARY)
  await ctx.runMutation(internal.gameActions.persistCommandGameState, { ... });

  return { outputId };
}
```

**Cost**: 5+ function calls × $2/million = $10-14/month at 1M cache hits

### Proposed Flow (Atomic)

```typescript
// gameActions.ts:106-142
if (cached) {
  // Single atomic mutation - all operations in one transaction
  const { outputId } = await ctx.runMutation(
    internal.gameActions.handleCacheHit,
    {
      playerId: identity.subject,
      gameStateId: gameState._id,
      command,
      commandType,
      cached: {
        output: cached.output,
        success: cached.success,
        skillGained: cached.skillGained,
        threadId: cached.threadId,
      },
      toolSessionId: normalizedState.toolSessionId,
    }
  );

  return { outputId };
}
```

**Cost**: 1 function call × $2/million = $2/month at 1M cache hits

### New Mutation: `handleCacheHit`

```typescript
// convex/gameActions.ts
export const handleCacheHit = internalMutation({
  args: v.object({
    playerId: v.string(),
    gameStateId: v.id("gameState"),
    command: v.string(),
    commandType: v.string(),
    cached: v.object({
      output: v.array(v.string()),
      success: v.boolean(),
      skillGained: v.number(),
      threadId: v.optional(v.string()),
    }),
    toolSessionId: v.optional(v.string()),
  }),
  returns: v.object({
    outputId: v.id("terminalOutput"),
  }),
  handler: async (ctx, args) => {
    // All operations in single transaction - atomic!

    // 1. Get active missions (inline query - same transaction)
    const activeMissions = await ctx.db
      .query("missionProgress")
      .withIndex("by_player_status", (q) =>
        q.eq("playerId", args.playerId).eq("status", "in_progress")
      )
      .collect();

    // 2. Validate mission steps (inline - same transaction)
    let missionSkillGained = 0;
    const missionFeedback: string[] = [];

    if (activeMissions.length > 0) {
      for (const mission of activeMissions) {
        const result = await validateMissionStepInternal(
          ctx,
          args.playerId,
          mission.missionId,
          args.command
        );
        if (result.feedback.length > 0) {
          missionFeedback.push(...result.feedback);
        }
        missionSkillGained += result.skillGained;
      }
    }

    // 3. Combine output with mission feedback
    const outputLines = [
      ...args.cached.output,
      ...(missionFeedback.length > 0
        ? ["", "=== Mission Progress ===", ...missionFeedback]
        : []),
    ];

    // 4. Insert terminal output (same transaction)
    const outputId = await ctx.db.insert("terminalOutput", {
      playerId: args.playerId,
      gameStateId: args.gameStateId,
      commandInput: args.command,
      outputLines,
      commandType: args.commandType,
      success: args.cached.success,
    });

    // 5. Update game state (same transaction)
    const gameState = await ctx.db.get(args.gameStateId);
    if (gameState) {
      const totalSkillGained = args.cached.success
        ? args.cached.skillGained + missionSkillGained
        : 0;

      if (totalSkillGained > 0 || args.cached.threadId) {
        await ctx.db.patch(args.gameStateId, {
          ...(totalSkillGained > 0
            ? { skillPoints: (gameState.skillPoints ?? 0) + totalSkillGained }
            : {}),
          ...(args.cached.threadId
            ? { toolSessionId: args.cached.threadId }
            : {}),
        });
      }
    }

    // Optional: Async analytics (doesn't block transaction)
    // await ctx.scheduler.runAfter(0, internal.analytics.recordCacheHit, { ... });

    return { outputId };
  },
});
```

## Implementation Steps

### Step 1: Create Helper Function (30 min)

Move `validateMissionStepInternal` to be importable from `gameActions.ts`:

```typescript
// convex/missions.ts - make this exportable
export async function validateMissionStepInternal(
  ctx: MutationCtx,
  playerId: string,
  missionId: string,
  playerCommand: string
): Promise<MissionStepValidationResult> {
  // ... existing implementation
}
```

### Step 2: Create `handleCacheHit` Mutation (2 hours)

1. Create new mutation in `gameActions.ts` (see design above)
2. Import `validateMissionStepInternal` from `missions.ts`
3. Inline all operations into single transaction
4. Add proper error handling

### Step 3: Update `sendCommand` (30 min)

Replace cache hit path with single mutation call:

```typescript
// gameActions.ts:106-142
if (cached) {
  const { outputId } = await ctx.runMutation(
    internal.gameActions.handleCacheHit,
    {
      playerId: identity.subject,
      gameStateId: gameState._id,
      command,
      commandType,
      cached: {
        output: cached.output,
        success: cached.success,
        skillGained: cached.skillGained,
        threadId: cached.threadId,
      },
      toolSessionId: normalizedState.toolSessionId,
    }
  );
  return { outputId };
}
```

### Step 4: Remove/Deprecate Old Functions (1 hour)

- Remove `incrementCacheHit` mutation (or make async)
- Keep `collectMissionFeedback` for non-cache paths (or refactor)
- Update `persistCommandGameState` usage in other places

### Step 5: Testing (1-2 hours)

- [ ] Test cache hit with no active missions
- [ ] Test cache hit with 1 active mission
- [ ] Test cache hit with multiple active missions
- [ ] Test cache hit with mission completion
- [ ] Test cache hit with failed mission step
- [ ] Verify skill points update correctly
- [ ] Verify terminal output includes mission feedback
- [ ] Verify toolSessionId updates correctly
- [ ] Load test: 1000 cache hits in parallel

## Rollout Plan

**Phase 1: Implementation**

1. Create `handleCacheHit` mutation
2. Update `sendCommand` to use new mutation
3. Deploy to development environment
4. Run integration tests

**Phase 2: Validation**

1. Monitor function call metrics in Convex dashboard
2. Verify cost reduction (should see 43% drop in cache hit costs)
3. Check latency improvements (50-100ms faster)
4. Ensure no errors in logs

**Phase 3: Cleanup**

1. Remove `incrementCacheHit` mutation (or move to async analytics)
2. Refactor `collectMissionFeedback` if no longer needed
3. Update documentation

## Metrics to Track

**Before** (baseline):

- Function calls per cache hit: 5+
- Cost per 1M cache hits: $10-14/month
- Average cache hit latency: 150-250ms

**After** (target):

- Function calls per cache hit: 1
- Cost per 1M cache hits: $2-4/month
- Average cache hit latency: 50-100ms

**Success Indicators**:

- ✅ 43-71% cost reduction
- ✅ 50-100ms latency improvement
- ✅ Zero atomicity errors
- ✅ All tests passing

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking mission validation | High | Comprehensive testing, feature flag |
| Increased mutation complexity | Medium | Clear code comments, helper functions |
| Regression in skill points | High | Integration tests, manual QA |
| Performance degradation | Low | Inline operations are faster than separate calls |

## Future Enhancements

After this story is complete, consider:

1. **Remove cache hit counter entirely** - Save additional $2/month
2. **Batch mission validation** - When N > 3 missions (see `optimize-cache-hit-mission-validation.md`)
3. **Async analytics** - Move cache hit tracking to scheduled job
4. **Evaluate commandOutputCache necessity** - Convex's automatic caching might be sufficient

## References

- Convex Zen Principle #1: Transaction Boundaries & Atomicity
- Convex Pricing: $2 per 1M function calls
- Current implementation: `convex/gameActions.ts:106-142`
- Related story: `docs/feature-requests/optimize-cache-hit-mission-validation.md`
- Documentation: `docs/player-action-howtos/ai-commands.md:139-180`
