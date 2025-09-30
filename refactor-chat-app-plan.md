# Refactor Game Architecture to Follow Convex Chat Pattern

## Current State Analysis

### Issues Identified

1. **Client-side game logic** - [GameCommands.ts](utils/GameCommands.ts) mutates items/state directly
2. **Split command processing** - Half client, half server with injected functions
3. **No message/output table** - Commands return responses directly, no persistence
4. **Poor command flow** - `useCommandProcessor` → `parseCommand` → injected actions
5. **Missing unified output handler** - Each command generates output independently

## Convex Chat Tutorial Pattern

The chat tutorial shows the correct architecture:

- `sendMessage` mutation: validates, stores in DB, schedules async work
- `getMessages` query: retrieves message history with real-time updates
- Single source of truth: all messages in `messages` table
- Actions (like Wikipedia) call back to `sendMessage` to post results

## Proposed Architecture

### 1. Add `terminalOutput` Table (Schema)

```typescript
terminalOutput: defineTable({
  playerId: v.string(),
  gameStateId: v.id("gameState"),
  commandInput: v.string(),
  outputLines: v.array(v.string()),
  commandType: v.string(), // "help", "ping", "look", etc.
  success: v.boolean(),
})
  .index("by_player", ["playerId"])
  .index("by_gameState", ["gameStateId"])

// Rely on Convex's `_creationTime` system field for recency; no custom timestamps needed.
```

### 2. Create `sendCommand` Mutation (convex/gameActions.ts)

```typescript
export const sendCommand = mutation({
  args: { command: v.string() },
  handler: async (ctx, { command }) => {
    const identity = await requireAuth(ctx);
    const gameState = await getPlayerGameState(ctx, identity.subject);

    const { commandType, target } = parseCommandType(command);

    if (isSyncCommand(commandType)) {
      const output = await processSyncCommand(ctx, gameState, commandType, target);
      const outputId = await ctx.db.insert("terminalOutput", {
        playerId: identity.subject,
        gameStateId: gameState._id,
        commandInput: command,
        outputLines: output,
        commandType,
        success: true,
      });
      return { outputId };
    }

    const normalizedTarget = target || "localhost";
    const normalizedState = docToGameState(gameState);
    const cacheKey = generateCacheKey(commandType, normalizedTarget, normalizedState);
    const cached = await ctx.db
      .query("commandOutputCache")
      .withIndex("by_command_target_hash", (q) =>
        q
          .eq("command", commandType)
          .eq("target", normalizedTarget)
          .eq("gameStateHash", cacheKey.slice(cacheKey.lastIndexOf(":") + 1)),
      )
      .first();

    if (cached) {
      await ctx.runMutation(internal.utils.cacheUtils.incrementCacheHit, {
        cacheId: cached._id,
      });

      const outputId = await ctx.db.insert("terminalOutput", {
        playerId: identity.subject,
        gameStateId: gameState._id,
        commandInput: command,
        outputLines: cached.output,
        commandType,
        success: cached.success,
      });

      await ctx.runMutation(internal.gameActions.persistCommandGameState, {
        gameStateId: gameState._id,
        skillDelta: cached.success ? cached.skillGained : 0,
        toolSessionId: cached.threadId ?? normalizedState.toolSessionId,
      });

      return { outputId };
    }

    const outputId = await ctx.db.insert("terminalOutput", {
      playerId: identity.subject,
      gameStateId: gameState._id,
      commandInput: command,
      outputLines: ["Processing..."],
      commandType,
      success: false,
    });

    await ctx.scheduler.runAfter(0, internal.gameActions.executeAsyncCommand, {
      playerId: identity.subject,
      gameStateId: gameState._id,
      command,
      commandType,
      target,
      outputId,
    });

    return { outputId };
  },
});
```

> Utility: `docToGameState` converts the Convex document to the shared type so cache keys stay consistent between mutations and actions.

### 3. Create `executeAsyncCommand` Action (convex/gameActions.ts)

