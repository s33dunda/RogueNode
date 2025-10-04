---
ssot-area: runtime-performance
owner: runtime-team
derived-from: docs/feature-requests/atomic-cache-hit-mutation.md
---

# Story: Combine Mission Feedback with Terminal Output

**Epic**: Performance & Cost Optimization
**Priority**: Low
**Estimated Effort**: 2-3 hours
**Cost Savings**: $2/month at 1M operations (14% additional reduction)
**Depends On**: `atomic-cache-hit-mutation.md` (should be implemented first)

## Problem Statement

After implementing atomic cache hit mutation, the **non-cache path** in `executeAsyncCommand` still has separate operations for mission validation and terminal output:

```typescript
// convex/gameActions.ts:241-267
const { appendLines, totalSkillGained } = await collectMissionFeedback(ctx, ...);
// ↳ calls getActiveMissions query + validateAllMissionSteps mutation

const outputLines = [...result.output, ...appendLines];

await ctx.runMutation(internal.gameActions.writeCommandOutput, {
  outputLines,
  // ...
});

await ctx.runMutation(internal.gameActions.persistCommandGameState, {
  skillDelta: result.skillGained + totalSkillGained,
  // ...
});
```

**Issues**:

- **Cost**: 3 separate function calls (query + 2 mutations) = $6/million operations
- **Atomicity**: Not atomic - could fail between operations
- **Latency**: Extra round trips add 30-50ms

## Success Criteria

- [ ] Non-cache async command path reduced to 1 mutation call (down from 3)
- [ ] All operations are atomic (single transaction)
- [ ] Cost reduced by 14% ($2/month savings at 1M operations)
- [ ] Latency reduced by 30-50ms per async command
- [ ] All existing tests pass
- [ ] No regression in mission validation or terminal output

## Technical Design

### Current Flow (Non-Atomic)

```typescript
// convex/gameActions.ts:228-267 (executeAsyncCommand action)
const result = await ctx.runAction(internal.agents.pingAgent.executePingCommand, {
  target,
  gameState,
  threadId,
});

// Operation 1-2: Mission validation (query + mutation)
const { appendLines, totalSkillGained } = await collectMissionFeedback(
  ctx,
  args.playerId,
  args.command,
  { includeNoMissionMessage: true }
);

// Operation 3: Write output (mutation)
await ctx.runMutation(internal.gameActions.writeCommandOutput, {
  playerId: args.playerId,
  gameStateId: args.gameStateId,
  commandInput: args.command,
  outputLines: [...result.output, ...appendLines],
  commandType: args.commandType,
  success: result.success,
  outputId: args.outputId,
});

// Operation 4: Update game state (mutation)
await ctx.runMutation(internal.gameActions.persistCommandGameState, {
  gameStateId: args.gameStateId,
  skillDelta: result.success ? result.skillGained + totalSkillGained : 0,
  toolSessionId: result.threadId ?? gameState.toolSessionId,
});
```

**Cost**: 4 function calls (1 action + 1 query + 2 mutations) × $2/million = $8/million

### Proposed Flow (Atomic)

```typescript
// convex/gameActions.ts:228-267 (executeAsyncCommand action)
const result = await ctx.runAction(internal.agents.pingAgent.executePingCommand, {
  target,
  gameState,
  threadId,
});

// Single atomic mutation - combines all operations
await ctx.runMutation(internal.gameActions.finalizeCommandOutput, {
  playerId: args.playerId,
  gameStateId: args.gameStateId,
  commandInput: args.command,
  commandType: args.commandType,
  outputId: args.outputId,
  commandResult: {
    output: result.output,
    success: result.success,
    skillGained: result.skillGained,
    threadId: result.threadId,
  },
  toolSessionId: gameState.toolSessionId,
  includeNoMissionMessage: true,
});
```

**Cost**: 2 function calls (1 action + 1 mutation) × $2/million = $4/million

**Savings**: $4/million = $2/month at 500K async commands/month

### New Mutation: `finalizeCommandOutput`

```typescript
// convex/gameActions.ts
export const finalizeCommandOutput = internalMutation({
  args: v.object({
    playerId: v.string(),
    gameStateId: v.id("gameState"),
    commandInput: v.string(),
    commandType: v.string(),
    outputId: v.id("terminalOutput"),
    commandResult: v.object({
      output: v.array(v.string()),
      success: v.boolean(),
      skillGained: v.number(),
      threadId: v.optional(v.string()),
    }),
    toolSessionId: v.optional(v.string()),
    includeNoMissionMessage: v.optional(v.boolean()),
  }),
  returns: v.null(),
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

    if (activeMissions.length === 0 && args.includeNoMissionMessage) {
      missionFeedback.push(
        "",
        "=== Mission Progress ===",
        "No active mission found. Start a mission first."
      );
    } else {
      for (const mission of activeMissions) {
        const result = await validateMissionStepInternal(
          ctx,
          args.playerId,
          mission.missionId,
          args.commandInput
        );
        if (result.feedback.length > 0) {
          missionFeedback.push(...result.feedback);
        }
        missionSkillGained += result.skillGained;
      }
    }

    // 3. Combine output with mission feedback
    const outputLines = [
      ...args.commandResult.output,
      ...(missionFeedback.length > 0
        ? ["", "=== Mission Progress ===", ...missionFeedback]
        : []),
    ];

    // 4. Update terminal output (same transaction)
    await ctx.db.patch(args.outputId, {
      outputLines,
      success: args.commandResult.success,
    });

    // 5. Update game state (same transaction)
    const gameState = await ctx.db.get(args.gameStateId);
    if (gameState) {
      const totalSkillGained = args.commandResult.success
        ? args.commandResult.skillGained + missionSkillGained
        : 0;

      const updates: Partial<Doc<"gameState">> = {};
      if (totalSkillGained > 0) {
        updates.skillPoints = (gameState.skillPoints ?? 0) + totalSkillGained;
      }
      if (args.commandResult.threadId) {
        updates.toolSessionId = args.commandResult.threadId;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(args.gameStateId, updates);
      }
    }

    return null;
  },
});
```

