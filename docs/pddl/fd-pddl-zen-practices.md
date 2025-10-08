# Fast Downward PDDL — Zen Practices (Design Guide)

Authoritative best-practices for designing and evolving our FD-driven PDDL domains and problems.

See also: Review Checklist → ./fd-pddl-review-checklist.md

---

## 0) Philosophy (Zen)

- Fewer objects, fewer quantifiers, fewer surprises.
- Prefer simple invariants over clever encodings.
- Grounding is the first bottleneck; search is the second.
- Derived predicates should clarify, not complicate.
- Declare only what you use; remove what you don’t.
- Model discrete realities; use action costs sparingly and consistently.
- Small syntax changes can massively change grounding size—measure every change.

---

## 1) Requirements Policy

- Allowed: `:strips :typing :negative-preconditions :derived-predicates :action-costs`
- Avoid unless absolutely needed: `:conditional-effects`
- Never declare features you don’t use in the current domain version.

---

## 2) Action Costs (Strict Rules)

- Exactly one cost effect per action: `(increase (total-cost) <non-negative-int>)`.
- No conditional cost effects.
- Initialize `total-cost` to `0` in every problem file.

Anti-patterns:
- Multiple increases of `total-cost` in a single action
- Negative or non-integer cost values

---

## 3) Quantifiers (Minimize / Eliminate)

- Replace existential preconditions with aggregate predicates where possible.
- Avoid universal quantifiers inside axioms; they create 1 rule per object.
- If quantifiers are unavoidable, isolate them in small helper axioms.

Preferred pattern (aggregate instead of exists):

```lisp
(:predicates (any-threat-detected))

(:action ping
  :parameters (?s - server ?t - threat)
  :precondition (accessible ?s)
  :effect (and (detected ?t)
               (any-threat-detected)
               (increase (total-cost) 1)))

(:action ssh
  :parameters (?s - server ?tool - tool)
  :precondition (and (accessible ?s)
                     (any-threat-detected))
  :effect (and (connected ?s ?tool)
               (increase (total-cost) 1)))
```

---

## 4) Derived Predicates (Axioms) — Do / Don’t

Do:
- Keep axioms shallow; favor helper predicates to break complexity.
- Avoid universal quantifiers; prefer an existential helper + disjunction.
- Keep dependencies explicit and acyclic.

Don’t:
- Put derived predicates in effects (disallowed).
- Use negated derived predicates inside axiom bodies if avoidable.

Preferred pattern (replace `forall` with helper + disjunction):

```lisp
(:derived has-deployed-pod (?s - server)
  (exists (?p - pod) (deployed ?p ?s)))

(:derived system-secure (?s - server)
  (and (firewall-up ?s)
       (not (compromised ?s))
       (or (not (has-deployed-pod ?s)) (secure-server ?s))))
```

---

## 5) Invariants and Mutual Exclusion

If `A` and `B` must not co-exist, enforce explicitly via delete effects or derived contradiction patterns.

Example:

```lisp
(:action kubectl-scale
  :parameters (?p - pod ?s - server)
  :precondition (deployed ?p ?s)
  :effect (and (secure-server ?s)
               (not (compromised ?s))
               (increase (total-cost) 2)))
```

---

## 6) Grounding Control (Scalability)

- Bound object counts in problems: Servers (5–10), Pods (3–8), Threats (2–5), Tools (2–4).
- Track estimated ground size after each change (operators, axioms, facts).
- Eliminate joins you don’t need: avoid multi-parameter preconditions that multiply bindings.
- Prefer domain constants over enumerating types when semantics allow.

Quick estimation heuristics:
- Action with parameters `k` used across sets sizes `n1..nk` → ~`∏ ni` ground operators.
- Universal quantifier in axiom over set size `m` → `m` rules (per grounded head).

---

## 7) Heuristic Selection

- For axioms: try CEA or blind; combine FF+CEA for satisficing runs.
- LM-cut may not play well with axioms; measure before adopting for optimal runs.
- Keep search configs versioned alongside the domain for reproducibility.

Examples:

```bash
# Satisficing with axiom support
--search "lazy_greedy([ff(), cea()], preferred=[ff(), cea()])"

# Axiom-friendly greedy
--search "eager_greedy([cea()], preferred=[cea()])"

# Cost-optimal fallback with axioms
--search "astar(blind())"
```

---

## 8) Problem Authoring (LLM or Manual)

Must-haves:
- Initialize `(= (total-cost) 0)`.
- Use only declared types and known objects.
- Avoid conflicting facts (e.g., `compromised` and `secure-server` for same server) unless modeled as transitions.
- Keep object counts within bounds (see Section 6).

Skeleton:

```lisp
(define (problem example)
  (:domain rogue-devops-fd)
  (:objects s1 s2 - server
            p1 p2 - pod
            t1 t2 - threat
            tool1 tool2 - tool)
  (:init (accessible s1)
         (= (total-cost) 0))
  (:goal (and (system-secure s1)))
  (:metric minimize (total-cost)))
```

---

## 9) Validation & Measurement Workflow

Translation & size:

```bash
./fast-downward.py --translate domain.pddl problem.pddl
# Inspect output.sas: variables, mutex groups, operators, axioms
```

Search experiments:

```bash
./fast-downward.py domain.pddl problem.pddl \
  --search "lazy_greedy([ff(), cea()], preferred=[ff(), cea()])"
```

Targets for game-scale problems:
- Ground operators < 5,000
- Ground axioms < 1,000
- Translate < 5s, Search < 60s (on dev hardware)

---

## 12) Change Impact Notes

- Any added parameter multiplies ground instances; justify each parameter.
- Adding a universal quantifier in any axiom requires explicit performance testing.
- Adding new types is low cost; adding many objects of existing types is high cost.
- Aggregates (boolean summaries) generally beat repeated existential checks.

---

## 13) Repository Hygiene

- Co-locate domain, canonical small problems, and search configs.
- Version domain changes with a short CHANGES entry: feature, expected grounding delta, heuristic notes.
- Keep a "perf-baseline" directory with tiny, small, medium problems used in CI.

---

## 14) Troubleshooting Quick Ref

- Huge translate time → Quantifier explosion or excessive parameters.
- Few/no plans with axioms → Try CEA/Blind; verify derived definitions.
- Memory blowups → Reduce object counts; collapse exists to aggregates; split actions.
- Inconsistent results → Validate with VAL; scan for undeclared/typo’d symbols.

---

## 15) Golden Patterns (Copy/Paste)

Aggregate instead of exists:

```lisp
(:predicates (any-X))
; producers set (any-X); consumers require it
```

Helper axiom instead of forall:

```lisp
(:derived has-X (?o - T) (exists (?y - U) (R ?y ?o)))
(:derived good (?o - T) (or (not (has-X ?o)) (ok ?o)))
```

Invariant via delete effect:

```lisp
(:effect (and (A ?o) (not (B ?o))))
```

---

## 17) Links

- Use the Review Checklist before merging changes → ./fd-pddl-review-checklist.md
- Fast Downward docs (Context7 mirrors / upstream): PDDL support, ADL, costs, heuristics, translation, axioms, limitations

