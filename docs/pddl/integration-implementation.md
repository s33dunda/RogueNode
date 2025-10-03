---
ssot-area: pddl-integration
owner: runtime-team
derived-from: packages/domain-spec/data.ts
---

# PDDL Game Integration - Implementation Guide

**Status**: Ready for Development
**Reviewed Against**: Convex Best Practices (llmstxt/convex_dev_llms_txt)

---

## Architecture Decisions

### Convex-Aligned Patterns

1. **Helper Functions First**: Core logic in `packages/domain-spec/runtime.ts`, thin Convex wrappers
2. **Internal Functions**: Use `internalQuery`/`internalMutation` for mission logic, public functions for auth
3. **Batch Operations**: Single mutation for step validation (not sequential calls)
4. **Type Safety**: All Convex functions use proper validators (eliminate `v.any()`)
5. **Schema-First**: Extend existing schema with mission progress tracking

### New Database Tables

```typescript
// Add to convex/schema.ts
missionProgress: defineTable({
  playerId: v.string(),
  gameStateId: v.id("gameState"),
  missionId: v.string(),
  currentStepIndex: v.number(),
  completedSteps: v.array(v.object({
    stepIndex: v.number(),
    playerCommand: v.string(),
    expectedAction: v.string(),
    matched: v.boolean(),
    timestamp: v.number(),
  })),
  status: v.union(
    v.literal("not_started"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("failed")
  ),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_player_mission", ["playerId", "missionId"])
  .index("by_gameState", ["gameStateId"])
```

---

## Implementation Steps

### Step 1: Shared Runtime Loader

**File**: `packages/domain-spec/runtime.ts`

**Purpose**: Single source of truth for game data + plan artifacts

```typescript
import { domainData, missionList, missionPlans } from "./data";
import type { MissionSpec, PlanStepSpec } from "./schema";

/**
 * Runtime bundle - import this in both Convex and client code
 */
export const runtime = {
  domain: domainData,
  missions: missionList,
  plans: missionPlans,
} as const;

/**
 * Get mission by ID with type safety
 */
export function getMissionById(missionId: string): MissionSpec | undefined {
  return missionList.find((m) => m.id === missionId);
}

/**
 * Get optimal plan for a mission
 */
export function getMissionPlan(missionId: string): PlanStepSpec[] {
  const mission = getMissionById(missionId);
  return mission?.optimalPlan ?? [];
}

/**
 * Check if player command matches expected plan step
 */
export function matchesStep(
  playerCommand: string,
  expectedStep: PlanStepSpec
): boolean {
  const normalized = playerCommand.trim().toLowerCase();
  const [action, ...targetParts] = normalized.split(/\s+/);
  const target = targetParts.join(" ");

  const actionMatches = action === expectedStep.action.toLowerCase();
  const targetMatches = !expectedStep.target ||
    target === expectedStep.target.toLowerCase();

  return actionMatches && targetMatches;
}
```

**Deliverable**: Runtime module that both Convex and Next.js can import

---

### Step 2: Update GameData.ts to Use Runtime

**File**: `utils/GameData.ts`

**Changes**:

```typescript
import { runtime } from "../packages/domain-spec/runtime";

// Replace existing imports
export const rooms: RoomsRecord = runtime.domain.rooms.reduce((acc, room) => {
  acc[room.id] = room as Room;
  return acc;
}, {} as RoomsRecord);

export const enemies = runtime.domain.enemies;
export const missions = runtime.missions;

// Add mission helpers
export function getMissionForRoom(roomId: string) {
  return missions.find(m => m.entryRoomId === roomId);
}
```

**Deliverable**: Client code uses canonical runtime bundle

---

### Step 3: Mission Progress Tracking (Convex)

**File**: `convex/missions.ts` (new file)

**Purpose**: Internal mission logic following Convex patterns

