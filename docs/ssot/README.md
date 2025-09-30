# RogueNode SSOT Starter

This slim index tracks the minimum artifacts we must keep in sync while we shape the MVP: define the game verbs, spin out solvable problems, surface them in the app. Start edits at the canonical source listed here, then manually sync downstream files until generators/CI land.

## Core Truths Today

### 1. Domain Verbs & State

- **Canonical artifact:** `utils/GameData.ts` (rooms, items, command wiring) paired with shared types from `convex/types`.
- **Used by:** Convex action handlers (`convex/gameActions.ts`) and client processors (`lib/hooks/useCommandProcessor.ts`).
- **How to update:** edit `GameData.ts` (add rooms/items/command hooks), ensure Convex types stay aligned, run targeted tests or manual playtest in the app.
- **Planned next step:** extract this into `packages/domain-spec/` with codegen, but for now treat `GameData.ts` as the single editable source.

### 2. Scenario Seeds & Plans

- **Canonical artifact:** PDDL domain/problem files under `../RogueNodeScenarios/` (`domains/rogue-devops-poc-domain.pddl`, `problems/*/problem.pddl`). These set up machine-solvable missions.
- **Used by:** Fast Downward scripts for solution steps (`../RogueNodeScenarios/scripts/plan_fd.py`) and any plan JSON fed back into the game.
- **How to update:** author or tweak PDDL, run `devbox run -- python scripts/plan_fd.py ...` to regenerate `plan.json`, then import the resulting steps into gameplay data.
- **Planned next step:** generate PDDL from the domain spec once that package exists.

### 3. Runtime Surfacing

- **Canonical artifact:** the Convex + Next.js glue that exposes problems to players: `convex/gameActions.ts`, `lib/hooks/useCommandProcessor.ts`, and UI state under `app/`.
- **Used by:** Player sessions—these files are the runtime truth for how missions show up and how commands execute.
- **How to update:** keep these files aligned with the domain data and imported plan outputs; test via the local app (`pnpm dev`).

## Working Loop

1. **Shape the mission** in `GameData.ts` (rooms, tools, win conditions) and, when needed, extend types in `convex/types`.
2. **Describe the automation** by editing/adding a PDDL problem; run the planner to produce a fresh `plan.json`.
3. **Load the experience** by wiring the plan/mission into Convex actions + React hooks so the player can attempt the solution path.
4. **Document intent** briefly in the PR description (or drop an ADR if the change is significant); update this file if a new canonical artifact appears.

This starter list will grow into the full SSOT map once the schema packages and generators are in place. Keep it light, keep it accurate.