## Implementation Steps

### Step 1: Create `finalizeCommandOutput` Mutation (1 hour)

1. Create new mutation in `gameActions.ts` (see design above)
2. Reuse `validateMissionStepInternal` from `missions.ts` (already exported in previous story)
3. Inline all operations into single transaction
4. Add proper error handling

### Step 2: Update `executeAsyncCommand` (30 min)

Replace separate mutation calls with single atomic mutation:

```typescript
// convex/gameActions.ts:228-267
case "ping": {
  const target = args.target || "localhost";
  const result = await ctx.runAction(
    internal.agents.pingAgent.executePingCommand,
    {
      target,
      gameState,
      threadId: gameState.toolSessionId,
    }
  );

  // Single atomic mutation replaces 3 separate calls
  await ctx.runMutation(internal.gameActions.finalizeCommandOutput, {
    playerId: args.playerId,
    gameStateId: args.gameStateId,
    commandInput: args.command,
    commandType: args.commandType,
    outputId: args.outputId,
    commandResult: {
      output: result.output,
      success: result.success,
      skillGained: result.skillGained,
      threadId: result.threadId,
    },
    toolSessionId: gameState.toolSessionId,
    includeNoMissionMessage: true,
  });
  break;
}
```

### Step 3: Deprecate Old Functions (30 min)

- Keep `writeCommandOutput` for error cases (or refactor)
- Keep `persistCommandGameState` for other use cases (or refactor)
- Consider removing `collectMissionFeedback` if no longer used

### Step 4: Testing (1 hour)

- [ ] Test async command with no active missions
- [ ] Test async command with 1 active mission
- [ ] Test async command with multiple active missions
- [ ] Test async command with mission completion
- [ ] Test async command with failed mission step
- [ ] Verify skill points update correctly
- [ ] Verify terminal output includes mission feedback
- [ ] Verify toolSessionId updates correctly
- [ ] Test error handling (action fails, invalid game state, etc.)

## Rollout Plan

**Phase 1: Implementation**

1. Create `finalizeCommandOutput` mutation
2. Update `executeAsyncCommand` to use new mutation
3. Deploy to development environment
4. Run integration tests

**Phase 2: Validation**

1. Monitor function call metrics in Convex dashboard
2. Verify cost reduction (should see 14% drop in async command costs)
3. Check latency improvements (30-50ms faster)
4. Ensure no errors in logs

**Phase 3: Cleanup**

1. Evaluate if `writeCommandOutput` still needed (keep for error cases)
2. Evaluate if `persistCommandGameState` still needed (keep for other use cases)
3. Remove `collectMissionFeedback` if no longer used
4. Update documentation

## Metrics to Track

**Before** (baseline):

- Function calls per async command: 4 (1 action + 1 query + 2 mutations)
- Cost per 1M async commands: $8/month
- Average async command latency: 200-300ms

**After** (target):

- Function calls per async command: 2 (1 action + 1 mutation)
- Cost per 1M async commands: $4/month
- Average async command latency: 150-250ms

**Success Indicators**:

- ✅ 50% cost reduction on async command path
- ✅ 30-50ms latency improvement
- ✅ Zero atomicity errors
- ✅ All tests passing

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking mission validation | High | Comprehensive testing, reuse validated code from cache hit story |
| Increased mutation complexity | Medium | Clear code comments, helper functions |
| Regression in skill points | High | Integration tests, manual QA |
| Error handling edge cases | Medium | Keep `writeCommandOutput` for error fallback |

## Dependencies

**Prerequisite**: `atomic-cache-hit-mutation.md` should be implemented first because:

1. It establishes the pattern for atomic mission validation
2. It exports `validateMissionStepInternal` for reuse
3. It validates the approach with cache hits before applying to async commands

**Blocks**: None - this is an independent optimization

## Future Enhancements

After this story is complete, consider:

1. **Unify cache hit and async paths** - Both now use similar atomic patterns, could be further consolidated
2. **Batch async command processing** - Process multiple commands in parallel
3. **Async analytics** - Move any remaining analytics to scheduled jobs
4. **Evaluate helper function usage** - Simplify `writeCommandOutput` and `persistCommandGameState` if only used for error cases

## References

- Convex Zen Principle #1: Transaction Boundaries & Atomicity
- Convex Pricing: $2 per 1M function calls
- Current implementation: `convex/gameActions.ts:228-267`
- Related story: `docs/feature-requests/atomic-cache-hit-mutation.md` (prerequisite)
- Related story: `docs/feature-requests/optimize-cache-hit-mission-validation.md`
- Documentation: `docs/player-action-howtos/ai-commands.md:139-180`