```typescript
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { getMissionById, getMissionPlan, matchesStep } from "../packages/domain-spec/runtime";

/**
 * Internal query: Get mission progress for player
 */
export const getMissionProgress = internalQuery({
  args: {
    playerId: v.string(),
    missionId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("missionProgress"),
      playerId: v.string(),
      gameStateId: v.id("gameState"),
      missionId: v.string(),
      currentStepIndex: v.number(),
      completedSteps: v.array(v.object({
        stepIndex: v.number(),
        playerCommand: v.string(),
        expectedAction: v.string(),
        matched: v.boolean(),
        timestamp: v.number(),
      })),
      status: v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("failed")
      ),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { playerId, missionId }) => {
    return await ctx.db
      .query("missionProgress")
      .withIndex("by_player_mission", (q) =>
        q.eq("playerId", playerId).eq("missionId", missionId)
      )
      .first();
  },
});

/**
 * Internal mutation: Start a mission
 */
export const startMission = internalMutation({
  args: {
    playerId: v.string(),
    gameStateId: v.id("gameState"),
    missionId: v.string(),
  },
  returns: v.id("missionProgress"),
  handler: async (ctx, { playerId, gameStateId, missionId }) => {
    // Check if already started
    const existing = await ctx.db
      .query("missionProgress")
      .withIndex("by_player_mission", (q) =>
        q.eq("playerId", playerId).eq("missionId", missionId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new progress tracker
    return await ctx.db.insert("missionProgress", {
      playerId,
      gameStateId,
      missionId,
      currentStepIndex: 0,
      completedSteps: [],
      status: "in_progress",
      startedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation: Validate player step against plan
 */
export const validateMissionStep = internalMutation({
  args: {
    playerId: v.string(),
    missionId: v.string(),
    playerCommand: v.string(),
  },
  returns: v.object({
    matched: v.boolean(),
    expectedAction: v.string(),
    feedback: v.array(v.string()),
    missionComplete: v.boolean(),
    skillGained: v.number(),
  }),
  handler: async (ctx, { playerId, missionId, playerCommand }) => {
    const progress = await ctx.db
      .query("missionProgress")
      .withIndex("by_player_mission", (q) =>
        q.eq("playerId", playerId).eq("missionId", missionId)
      )
      .first();

    if (!progress || progress.status !== "in_progress") {
      return {
        matched: false,
        expectedAction: "",
        feedback: ["No active mission found. Start a mission first."],
        missionComplete: false,
        skillGained: 0,
      };
    }

    const plan = getMissionPlan(missionId);
    if (plan.length === 0) {
      return {
        matched: false,
        expectedAction: "",
        feedback: ["Mission has no validation plan."],
        missionComplete: false,
        skillGained: 0,
      };
    }

    const currentStep = plan[progress.currentStepIndex];
    if (!currentStep) {
      return {
        matched: false,
        expectedAction: "",
        feedback: ["Mission already complete."],
        missionComplete: true,
        skillGained: 0,
      };
    }

    const matched = matchesStep(playerCommand, currentStep);
    const nextStepIndex = matched ? progress.currentStepIndex + 1 : progress.currentStepIndex;
    const missionComplete = matched && nextStepIndex >= plan.length;

    // Record step attempt
    await ctx.db.patch(progress._id, {
      currentStepIndex: nextStepIndex,
      completedSteps: [
        ...progress.completedSteps,
        {
          stepIndex: progress.currentStepIndex,
          playerCommand,
          expectedAction: currentStep.action,
          matched,
          timestamp: Date.now(),
        },
      ],
      status: missionComplete ? "completed" : "in_progress",
      completedAt: missionComplete ? Date.now() : undefined,
    });

    const feedback = matched
      ? [
          `✓ Correct! ${currentStep.description}`,
          missionComplete
            ? "Mission complete! Well done."
            : `Next step: ${plan[nextStepIndex]?.description ?? "Unknown"}`,
        ]
      : [
          `✗ Not quite. Expected: ${currentStep.action} ${currentStep.target ?? ""}`,
          `Hint: ${currentStep.description}`,
        ];

    return {
      matched,
      expectedAction: `${currentStep.action} ${currentStep.target ?? ""}`.trim(),
      feedback,
      missionComplete,
      skillGained: matched ? 10 : 0,
    };
  },
});
```

**Deliverable**: Internal mission logic with proper Convex patterns

---

### Step 4: Public Mission API (Convex)

**File**: `convex/gameActions.ts` (extend existing)

**Add these public functions**:

