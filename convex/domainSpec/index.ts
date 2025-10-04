/** @file
 * Domain Spec - Convex Runtime Imports
 *
 * This directory contains ONLY files imported by Convex at runtime:
 * - schema.ts: Type definitions (Zod schemas)
 * - data.ts: Game data (imports plan.json)
 * - runtime.ts: Helper functions
 * - generated/problems/[*]/plan.json: Planner output (imported by data.ts)
 *
 * PDDL artifacts (.pddl files) are in pddl/ directory (not imported by Convex).
 *
 * To regenerate plans: Run `pnpm planning:refresh`
 **/

export * from "./data";
export * from "./runtime";
export * from "./schema";
