---
ssot-area: player-actions
owner: game-systems-team
derived-from: game-architecture-template
---

# HOWTO: Add an Async Command

Follow this pattern when a terminal command needs background processing—network calls, long-running simulations, or AI references—but does not directly call an agent yet.

## When to Choose This Pattern

- The command requires work that should not block the `sendCommand` mutation.
- You plan to update the terminal output after another function completes.
- The flow should support mission validation and cache/storage updates once the job finishes.

## Key Entry Points

- `convex/gameActions.ts:54` — `sendCommand` mutation detects async verbs and schedules follow-up work.
- `convex/gameActions.ts:527` — Add the command to `ASYNC_COMMANDS` so it is routed correctly.
- `convex/gameActions.ts:194` — `executeAsyncCommand` internal action orchestrates background execution.
- ⭐ **`finalizeCommandOutput` mutation** — **RECOMMENDED**: Atomic mutation combining mission validation + output update + game state update (see story: `docs/feature-requests/combine-mission-feedback-with-output.md`)
- 🔧 **Legacy helpers** (being phased out):
  - `convex/gameActions.ts:540` — `collectMissionFeedback` (use inline validation in atomic mutation instead)
  - `convex/gameActions.ts:328` — `writeCommandOutput` (keep for error cases only)
  - `convex/gameActions.ts:348` — `persistCommandGameState` (keep for non-async paths only)

## Implementation Steps

1. **Register the Command as Async**
   - Append the verb (e.g., `scan`) to the `ASYNC_COMMANDS` set in `gameActions.ts`.

2. **Seed a Placeholder Output**
   - In `sendCommand`, reuse the existing `Processing...` insert or customize per command if needed.
   - Store the returned `outputId`; you will patch it later.

3. **Schedule the Background Action**
   - Extend `executeAsyncCommand` with a new `case "scan":` branch.
   - Extract and normalize command arguments (`target`, flags, etc.) before invoking downstream logic.
   - Call the supporting mutation/action and capture its result.

4. **⭐ Finalize Output (RECOMMENDED - Atomic Pattern)**

   Use the atomic `finalizeCommandOutput` mutation to combine all operations in a single transaction:

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

   **Benefits**:
   - ✅ Atomic transaction (no partial updates)
   - ✅ 50% cost reduction (2 function calls vs 4)
   - ✅ 30-50ms faster
   - ✅ Follows Convex Zen principles (see CLAUDE.md:123-131)

   **Why This Works**: The `finalizeCommandOutput` mutation inlines all operations (mission validation, output update, game state update) directly within a single mutation. This avoids sub-transactions created by calling `ctx.runMutation` multiple times.

5. **🔧 Legacy Pattern (Being Phased Out)**

   > ⚠️ **DEPRECATED**: This multi-call pattern breaks atomicity and costs more. Use `finalizeCommandOutput` instead (see step 4).
   >
   > Only use this pattern if `finalizeCommandOutput` is not yet implemented in your branch.

   <details>
   <summary>Click to expand legacy pattern (not recommended)</summary>

   **Write Final Output**:
   - Combine the primary result with the `collectMissionFeedback` output before writing to the terminal record.
   - Use `ctx.runMutation(internal.gameActions.writeCommandOutput, {...})` to replace the placeholder lines and success flag.

   **Persist State Changes**:
   - Call `persistCommandGameState` with any skill deltas, thread IDs, or other fields that should update the player's record.
   - Omit `skillDelta` or `toolSessionId` if not applicable.

   ```typescript
   // ❌ LEGACY - Not atomic, costs more
   const { appendLines, totalSkillGained } = await collectMissionFeedback(
     ctx,
     args.playerId,
     args.command,
     { includeNoMissionMessage: true }
   );

   await ctx.runMutation(internal.gameActions.writeCommandOutput, {
     playerId: args.playerId,
     gameStateId: args.gameStateId,
     commandInput: args.command,
     outputLines: [...result.output, ...appendLines],
     commandType: args.commandType,
     success: result.success,
     outputId: args.outputId,
   });

   await ctx.runMutation(internal.gameActions.persistCommandGameState, {
     gameStateId: args.gameStateId,
     skillDelta: result.success ? result.skillGained + totalSkillGained : 0,
     toolSessionId: result.threadId ?? gameState.toolSessionId,
   });
   ```

   </details>

