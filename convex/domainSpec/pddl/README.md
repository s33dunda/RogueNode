# Generated Planner Artifacts

This directory is automatically populated via `pnpm planning:refresh`.
Files inside are derived from the canonical schema/data (`convex/domainSpec/schema.ts`,
`convex/domainSpec/data.ts`, `convex/domainSpec/planning.ts`).

- `domains/` – PDDL domain files used by the planner (derived).
- `problems/<mission>/problem.pddl` – PDDL problem file (derived).
- `problems/<mission>/plan.json` – Planner JSON output enriched with metadata, consumed by runtime code.

**Do not edit manually.** Re-run `pnpm planning:refresh` whenever you change the canonical TypeScript sources.
