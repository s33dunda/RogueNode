# RogueNode Sources of Truth Aggregator

This document anchors every canonical artifact in RogueNode. Each section names the source of truth (SOT), its owner, how downstream assets are produced from it, and the commands that keep the system in sync. When you touch an area, update the corresponding SOT first, then regenerate or validate all derived outputs before merging.

## Stewardship

- **Owner of this index:** @roguecore (product+tech)
- **Update cadence:** update immediately with any change to a canonical artifact or generator
- **Validation:** CI target `pnpm ssot:check` (planned) will run all generators and drift detectors referenced here

> **Rule of thumb:** change the source, regenerate the derivatives, confirm CI is green, and note the touch points in your PR.

## Canonical Artifacts

### 1. Domain Schema (Game Rules)

- **Canonical artifact:** `packages/domain-spec/schema.ts` *(planned package exporting Zod/TypeScript schema)*
- **Derived assets:**
  - Runtime types consumed by Convex actions and UI helpers (`convex/gameActions.ts`, `utils/GameData.ts`)
  - Content authoring helpers (`packages/domain-spec/authoring.ts`)
  - Human-readable docs (`docs/gameplay/domain.md`)
- **Generator / checks:**
  - `pnpm domain:generate` – emits runtime types and docs (planned)
  - `pnpm test domain` – schema conformance/unit tests (existing test suite once added)
- **Update rules:**
  - Introduce or modify actions/predicates here first
  - Run `pnpm domain:generate`, commit updated artifacts, and reference the schema change in PR notes

### 2. Scenario Content (Missions & Levels)

- **Canonical artifact:** `packages/scenario-schema/scenarios/*.yaml` *(planned content bundle referencing domain schema IDs)*
- **Derived assets:**
  - Scenario fixtures for Convex and client (`convex/data/scenarios.ts`, `lib/api/scenarios.ts`)
  - Narrative docs (`docs/gameplay/scenarios.md`)
  - AI prompt snippets / tool configs (`agents/prompts/generatedScenarios.md`)
- **Generator / checks:**
  - `pnpm scenarios:generate` – syncs fixtures & docs (planned)
  - `pnpm test scenarios` – validates references against the domain schema (planned)
- **Update rules:**
  - Edit YAML in schema package, regenerate outputs, verify tests

### 3. Planning Pipeline (PDDL Integration)

- **Canonical artifact:** Domain & scenario schema above, emitted as PDDL under `../RogueNodeScenarios`
- **Derived assets:**
  - `../RogueNodeScenarios/domains/*.pddl` & `problems/*/problem.pddl`
  - Generated documentation `../RogueNodeScenarios/README.md`
  - Plan fixtures (`../RogueNodeScenarios/problems/*/plan.json`)
- **Generator / checks:**
  - `pnpm planning:generate` – converts schema into PDDL + docs (planned)
  - `pnpm planning:smoke` – runs Fast Downward oneshot to ensure solvability (planned)
- **Update rules:**
  - Never hand-edit PDDL; adjust the canonical schema and regenerate
  - Commit regenerated PDDL/docs/plan outputs alongside schema updates

### 4. Contracts (APIs, Events, Data Interchange)

- **Canonical artifact:** `contracts/openapi.yaml` *(planned OpenAPI spec) and supporting JSON Schema files*
- **Derived assets:**
  - Server request handlers (`app/api/*` stubs, Convex HTTP actions)
  - Type-safe client SDK (`lib/api/generated.ts`)
  - Public API docs (`docs/api/`)
- **Generator / checks:**
  - `pnpm contracts:generate` – emits server/client code and docs (planned)
  - `pnpm contracts:test` – contract tests against running services (planned)
- **Update rules:**
  - Update OpenAPI/JSON Schema first, regenerate stubs/clients, rerun contract tests

### 5. Runtime Implementation

- **Canonical artifact:** Application code repositories referencing generated types (Next.js app under `app/`, Convex functions under `convex/`, agent workers under `agents/`)
- **Derived assets:**
  - Build artifacts distributed to users
  - Storybook or UI docs (`docs/ui/` when present)
- **Generator / checks:**
  - `pnpm lint`, `pnpm test`, `pnpm build`
  - Type-share validation triggered via generators above
- **Update rules:**
  - Runtime code must consume generated types; avoid duplicating schema logic inline
  - If runtime changes imply schema shifts, loop back and update the canonical schema first

### 6. Operations & Infrastructure

- **Canonical artifact:** `infra/` (Terraform or Pulumi modules), `ops/slo/*.yaml`, `docs/runbooks/*.md`
- **Derived assets:**
  - Deployed infrastructure, monitoring dashboards, alerting configurations
  - On-call documentation surfaced in PagerDuty or equivalent
- **Generator / checks:**
  - `pnpm infra:plan` – renders IaC plan
  - `pnpm ops:lint` – validates SLO/alert definitions
- **Update rules:**
  - Version all changes with code; update runbooks alongside configuration edits

### 7. Intent & Decisions (Why)

- **Canonical artifact:** `docs/adr/*.md` (Architecture Decision Records), `docs/product/*.md` (product briefs)
- **Derived assets:**
  - References in PRs, onboarding guides, narrative docs
- **Generator / checks:**
  - No generation; rely on review checklist to ensure ADR exists for impactful shifts
- **Update rules:**
  - Record rationale before or during implementation; link ADR IDs in code/doc comments when relevant

## CI & Tooling Alignment

- Add `pnpm ssot:check` to orchestrate all `*:generate` and validation commands.
- CI job `ssot-guard.yml` runs on PRs, failing if any generator output is outdated or validation fails.
- PR template includes checkboxes for each SSOT area (`domain`, `scenarios`, `planning`, `contracts`, `runtime`, `ops`, `intent`). Authors tick boxes and confirm generators ran.

## Working Agreement

1. Locate the relevant SSOT entry before editing any derived file.
2. Modify the canonical artifact (or add one if missing).
3. Run associated generator/validation commands.
4. Update this aggregator if ownership, commands, or artifacts change.
5. Reference the SSOT sections touched in your PR description.

Keeping this document current ensures every team member knows where truth lives and how the system proves it.
