---
ssot-area: package-map
owner: runtime-team
derived-from: docs/ssot/README.md
---

# Package Map

Use this map when deciding where RogueNode source of truth lives.

## Canonical Runtime Paths

- `convex/domainSpec/`
  - Canonical runtime schema, parsed mission data, shared lookup helpers, and runtime-imported `plan.json` files.
  - Runtime code in Convex and the app should import from here.
- `pddl/`
  - Planner verbs plus generated `.pddl` artifacts under `pddl/generated/`.
  - These files feed the planner toolchain and are not imported by Convex at runtime.
- `convex/`
  - Backend queries, mutations, actions, schema, and auth bootstrap.
- `app/`, `components/`, `lib/`
  - Next.js UI, client wiring, and shared hooks/utilities.

## Planning Flow

1. Author schema/data in `convex/domainSpec/` and planner verbs in `pddl/planning.ts`.
2. Run `pnpm planning:refresh`.
3. Review `.pddl` output under `pddl/generated/`.
4. Review synced `plan.json` under `convex/domainSpec/pddl/problems/`.

## Legacy Note

Older docs may still mention `packages/domain-spec/`. Treat those references as historical; the canonical paths are `convex/domainSpec/` for runtime imports and `pddl/generated/` for planner artifacts.