```typescript
import { internal } from "./_generated/api";

/**
 * Public mutation: Start a mission (with auth)
 */
export const startMission = mutation({
  args: { missionId: v.string() },
  returns: v.object({
    missionProgressId: v.id("missionProgress"),
    mission: v.object({
      id: v.string(),
      title: v.string(),
      synopsis: v.string(),
    }),
  }),
  handler: async (ctx, { missionId }) => {
    const identity = await requireAuth(ctx);
    const gameState = await loadPlayerGameState(ctx, identity.subject);

    const missionProgressId = await ctx.runMutation(
      internal.missions.startMission,
      {
        playerId: identity.subject,
        gameStateId: gameState._id,
        missionId,
      }
    );

    const mission = getMissionById(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }

    return {
      missionProgressId,
      mission: {
        id: mission.id,
        title: mission.title,
        synopsis: mission.synopsis,
      },
    };
  },
});

/**
 * Public query: Get active missions for current room
 */
export const getActiveMissions = query({
  args: {},
  returns: v.array(v.object({
    id: v.string(),
    title: v.string(),
    synopsis: v.string(),
    status: v.union(
      v.literal("available"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
  })),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const gameState = await loadPlayerGameState(ctx, identity.subject);

    const missions = runtime.missions.filter(
      m => m.entryRoomId === gameState.currentRoom
    );

    const result = [];
    for (const mission of missions) {
      const progress = await ctx.runQuery(
        internal.missions.getMissionProgress,
        {
          playerId: identity.subject,
          missionId: mission.id,
        }
      );

      result.push({
        id: mission.id,
        title: mission.title,
        synopsis: mission.synopsis,
        status: progress?.status === "completed"
          ? "completed"
          : progress?.status === "in_progress"
          ? "in_progress"
          : "available",
      });
    }

    return result;
  },
});
```

**Deliverable**: Auth-protected public API for missions

---

### Step 5: Integrate Validation into Command Flow

**File**: `convex/gameActions.ts` (modify `executeAsyncCommand`)

**Add mission validation after command execution**:

```typescript
// Inside executeAsyncCommand, after successful command execution:
case "ping": {
  const result = await ctx.runAction(
    internal.agents.pingAgent.executePingCommand,
    { target, gameState, threadId: gameState.toolSessionId }
  );

  // NEW: Check if this command advances any active mission
  const missionValidation = await ctx.runMutation(
    internal.missions.validateMissionStep,
    {
      playerId: args.playerId,
      missionId: "ping-tutorial", // TODO: Get from active mission
      playerCommand: args.command,
    }
  );

  const outputLines = [
    ...result.output,
    "",
    ...missionValidation.feedback,
  ];

  await ctx.runMutation(internal.gameActions.writeCommandOutput, {
    playerId: args.playerId,
    gameStateId: args.gameStateId,
    commandInput: args.command,
    outputLines,
    commandType: args.commandType,
    success: result.success,
    outputId: args.outputId,
  });

  await ctx.runMutation(internal.gameActions.persistCommandGameState, {
    gameStateId: args.gameStateId,
    skillDelta: result.skillGained + missionValidation.skillGained,
    toolSessionId: result.threadId ?? gameState.toolSessionId,
  });
  break;
}
```

**Deliverable**: Commands automatically validate against active missions

---

## Testing Checklist

- [ ] Runtime module exports missions and plans correctly
- [ ] `getMissionById` returns correct mission data
- [ ] `matchesStep` correctly validates player commands
- [ ] `startMission` creates progress tracker
- [ ] `validateMissionStep` records attempts and advances progress
- [ ] Mission completion triggers skill point award
- [ ] Failed steps provide helpful hints
- [ ] Multiple missions can be tracked simultaneously
- [ ] Schema migration runs without errors

---

## Future Enhancements (Post-POV)

- Multi-path solution support (not just optimal plan)
- Partial credit for near-miss commands
- Mission hints system based on failed attempts
- Leaderboard for optimal completion times
- Visual mission progress UI component

---

## Notes

- All mission data flows from `packages/domain-spec/runtime.ts`
- Convex functions use proper validators (no `v.any()`)
- Internal functions handle logic, public functions handle auth
- Mission validation happens automatically during command execution
- Plan regeneration via `pnpm planning:refresh` updates runtime automatically
