---
ssot-area: pddl-integration
owner: runtime-team
derived-from: convex/domainSpec/data.ts
---

# PDDL Integration - Developer Quickstart

**Goal**: Wire PDDL planner artifacts into game runtime for automatic mission validation

**Time Estimate**: 4-6 hours for core implementation

---

## 📚 Required Reading

1. **Implementation Guide**: `docs/pddl-integration-implementation.md` (detailed code)
2. **Review Document**: `docs/pddl-integration-review.md` (Convex best practices)
3. **Original Plan**: `docs/pddl-game-integration-pov.md` (high-level overview)

---

## 🚀 Quick Start (6 Steps)

### Step 1: Verify Runtime Loader (5 min)

**File**: `convex/domainSpec/runtime.ts` (canonical source)

**Important**: `convex/domainSpec/` is the canonical source for domain specifications. Convex functions import directly from this location.

**Test**:

```typescript
import { runtime, getMissionById, matchesStep } from "./convex/domainSpec/runtime";
console.log(runtime.missions); // Should show mission list
console.log(getMissionById("ping-tutorial")); // Should return mission object
```

---

### Step 2: Create Backend Game Data (15 min)

**File**: `convex/gameData.ts`

**Changes**:

- Create backend-only game data module
- Import from `convex/domainSpec/` (not `packages/`)
- Replace old `utils/GameData.ts`

**Copy code from**: `docs/pddl-integration-implementation.md` → Step 2

**Test**:

```bash
pnpm dev
# Check Convex compilation - no import errors
```

---

### Step 3: Add Schema Migration (10 min)

**File**: `convex/schema.ts`

**Add**:

```typescript
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

**Test**:

```bash
pnpm dev:backend
# Check Convex dashboard - table should appear
```

---

### Step 4: Create Mission Functions (2 hours)

**File**: `convex/missions.ts` (new file)

```bash
touch convex/missions.ts
```

**Copy code from**: `docs/pddl-integration-implementation.md` → Step 3

**Functions to implement**:

- `getMissionProgress` (internalQuery)
- `startMission` (internalMutation)
- `validateMissionStep` (internalMutation)

**Test**:

```bash
# In Convex dashboard, run:
# internal.missions.startMission({ playerId: "test", gameStateId: "...", missionId: "ping-tutorial" })
```

---

### Step 5: Add Public API (1 hour)

**File**: `convex/gameActions.ts`

**Add functions**:

- `startMission` (public mutation with auth)
- `getActiveMissions` (public query with auth)

**Copy code from**: `docs/pddl-integration-implementation.md` → Step 4

**Test**:

```bash
# In browser console:
# await convex.mutation(api.gameActions.startMission, { missionId: "ping-tutorial" })
```

---

### Step 6: Integrate Validation (1 hour)

**File**: `convex/gameActions.ts`

**Modify**: `executeAsyncCommand` function

**Add**: Mission validation after command execution

**Copy code from**: `docs/pddl-integration-implementation.md` → Step 5

**Test**:

```bash
# In game terminal:
# > ping main-server
# Should see mission feedback in output
```

---

## 🧪 Testing Checklist

After each step, verify:

- [ ] **Step 1**: Runtime exports work in Convex functions
- [ ] **Step 2**: `convex/gameData.ts` imports from `convex/domainSpec/` successfully
- [ ] **Step 3**: `missionProgress` table appears in Convex dashboard
- [ ] **Step 4**: Can create mission progress via internal functions
- [ ] **Step 5**: Can start mission via public API (with auth)
- [ ] **Step 6**: Commands trigger mission validation

**Full E2E Test**:

1. Start game → Initialize game state
2. Run `ping main-server` → Should see mission feedback
3. Check Convex dashboard → `missionProgress` record created
4. Verify skill points awarded

---

## 🔧 Common Issues

### Issue: Import errors in Convex

**Symptom**: `Cannot find module './domainSpec/runtime'`

**Cause**: Missing or incorrect import path

**Fix**: Ensure imports use the correct path from `convex/domainSpec/`

```typescript
// Correct import in Convex functions
import { runtime, getMissionById } from "./domainSpec/runtime";
```

**Verify**: Check that `convex/domainSpec/` exists with all required files

---

### Issue: Schema validation errors

**Symptom**: `Invalid value for field 'status'`

**Fix**: Ensure all status values match schema union

```typescript
status: v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("failed")
)
```

---

### Issue: Mission not found

**Symptom**: `getMissionById` returns `undefined`

**Fix**: Check mission ID matches exactly

```typescript
// In data.ts
missionSchema.parse({
  id: "ping-tutorial", // Must match exactly
  ...
})
```

---

## 📊 Success Metrics

After implementation, you should see:

1. **Database**: `missionProgress` records created when missions start
2. **Terminal**: Mission feedback appears after commands
3. **Skill Points**: Awarded for correct steps
4. **Convex Dashboard**: No errors in function logs

---

## 🎯 POV Scope Reminder

**In Scope**:

- ✅ Single mission validation (`ping-tutorial`)
- ✅ Optimal plan checking
- ✅ Basic feedback (correct/incorrect)
- ✅ Skill point awards

**Out of Scope** (Post-POV):

- ❌ Multi-path solutions
- ❌ Partial credit for near-miss commands
- ❌ Advanced hint system
- ❌ Visual progress UI
- ❌ Leaderboards

---

## 🆘 Need Help?

1. **Convex Patterns**: Review `docs/pddl-integration-review.md` → "Convex Anti-Patterns Avoided"
2. **Type Errors**: Check `docs/pddl-integration-implementation.md` → function signatures
3. **Schema Issues**: Verify against `convex/schema.ts` examples
4. **Runtime Errors**: Check Convex dashboard function logs

---

## 📝 Implementation Order

**Recommended sequence** (minimize risk):

1. ✅ **Step 1** (Runtime Loader) - Pure TypeScript, no dependencies
2. ✅ **Step 2** (GameData.ts) - Simple refactor, low risk
3. ✅ **Step 3** (Schema) - Database change, test in dev first
4. ✅ **Step 4** (Internal Functions) - Core logic, test via dashboard
5. ✅ **Step 5** (Public API) - Auth layer, test via browser
6. ✅ **Step 6** (Integration) - Final wiring, test E2E

**Total Time**: ~4-6 hours (including testing)

---

## 🎉 Done

Once all steps complete:

1. Run `pnpm planning:refresh` to regenerate plans
2. Test full mission flow in game
3. Verify skill points awarded
4. Check Convex dashboard for errors

**Next**: Add more missions by editing `convex/domainSpec/data.ts` and running `pnpm planning:refresh`
