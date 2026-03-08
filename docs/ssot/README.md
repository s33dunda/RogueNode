# RogueNode SSOT Starter

This slim index tracks the minimum artifacts we must keep in sync while we shape the MVP: define the game verbs, spin out solvable problems, surface them in the app. Start edits at the canonical source listed here, then manually sync downstream files until generators/CI land.

## Core Truths Today

### 1. Domain Verbs & State

- **Canonical artifact:** `convex/domainSpec/schema.ts` (Zod validators for rooms, items, enemies, missions) with the parsed data + tool catalog in `convex/domainSpec/data.ts`.
- **Runtime data:** `convex/gameData.ts` imports from `convex/domainSpec/` for backend usage.
- **Used by:** Convex action handlers (`convex/gameActions.ts`) and mission validation (`convex/missions.ts`).
- **How to update:** extend the schema first (new fields, mission hooks, plan metadata), then adjust `gameData.ts` and downstream code to satisfy the updated contracts.

### 2. Scenario Seeds & Plans

- **Canonical artifacts:** `pddl/planning.ts` (planner verbs), derived PDDL under `pddl/generated/` (`domains/*.pddl`, `problems/*/problem.pddl`), and the runtime-imported `plan.json` files under `convex/domainSpec/pddl/problems/*/`.
- **Used by:** Planner scripts (`scripts/generate-pddl-llm.mjs`, `scripts/plan_fd.py`, `scripts/run-planning.mjs`) and runtime code that imports the solved plan JSON from `convex/domainSpec/data.ts`.
- **How to update:** run `pnpm planning:refresh`; it should generate/update `.pddl` files in `pddl/generated/`, validate them with Fast Downward, and then sync `plan.json` into `convex/domainSpec/pddl/problems/`. See `docs/pddl/planning-workflow.md` for the current flow.
- **Planned next step:** expand missions and surface additional plan metadata in the UI.

### 3. Runtime Surfacing

- **Canonical artifact:** the Convex + Next.js glue that exposes problems to players: `convex/gameActions.ts`, `lib/hooks/useCommandProcessor.ts`, and UI state under `app/`.
- **Used by:** Player sessions—these files are the runtime truth for how missions show up and how commands execute.
- **How to update:** keep these files aligned with the domain data and imported plan outputs; test via the local app (`pnpm dev`).
- **Implementation patterns:** `docs/player-action-howtos/` contains HOWTOs for adding synchronous commands, async commands, and AI-driven commands. Follow these guides when implementing new terminal commands to maintain consistent patterns.

### 4. Backend Patterns

- **Canonical artifact:** `docs/convex-howtos/` - Reusable Convex backend patterns extracted from implementation stories and best practices.
- **Derived from:** Convex best practices (CLAUDE.md), completed implementation stories (`feature-requests/`), canonical code (`convex/`).
- **Used by:** All backend development - referenced by `player-action-howtos/` and new feature implementations.
- **How to update:** Extract patterns from completed stories; link to canonical code examples; maintain front-matter metadata (`ssot-area: convex-patterns`, `derived-from:`, `canonical-examples:`).
- **Owner:** backend-team
- **Key patterns:**
  - **Transaction Atomicity** (CRITICAL) - All mutations must inline operations to ensure atomicity
  - **Batch Operations** - Query optimization pattern for processing multiple items efficiently
  - **Pure Functions** - Separating validation logic from database operations (coming soon)
  - **Query Optimization** - Using indexes effectively (coming soon)

## Working Loop

1. **Shape the mission** by updating the schema if the model changes, then editing `GameData.ts` (rooms, tools, win conditions) to match.
2. **Describe the automation** by editing/adding a mission entry and rerunning `pnpm planning:refresh` so the matching `problem.pddl` is regenerated under `pddl/generated/problems/` and the matching `plan.json` is synced under `convex/domainSpec/pddl/problems/`.
3. **Load the experience** by wiring the plan/mission into Convex actions + React hooks so the player can attempt the solution path.
4. **Document intent** briefly in the PR description (or drop an ADR if the change is significant); update this file if a new canonical artifact appears.

This starter list will grow into the full SSOT map once the schema packages and generators are in place. Keep it light, keep it accurate.
