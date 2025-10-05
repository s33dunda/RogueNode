---
ssot-area: player-actions
owner: game-systems-team
derived-from: convex-best-practices
---

# Transaction Atomicity Best Practices

**Critical Principle**: All operations within a Convex mutation must be inlined directly to ensure true atomicity. Using `ctx.runMutation` or `ctx.runQuery` within a mutation creates sub-transactions that break atomicity guarantees.

**References**:

- **CLAUDE.md:123-131** - Transaction Boundaries & Atomicity (Convex Paradigm Shift #1)
- **CLAUDE.md:161-167** - Action Orchestration (Convex Paradigm Shift #4)
- **Convex Documentation** - Mutation sub-transactions and atomicity

---

## Why This Matters

### The Sub-Transaction Problem

When you call `ctx.runMutation` from within a mutation, Convex creates a **sub-transaction**:

- Sub-transactions can be rolled back independently
- If the parent mutation fails after a sub-transaction succeeds, data becomes inconsistent
- Each call adds overhead for validation and context creation
- Multiple calls multiply costs and latency

### Real-World Impact

**Cost**: At 1M operations/month with 5 function calls each:

- Sequential mutations: $10-14/month
- Inline operations: $2/month
- **Savings**: $8-12/month (60-80% reduction)

**Latency**: Each `ctx.runMutation` call adds 10-20ms overhead

- 5 sequential calls: 50-100ms added latency
- Inline operations: 0ms overhead

**Reliability**: Sub-transactions break atomicity

- System crash between calls = inconsistent data
- Partial updates visible to other queries
- Race conditions in concurrent operations

---

## ❌ ANTI-PATTERN: Sequential Mutations

### Example 1: Cache Hit Path (AI Commands)

```typescript
// ❌ WRONG - Creates 5+ sub-transactions, breaks atomicity
if (cached) {
  // Sub-transaction 1: Analytics
  await ctx.runMutation(internal.utils.cacheUtils.incrementCacheHit, {
    cacheId: cached._id,
  });

  // Sub-transaction 2-3: Mission validation (calls query + mutation internally)
  const { appendLines, totalSkillGained } = await collectMissionFeedback(
    ctx,
    identity.subject,
    command
  );

  // Direct operation (good, but surrounded by sub-transactions)
  const outputId = await ctx.db.insert("terminalOutput", { ... });

  // Sub-transaction 4: Game state update
  await ctx.runMutation(internal.gameActions.persistCommandGameState, {
    gameStateId: gameState._id,
    skillDelta: cached.skillGained + totalSkillGained,
    toolSessionId: cached.threadId,
  });

  return { outputId };
}
```

**Problems**:

- 5+ function calls per cache hit
- Each `ctx.runMutation` creates a sub-transaction
- If system crashes between operations, data is inconsistent
- Costs $10-14/month at 1M cache hits
- Adds 50-100ms latency per cache hit

### Example 2: Async Command Finalization

```typescript
// ❌ WRONG - Multiple mutations break atomicity
case "scan": {
  const result = await ctx.runAction(internal.agents.scanAgent.executeScanCommand, {
    target: args.target,
    gameState,
    threadId: gameState.toolSessionId,
  });

  // Sub-transaction 1-2: Mission validation
  const { appendLines, totalSkillGained } = await collectMissionFeedback(
    ctx,
    args.playerId,
    args.command,
    { includeNoMissionMessage: true }
  );

  // Sub-transaction 3: Output update
  await ctx.runMutation(internal.gameActions.writeCommandOutput, {
    playerId: args.playerId,
    gameStateId: args.gameStateId,
    commandInput: args.command,
    outputLines: [...result.output, ...appendLines],
    commandType: args.commandType,
    success: result.success,
    outputId: args.outputId,
  });

  // Sub-transaction 4: Game state update
  await ctx.runMutation(internal.gameActions.persistCommandGameState, {
    gameStateId: args.gameStateId,
    skillDelta: result.success ? result.skillGained + totalSkillGained : 0,
    toolSessionId: result.threadId ?? gameState.toolSessionId,
  });
}
```

**Problems**:

- 4+ function calls per command
- Each mutation creates a sub-transaction
- Violates Convex atomicity guarantees
- Costs 2x more than atomic pattern

---

## ✅ CORRECT PATTERN: Inline All Operations

### Example 1: Cache Hit Path (AI Commands)

```typescript
// ✅ CORRECT - All operations inline in single transaction
if (cached) {
  // 1. Get active missions (inline query - same transaction)
  const activeMissions = await ctx.db
    .query("missionProgress")
    .withIndex("by_player_status", (q) =>
      q.eq("playerId", identity.subject).eq("status", "in_progress")
    )
    .collect();

  // 2. Validate mission steps (inline - same transaction)
  let missionSkillGained = 0;
  const missionFeedback: string[] = [];

  if (activeMissions.length > 0) {
    for (const mission of activeMissions) {
      const result = await validateMissionStepInternal(
        ctx,
        identity.subject,
        mission.missionId,
        command
      );
      if (result.feedback.length > 0) {
        missionFeedback.push(...result.feedback);
      }
      missionSkillGained += result.skillGained;
    }
  }

  // 3. Combine output with mission feedback
  const outputLines = [
    ...cached.output,
    ...(missionFeedback.length > 0
      ? ["", "=== Mission Progress ===", ...missionFeedback]
      : []),
  ];

  // 4. Insert terminal output (same transaction)
  const outputId = await ctx.db.insert("terminalOutput", {
    playerId: identity.subject,
    gameStateId: gameState._id,
    commandInput: command,
    outputLines,
    commandType,
    success: cached.success,
  });

  // 5. Update game state (same transaction)
  const totalSkillGained = cached.success
    ? cached.skillGained + missionSkillGained
    : 0;

  if (totalSkillGained > 0 || cached.threadId) {
    await ctx.db.patch(gameState._id, {
      ...(totalSkillGained > 0
        ? { skillPoints: (gameState.skillPoints ?? 0) + totalSkillGained }
        : {}),
      ...(cached.threadId
        ? { toolSessionId: cached.threadId }
        : {}),
    });
  }

  return { outputId };
}
```

**Benefits**:

- ✅ TRUE atomicity (single transaction, no sub-transactions)
- ✅ 0 additional function calls (all inline in parent mutation)
- ✅ Cost: $2/month at 1M cache hits (vs $10-14/month)
- ✅ Savings: $8-12/month (60-80% reduction)
- ✅ Latency: 50-100ms improvement
- ✅ Aligns with Convex best practices

### Example 2: Async Command Finalization

```typescript
// ✅ CORRECT - Single atomic mutation with all operations inline
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
          args.commandInput
        );
        if (result.feedback.length > 0) {
          missionFeedback.push(...result.feedback);
        }
        missionSkillGained += result.skillGained;
      }
    } else if (args.includeNoMissionMessage) {
      missionFeedback.push(
        "",
        "=== Mission Progress ===",
        "No active mission found. Start a mission first."
      );
    }

    // 3. Combine output with mission feedback
    const outputLines = [
      ...args.commandResult.output,
      ...(missionFeedback.length > 0 ? missionFeedback : []),
    ];

    // 4. Update terminal output (same transaction)
    await ctx.db.patch(args.outputId, {
      outputLines,
      success: args.commandResult.success,
    });

    // 5. Update game state (same transaction)
    const totalSkillGained = args.commandResult.success
      ? args.commandResult.skillGained + missionSkillGained
      : 0;

    if (totalSkillGained > 0 || args.commandResult.threadId) {
      const gameState = await ctx.db.get(args.gameStateId);
      if (gameState) {
        await ctx.db.patch(args.gameStateId, {
          ...(totalSkillGained > 0
            ? { skillPoints: (gameState.skillPoints ?? 0) + totalSkillGained }
            : {}),
          ...(args.commandResult.threadId
            ? { toolSessionId: args.commandResult.threadId }
            : {}),
        });
      }
    }
  },
});
```

**Usage in action**:

```typescript
case "scan": {
  const result = await ctx.runAction(internal.agents.scanAgent.executeScanCommand, {
    target: args.target || "localhost",
    gameState,
    threadId: gameState.toolSessionId,
  });

  // Single atomic mutation - combines mission validation + output + game state
  await ctx.runMutation(internal.gameActions.finalizeCommandOutput, {
    playerId: args.playerId,
    gameStateId: args.gameStateId,
    commandInput: args.command,
    commandType: args.commandType,
    outputId: args.outputId,
    commandResult: result,
    toolSessionId: gameState.toolSessionId,
    includeNoMissionMessage: true,
  });
  break;
}
```

**Benefits**:

- ✅ TRUE atomicity (single transaction)
- ✅ 50% cost reduction (2 function calls vs 4)
- ✅ 30-50ms faster
- ✅ Aligns with Convex best practices

---

## Implementation Guidelines

### 1. Use Helper Functions, Not Mutations

```typescript
// ✅ CORRECT - Helper function (not a mutation)
export async function validateMissionStepInternal(
  ctx: MutationCtx,
  playerId: string,
  missionId: string,
  playerCommand: string
): Promise<MissionStepValidationResult> {
  // Implementation
}

// ❌ WRONG - Mutation that gets called from another mutation
export const validateMissionStep = internalMutation({
  handler: async (ctx, args) => {
    // This creates a sub-transaction when called via ctx.runMutation
  },
});
```

### 2. Direct Database Operations Only

Within a mutation's critical path, use only:

- ✅ `ctx.db.query()` - Direct database queries
- ✅ `ctx.db.insert()` - Direct inserts
- ✅ `ctx.db.patch()` - Direct updates
- ✅ `ctx.db.delete()` - Direct deletes
- ✅ Helper functions (regular TypeScript functions)

Avoid:

- ❌ `ctx.runMutation()` - Creates sub-transactions
- ❌ `ctx.runQuery()` - Creates sub-transactions
- ❌ Calling other mutations/queries

### 3. Actions Can Call Multiple Mutations

Actions (not mutations) can orchestrate multiple mutations:

```typescript
// ✅ CORRECT - Action orchestrating multiple mutations
export const importTeams = action({
  handler: async (ctx, { teamId }) => {
    const teamMembers = await fetchTeamMemberData(teamId);

    // Single mutation with batch operation
    await ctx.runMutation(internal.teams.insertUsers, {
      users: teamMembers
    });
  },
});
```

---

## Implementation Checklist

When implementing any mutation with multiple operations:

- [ ] All operations are inlined directly in the mutation
- [ ] NO `ctx.runMutation` calls within the mutation
- [ ] NO `ctx.runQuery` calls within the mutation (use direct `ctx.db.query()`)
- [ ] Use helper functions (not mutations) for shared logic
- [ ] Direct `ctx.db` operations only (query, insert, patch, delete)
- [ ] Code review confirms zero sub-transactions
- [ ] Convex dashboard shows single transaction (not multiple)

---

## Related Documentation

- `docs/player-action-howtos/ai-commands.md` - Cache hit implementation with atomicity
- `docs/player-action-howtos/async-commands.md` - Async command finalization patterns
- `docs/feature-requests/atomic-cache-hit-mutation.md` - Full implementation plan for cache hit optimization
- **CLAUDE.md:123-131** - Transaction Boundaries & Atomicity
- **CLAUDE.md:161-167** - Action Orchestration
