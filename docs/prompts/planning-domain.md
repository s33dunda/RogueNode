# LLM Prompt – Generate PDDL Domain & Problems

Use this workflow when the TypeScript domain schema changes or when we author a new mission that needs an up-to-date PDDL representation. The LLM output is treated as a derived artifact: commit the generated `.pddl` files alongside the schema change and reference the run in your PR description.

## Automated Workflow (Recommended)

Run the helper script to assemble context, call an LLM CLI, and optionally persist the returned code fences. `pnpm planning:refresh` wraps both steps (generation + planner smoke test) using the defaults below, or you can invoke it directly:

```bash
devbox run -- node RogueNode/scripts/generate-pddl-llm.mjs \
  --provider claude --model claude-3-5-sonnet-20241022 --invoke \
  --domain-out packages/domain-spec/generated/domains/rogue-devops-poc-domain.pddl \
  --problem-out packages/domain-spec/generated/problems/poc-reachability/problem.pddl
```

Flags of interest:

- `--provider <openai|codex|claude|gemini>` – which CLI to call (must already be available in `devbox`).
- `--model <name>` – optional override for the provider's model.
- `--include <path>` – add extra files (repeatable) beyond the defaults (`packages/domain-spec/planning.ts`, `packages/domain-spec/schema.ts`, `packages/domain-spec/data.ts`).
- `--domain-out`, `--problem-out` – write the first and second ```lisp``` blocks directly to the supplied paths.
- `--invoke` – without it the script just builds the prompt and stores it under `docs/prompts/sessions/`.

Environment variables (`OPENAI_CLI`, `CLAUDE_CLI`, `GEMINI_CLI`, and their `*_PDDL_MODEL` counterparts) override the default binaries/models.

Every run captures a prompt + raw response snapshot in `docs/prompts/sessions/<timestamp>/` so we can audit later. Derived PDDL files are marked with a header—always regenerate them instead of editing manually.

## Manual Prompt Template

If you prefer to run the CLI yourself, copy the prompt below and inject the relevant schema excerpts. Keep the prompt and the model response in the PR notes for traceability.

## Inputs to Gather

- Current planning schema export from `packages/domain-spec/planning.ts` (especially new types, predicates, actions).
- Mission data from `packages/domain-spec/data.ts` (rooms, missions, tool catalog).
- Any existing generated artifacts (`packages/domain-spec/generated/domains/*.pddl`, `packages/domain-spec/generated/problems/*/problem.pddl`).

## Prompt Template

Paste the following into your LLM of choice, replacing the placeholders with real data. Keep the prompt and the model response in the PR notes for traceability.

```markdown
You are a planning engineer. Convert the RogueNode domain description into PDDL 2.1 (classical STRIPS with typing). Follow these rules:
- Output **only** two fenced blocks: one for the domain file, one for the problem file. Use ```lisp fences.
- Mirror the definitions exactly; do not rename symbols.
- Include requirements `:strips` and `:typing`.
- Ensure parameter typing uses the `?param - type` notation.
- Effects should use the minimal `(and ...)` form, even when there is a single literal.
- For the problem file, include objects for every room/item/enemy referenced and set the goal according to the mission success condition.
- Do not invent extra predicates, actions, or constants beyond what appears in the provided context.

Example format to imitate:
```lisp
; domain
(define (domain sample-domain)
  (:requirements :strips :typing)
  (:types server)
  (:predicates (reachable ?s - server))
  (:action ping
    :parameters (?s - server)
    :precondition ()
    :effect (and (reachable ?s))))
```
```lisp
; problem
(define (problem sample-problem)
  (:domain sample-domain)
  (:objects main-server - server)
  (:init)
  (:goal (and (reachable main-server))))
```

Domain context (TypeScript schema excerpt):
```

<copy relevant portion from packages/domain-spec/planning.ts>

```

Additional context (domain-spec data excerpt):
```

<copy mission/rooms/items relevant to the problem>

```

Return output as:
```

```lisp
; domain
(define ...)
...
```

```lisp
; problem
(define ...)
...
```

```
```

## Verification Checklist

- [ ] Domain `(:requirements ...)`, `(:types ...)`, `(:predicates ...)`, and `(:action ...)` blocks match the TypeScript planning schema exactly.
- [ ] Problem file names domain correctly and includes all referenced objects.
- [ ] `:init` facts align with mission start state.
- [ ] `:goal` reflects the mission success condition.
- [ ] Ran `devbox run -- python scripts/plan_fd.py ...` to confirm the planner solves the problem; attach log snippet in PR.

## Storage

- Save the generated domain under `packages/domain-spec/generated/domains/<domain-name>.pddl`.
- Save the problem under `packages/domain-spec/generated/problems/<mission-id>/problem.pddl` (create folder if needed) and ensure `plan.json` sits alongside it.
- Update `plan.json` via the planner run and commit it as part of the same change.
