# domain-spec (WIP)

Minimal schema package for RogueNode's MVP. Until generators land, import these Zod validators/types when authoring rooms, items, or missions so every layer (Convex, Next.js, planners) sticks to the same shapes. The accompanying `data.ts` file exports a parsed bundle (`domainData`, `roomList`, `enemyList`) plus a minimal `toolCatalog` so runtime code can source everything from this package. Derived planner outputs live under `generated/plans/*.plan.json` and are updated via `pnpm planning:refresh`.

## Usage

```ts
import { domainBundleSchema } from "../../packages/domain-spec";

const parsed = domainBundleSchema.parse({
  rooms: [...],
  items: [...],
  enemies: [],
  missions: [],
});
```

Placeholders like `useEffectId`, `optimalPlan`, and `problemRef` let us attach runtime logic or planner outputs without hard-coding behaviour in the schema. As we extract data from `utils/GameData.ts`, this package will become the single source for generation and validation.

Pair this schema with the LLM workflow described in `docs/prompts/planning-domain.md` when you need fresh PDDL; copy the relevant schema excerpt into the prompt so the generated files stay aligned.

## Generated Artifacts

```text
packages/domain-spec/generated/
├── domains/            # Derived PDDL domains
├── problems/           # Derived problems + plan.json per mission
└── README.md           # Regeneration instructions

```

Run `pnpm planning:refresh` after editing the schema/data/planning files to update these outputs.
