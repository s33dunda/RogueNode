/**
 * PDDL Planning Configuration
 * ----------------------------
 *
 * This file provides context for LLM-based PDDL generation.
 * It describes the planning domain verbs, predicates, and actions
 * that the planner should understand.
 *
 * This file is NOT imported by Convex - it's only used by
 * scripts/generate-pddl-llm.mjs to provide context to the LLM.
 *
 * This follows the Fast Downward's PDDL format version, see the example schema:
 * (define (domain <domain-name>)  ; e.g., rogue-devops-fd
 *   (:requirements <list-of-reqs>)  ; Supported: :strips :typing :negative-preconditions :equality :conditional-effects :action-costs :derived-predicates (for axioms). Avoid :durative-actions, :numeric-fluents, :preferences.

 *   (:types <type-hierarchy>)  ; Optional but recommended: Hierarchical, e.g., server - object, pod - container (inherits from object).

 *   (:predicates <predicate-defs>)  ; Atomic or relational, e.g., (accessible ?s - server). Use ?var - type for typed vars. Supports negation in use but not in def.

 *   (:constants <consts>)  ; Optional: Fixed objects like "ssh-tool".

 *   (:action <action-name1>
 *     :parameters (?var1 - type1 ?var2 - type2)  ; Typed params for efficiency.
 *     :precondition <precond-formula>  ; ADL: and/or/not/exists/forall, disjunction (or ...), negation (not ...). No numeric comparisons.
 *     :effect <effect-formula>  ; Add/del facts: and (when <cond> <effects>), forall (?v - type :parameters ... :effect ...). Quantified/conditional OK.
 *   )
 *   ; Repeat for more actions. Optional: (:cost <integer-or-var>) for :action-costs—planners optimize total cost.

 *   ; Optional Axioms (for derived predicates, PDDL 2.2):
 *   (:derived <pred-name> (<params>)
 *     <formula>  ; e.g., (when (and ...) (derived-fact))
 *   )

 *   ; More actions...
 * )
 * Constraints for Fast Downward:
 *
 *	- Preconditions/Effects: Boolean only (no numbers like > 5). Use preconditions for "if" (e.g.,  (accessible ?s) before ssh), effects for "then" (e.g., (connected ?tool) after ssh).
 *
 *	- Costs: Add :cost 1 per action for step-minimizing; or variable costs (e.g., :cost 2 for complex actions like deploy).
 *
 *	- Limits: No object fluents (e.g., can't modify objects beyond predicates). No soft goals—use hard :goal in problems.
 *
 *	- Efficiency: Typing reduces state space; use for your objects (servers, pods). Aim for <50 predicates, <20 actions per domain to keep solves <1s.
 *
 *	- Common Pitfalls: Ensure closed-world assumption (unset predicates = false). Validate syntax with fd --validate domain.pddl problem.pddl.
 */

export const planningDomain = {
	name: "rogue-node",
	requirements: [":strips", ":typing"],
	types: ["room", "enemy", "server"],
	predicates: [
		"enemy-at",
		"enemy-defeated",
		"reachable",
	],
	actions: ["ping", "ssh", "restart"],
};

/**
 * Example Mission: Ping Tutorial
 *
 * Goal: Verify server reachability using ping command
 * Initial State: Player in server-room, main-server offline
 * Goal State: main-server is reachable
 * Optimal Plan: ping main-server
 */
