# RogueNode POV: PDDL-Driven Game Integration

**Goal**: Wire PDDL planner artifacts (domains, problems, plans) into the game runtime so missions are automatically validated against generated optimal solutions.

---

## Implementation Checklist

### 1. Shared Runtime Loader

**File**: `packages/domain-spec/runtime.ts`

- Export parsed bundles: rooms, items, enemies, missions + generated plan JSON
- Single source of truth for both Convex backend and Next.js client
- Import in `convex/gameActions.ts` and `utils/GameData.ts`

**Deliverable**: Runtime state loads directly from canonical spec files.

---

### 2. Plan-Aware Mission Objects

**Files**: Mission definitions in `packages/domain-spec/data.ts`

- Extend mission schema to include:
  - `problemRef`: Link to PDDL problem file
  - `optimalPlan`: Array of expected action steps from planner output
  - `_meta`: Solver metadata (domain version, planner used, etc.)

**Deliverable**: Missions carry their own validation blueprint.

---

### 3. Problem State Initialization

**File**: `convex/gameActions.ts` (or new `convex/missions.ts`)

- On mission start: Load `problemRef` to set initial game state
- Mirror PDDL initial conditions (switches, flags, object positions)
- Ensure in-game world matches planner scenario

**Deliverable**: Dynamic state initialization from PDDL problems.

---

### 4. Step Validation Hook

**File**: `convex/gameActions.ts`

- Add mutation: `validateStep(missionId, playerCommand)`
- Compare player input against next step in `optimalPlan`
- Record success/failure, update progress pointer
- Award skill points/tips for correct steps
- Flag divergence for hints or fail states

**Deliverable**: Real-time validation against optimal plan.

---

### 5. UI Progress Feedback

**Files**: React components (e.g., `components/MissionProgress.tsx`)

- Display progress bar showing completed vs. total steps
- Optional hints panel showing next expected action
- Read from mission's `optimalPlan` array
- Toggle visibility based on player preference

**Deliverable**: Visual feedback tied to plan progress.

---

### 6. CI Automation Check

**File**: `.github/workflows/validate-plans.yml` (or npm script)

- Run `pnpm planning:refresh --dry-run` in CI
- Verify runtime bundle stays in sync with spec
- Parse enriched plan data to catch schema drift
- Optional: Snapshot mission objects for regression testing

**Deliverable**: Automated validation that plans remain parseable.

---

### 7. Developer Documentation

**File**: `docs/mission-authoring.md` (or update existing docs)

Document:

- How missions reference plan files
- How to add new scenarios:
  1. Edit `packages/domain-spec/data.ts`
  2. Run `pnpm planning:refresh`
  3. Verify plan JSON appears in output
- How runtime code consumes planner output
- Troubleshooting common issues

**Deliverable**: Clear guide for adding/maintaining missions.

---

## Success Criteria

✅ Author a mission once in `data.ts`
✅ Run `pnpm planning:refresh` to generate plans
✅ Game automatically knows domain, problem state, and winning plan
✅ Player actions validated against optimal solution in real-time
✅ No manual duplication of mission logic

---

## Out of Scope (POV Phase)

- Advanced hint systems (e.g., partial credit for near-miss commands)
- Multi-path solutions (only optimal plan validated)
- Persistent player analytics/leaderboards
- Visual plan editor UI

---

## Technical Notes

- **PDDL Planner**: Assumes planner output is JSON-serializable action sequences
- **State Sync**: Game state must use same predicates as PDDL domain
- **Error Handling**: Gracefully handle missing/malformed plan files
- **Performance**: Cache parsed plans in Convex for fast lookups

---

**Next Step**: Developer implements checklist items 1-4 first (core runtime integration), then adds UI/CI/docs (items 5-7).
