# Fast Downward PDDL — Review Checklist

Actionable checks to run before working on or merging changes to our FD-driven PDDL domain and problems.

See also: Zen Practices (Design Guide) → ./fd-pddl-zen-practices.md

---

## A) Domain Changes — Pre‑Merge Checklist

Requirements & Features
- [ ] No unused features in `:requirements` (avoid `:conditional-effects` unless used)
- [ ] Only allowed features: `:strips :typing :negative-preconditions :derived-predicates :action-costs`

Action Costs
- [ ] Exactly one `(increase (total-cost) N)` per action
- [ ] `N` is a non‑negative integer; no conditional cost effects

Quantifiers
- [ ] No existential quantifiers in action preconditions without strong justification
- [ ] No universal quantifiers inside axioms (or isolated via helper axioms)
- [ ] Prefer aggregate booleans over repeated `exists`

Derived Predicates (Axioms)
- [ ] No derived predicate in effects
- [ ] No negated derived predicates in bodies if avoidable
- [ ] Axioms are shallow, acyclic, and documented

Invariants / Mutual Exclusion
- [ ] Conflicting facts are prevented via delete effects or contradictions
- [ ] Example: setting `secure-server` removes `compromised`

Symbols & Hygiene
- [ ] No orphaned predicates/functions/types (every new symbol is used)
- [ ] Names consistent and typed

Grounding Impact (must measure)
- [ ] Translator run performed; operator/axiom counts recorded
- [ ] Change justification includes expected grounding delta

Heuristics & Search
- [ ] Axiom‑compatible search config provided (CEA/Blind or FF+CEA)
- [ ] Search configs versioned with domain changes

---

## B) Problem Files — Pre‑Merge Checklist

Initialization & Objects
- [ ] `(= (total-cost) 0)` initialized
- [ ] Objects belong to declared types; names consistent with domain
- [ ] Object counts within bounds (Servers 5‑10, Pods 3‑8, Threats 2‑5, Tools 2‑4)

State Consistency
- [ ] No contradictory facts unless transitions are modeled (e.g., `compromised` + `secure-server`)
- [ ] Goals are reachable in sample runs

Validation & Performance
- [ ] Translate step completes and is inspected
- [ ] Satisficing run completes under targets

Targets (game‑scale)
- [ ] Ground operators < 5,000
- [ ] Ground axioms < 1,000
- [ ] Translate < 5s, Search < 60s (dev hardware)

---

## C) Quick Commands

Translation & size
```bash
./fast-downward.py --translate domain.pddl problem.pddl
# Inspect output.sas: variables, mutex groups, operators, axioms
```

Satisficing (axiom support)
```bash
./fast-downward.py domain.pddl problem.pddl \
  --search "lazy_greedy([ff(), cea()], preferred=[ff(), cea()])"
```

Axiom‑friendly greedy
```bash
./fast-downward.py domain.pddl problem.pddl \
  --search "eager_greedy([cea()], preferred=[cea()])"
```

Cost‑optimal fallback with axioms
```bash
./fast-downward.py domain.pddl problem.pddl \
  --search "astar(blind())"
```

---

## D) Exit Criteria (Minimal to Merge)
- [ ] Grounding size within targets on baseline problems
- [ ] Plans found under at least one axiom‑friendly search
- [ ] No unused requirements/predicates
- [ ] All costs valid and initialized to 0 in problems
- [ ] Documentation updated (Guide + Checklist kept current)

