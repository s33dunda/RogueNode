---
ssot-area: player-actions
owner: game-systems-team
derived-from: game-architecture-template
---

# HOWTO: Add a Synchronous Command

Use this guide when a terminal command should execute entirely inside the `sendCommand` mutation without background work or AI calls (e.g., `help`, `look`, `tools`).

## When to Choose This Pattern

- The command outputs deterministic information drawn from the current Convex documents.
- Players must see the result immediately, without waiting for async scheduling.
- No external services, long-running tasks, or AI agents are required.

## Key Entry Points

- `convex/gameActions.ts:54` — `sendCommand` mutation routes every terminal input.
- `convex/gameActions.ts:577` — `ASYNC_COMMANDS` controls which verbs are handled elsewhere.
- `convex/gameActions.ts:666` — `processSyncCommand` houses the switch statement for synchronous verbs.

## Implementation Steps

1. **Name Your Command**
   - Choose the canonical lowercase verb players will type (e.g., `status`).
   - Ensure it does **not** appear in `ASYNC_COMMANDS`; remove it if a previous implementation existed.

2. **Add Switch Case Logic** (`processSyncCommand`)
   - Insert a new `case "status":` block.
   - Use the supplied `gameState` (`Doc<"gameState">`) to build the output lines.
   - Return `{ outputLines, success: true }` on success; set `success: false` with helpful messaging on failure.
   - Keep output line arrays short and narrative—each string becomes a terminal row.

3. **Share Helper Utilities**
   - If the command needs reusable formatting, create a helper near `buildLookOutput`/`buildToolsOutput` and export only if reused elsewhere.
   - Prefer deriving data from authoritative sources (`rooms`, `enemies`, `missions`) instead of duplicating constants.

4. **Handle Errors Gracefully**
   - Wrap non-trivial logic in `try/catch` and return a friendly failure response.
   - Always return `{ outputLines, success: false }` with instructional messaging instead of raw stack traces.
   - Example response block:

     ```ts
     return {
       outputLines: [
         "status: command failed",
         "An unexpected error occurred. Try again or contact support.",
       ],
       success: false,
     };
     ```

5. **Update Mission Expectations (Optional)**
   - If missions should react to the new command, update the relevant domain spec or mission validation logic so `validateAllMissionSteps` can match the new verb.

6. **Commit to Documentation**
   - Note the new command in player-facing docs or tooltips if required.

## Verification Checklist

- [ ] Command returns output immediately via `sendCommand` without scheduling.
- [ ] Success flag correctly reflects the outcome for mission validation.
- [ ] Output formatting matches existing commands (no empty strings other than intentional blank lines).
- [ ] Unit/integration tests (if available) cover the new branch or helper.
- [ ] Documentation/tooltips updated if the command should appear in help listings.
- [ ] Error branches return user-friendly text and set `success: false` (no raw stack traces).

## Related References

- `convex/gameData.ts` — Access canonical rooms, enemies, and tools.
- `docs/player-action-howtos/async-commands.md` — Upgrade path if the command later needs deferred execution.