```typescript
export const executeAsyncCommand = internalAction({
  args: {
    playerId: v.string(),
    gameStateId: v.id("gameState"),
    command: v.string(),
    commandType: v.string(),
    target: v.string(),
    outputId: v.id("terminalOutput"),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.runQuery(internal.gameActions.getGameStateById, {
      gameStateId: args.gameStateId,
    });

    if (!gameState) {
      await ctx.runMutation(internal.gameActions.writeCommandOutput, {
        playerId: args.playerId,
        gameStateId: args.gameStateId,
        commandInput: args.command,
        outputLines: ["Unable to process command.", "No active game state found."],
        commandType: args.commandType,
        success: false,
        outputId: args.outputId,
      });
      return;
    }

    switch (args.commandType) {
      case "ping": {
        const result = await ctx.runAction(internal.agents.pingAgent.executePingCommand, {
          target: args.target || "localhost",
          gameState,
          threadId: gameState.toolSessionId,
        });

        await ctx.runMutation(internal.gameActions.writeCommandOutput, {
          playerId: args.playerId,
          gameStateId: args.gameStateId,
          commandInput: args.command,
          outputLines: result.output,
          commandType: args.commandType,
          success: result.success,
          outputId: args.outputId,
        });

        await ctx.runMutation(internal.gameActions.persistCommandGameState, {
          gameStateId: args.gameStateId,
          skillDelta: result.success ? result.skillGained : 0,
          toolSessionId: result.threadId ?? gameState.toolSessionId,
        });
        break;
      }
      default: {
        await ctx.runMutation(internal.gameActions.writeCommandOutput, {
          playerId: args.playerId,
          gameStateId: args.gameStateId,
          commandInput: args.command,
          outputLines: [
            `Command '${args.commandType}' is not yet implemented.`,
          ],
          commandType: args.commandType,
          success: false,
          outputId: args.outputId,
        });
      }
    }
  },
});
```

### 5. Create `getGameStateById` Internal Query

```typescript
export const getGameStateById = internalQuery({
  args: { gameStateId: v.id("gameState") },
  handler: async (ctx, { gameStateId }) => {
    return await ctx.db.get(gameStateId);
  },
});
```

### 6. Create `writeCommandOutput` Internal Mutation

```typescript
export const writeCommandOutput = internalMutation({
  args: {
    playerId: v.string(),
    gameStateId: v.id("gameState"),
    commandInput: v.string(),
    outputLines: v.array(v.string()),
    commandType: v.string(),
    success: v.boolean(),
    outputId: v.id("terminalOutput"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outputId, {
      outputLines: args.outputLines,
      success: args.success,
    });
  },
});
```

### 7. Create `persistCommandGameState` Internal Mutation

```typescript
export const persistCommandGameState = internalMutation({
  args: {
    gameStateId: v.id("gameState"),
    skillDelta: v.optional(v.number()),
    toolSessionId: v.optional(v.string()),
  },
  handler: async (ctx, { gameStateId, skillDelta, toolSessionId }) => {
    const state = await ctx.db.get(gameStateId);
    if (!state) return;

    const updates: Partial<Doc<"gameState">> = {};
    if (typeof skillDelta === "number" && skillDelta !== 0) {
      updates.skillPoints = (state.skillPoints ?? 0) + skillDelta;
    }
    if (toolSessionId !== undefined) {
      updates.toolSessionId = toolSessionId;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(gameStateId, updates);
    }
  },
});
```

### 8. Create `getTerminalOutput` Query

```typescript
export const getTerminalOutput = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const outputs = await ctx.db
      .query("terminalOutput")
      .withIndex("by_player", (q) => q.eq("playerId", identity.subject))
      .order("desc") // sorted by `_creationTime`
      .take(50);
    return outputs.reverse(); // Chronological order
  },
});
```

### 9. Refactor `useCommandProcessor` Hook

```typescript
export const useCommandProcessor = () => {
  const sendCommand = useMutation(api.gameActions.sendCommand);

  const processCommand = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (trimmed === "") return;

    await sendCommand({ command: trimmed });
  }, [sendCommand]);

  return { processCommand };
};
```

### 10. Update `GameTerminal` Component

```typescript
const GameTerminal = () => {
  const terminalOutputs = useQuery(api.gameActions.getTerminalOutput);
  const { processCommand } = useCommandProcessor();

  // Convert DB records to display format
  const output = terminalOutputs?.flatMap(o => [
    `> ${o.commandInput}`,
    ...o.outputLines,
  ]) || [];

  // Real-time updates handled by useQuery subscription
  // ...
};
```

## Benefits

1. ✅ All game logic server-side (single transaction)
2. ✅ Real-time updates via Convex subscriptions
3. ✅ Command history persisted and queryable
4. ✅ Async commands don't block UI
5. ✅ No injected function props needed
6. ✅ Follows Convex chat tutorial pattern exactly
7. ✅ Easy to add command replay/history features

## Migration Steps

1. Add `terminalOutput` table to the schema (done).
2. Implement `sendCommand` with server-side cache lookup before scheduling async work.
3. Build `executeAsyncCommand`, `writeCommandOutput`, `persistCommandGameState`, and related helpers.
4. Refactor `useCommandProcessor` to trim input and call `sendCommand` directly.
5. Update `GameTerminal` to rely solely on Convex queries for output history.
6. Remove client-side `parseCommand` logic once server coverage is complete.
7. Regression-test sync + async commands end-to-end.

This keeps reads in queries, limits actions to external work, and lets Convex's sync engine drive the UI per the Zen guidelines.