6. **Graceful Error Handling**
   - Wrap the branch in `try/catch` when external dependencies are involved.
   - Use `writeCommandOutput` for error cases (this is still the correct pattern for failures).
   - Example pattern:

     ```typescript
     } catch (error) {
       console.error("scan command error", error);
       await ctx.runMutation(internal.gameActions.writeCommandOutput, {
         playerId: args.playerId,
         gameStateId: args.gameStateId,
         commandInput: args.command,
         outputLines: [
           "scan: unable to complete request",
           "Please verify connectivity and retry.",
         ],
         commandType: args.commandType,
         success: false,
         outputId: args.outputId,
       });
       return;
     }
     ```

7. **Optional: Command-Specific Storage**
   - If the command produces data needed later (logs, artifacts), insert into dedicated tables inside the async branch.

## ⚠️ Transaction Atomicity Principles

**CRITICAL**: Async command finalization must be atomic. **NEVER call multiple mutations sequentially** - this creates sub-transactions that break atomicity.

### Quick Summary

**Anti-pattern** (4+ function calls, broken atomicity):

```typescript
// ❌ WRONG - Multiple mutations break atomicity
const { appendLines } = await collectMissionFeedback(ctx, ...);
await ctx.runMutation(internal.gameActions.writeCommandOutput, { ... });
await ctx.runMutation(internal.gameActions.persistCommandGameState, { ... });
```

**Correct pattern** (1 function call, true atomicity):

```typescript
// ✅ CORRECT - Single mutation with all operations inline
await ctx.runMutation(internal.gameActions.finalizeCommandOutput, {
  commandResult: result,
  // Mutation inlines: mission validation + output update + game state update
});
```

### Implementation Note

The `finalizeCommandOutput` mutation must inline all operations:

- Mission validation via `validateMissionStepInternal` helper
- Output update via direct `ctx.db.patch`
- Game state update via direct `ctx.db.patch`
- **NO `ctx.runMutation` or `ctx.runQuery` calls within the mutation**

### Full Documentation

See **`docs/convex-howtos/transaction-atomicity.md`** for:

- Complete anti-pattern vs correct pattern examples
- Full `finalizeCommandOutput` implementation
- Detailed explanation of sub-transaction problems
- Implementation guidelines and checklist
- References to CLAUDE.md best practices

---

## Verification Checklist

- [ ] Verb is listed in `ASYNC_COMMANDS` and omitted from the sync switch.
- [ ] `sendCommand` inserts a placeholder output and schedules the internal action.
- [ ] ⭐ **Async branch uses `finalizeCommandOutput` for atomic completion** (recommended).
- [ ] `finalizeCommandOutput` inlines all operations (NO `ctx.runMutation` within it).
- [ ] Mission validation runs and appends feedback on success.
- [ ] Errors are logged and surfaced with actionable messaging.
- [ ] Error paths use `writeCommandOutput` with friendly output, `success: false`.
- [ ] Any new tables or indexes are documented and covered by schema tests.
- [ ] Function call count is minimized (2 calls: action + finalize mutation).
- [ ] Code review confirms zero `ctx.runMutation` in finalization mutation.

## Related References

- `docs/player-action-howtos/sync-commands.md` — For commands that can remain synchronous.
- `docs/player-action-howtos/ai-commands.md` — When async commands also need agent-driven generation.
- `docs/feature-requests/combine-mission-feedback-with-output.md` — Story for implementing `finalizeCommandOutput` mutation.
- `docs/feature-requests/atomic-cache-hit-mutation.md` — Related story for cache hit path optimization.
