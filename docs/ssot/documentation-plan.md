# Documentation Plan

Create docs/ssot/README.md as the aggregator: explains the SSOT concept, lists each canonical artifact (schema, contracts, runtime, planning, ops, intent), their owners, update rules, and generator commands.
Establish canonical schema packages: `convex/domainSpec/` for RogueNode runtime game rules (Zod/TS + runtime plan imports) and `pddl/` for planner inputs/outputs; both feed runtime code (`convex/gameActions.ts`, `convex/gameData.ts`) and generated docs.
Maintain contracts/ truth: shared API/event schemas (OpenAPI/GraphQL/JSON Schema) with scripts in tools/codegen/ to produce server stubs, clients, and their docs; CI enforces no drift.
Document runtime truth: each code package (Next.js app, Convex functions, agents) is referenced with links to key files and the tests/CI checks that guard schema alignment.
Capture planning truth: the canonical schema emits PDDL in ../RogueNodeScenarios/ plus regenerated README.md; planning scripts and smoke-tests run in CI to validate output.
Record operations truth: versioned IaC modules, SLO/SLI definitions, alert runbooks, linked dashboards, all referenced from the aggregator under ops/.
Preserve intent: ADRs, product briefs, narrative docs stored in docs/adr/ (or similar) and indexed from the aggregator so “why” decisions stay accessible.
Automation: add pnpm ssot:check (runs generators, schema validation, planning smoke test) via ssot-guard.yml; PR template checklist highlights affected truth domains.
Conventions: front-matter metadata (ssot-area, owner, derived-from) on canonical/derived files for tooling; docs-as-code kept beside governed artifacts; any UI or prompt content ties back to the relevant schema entry.
