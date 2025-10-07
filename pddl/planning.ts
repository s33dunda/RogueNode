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
 */

/**
 * Planning Domain: RogueNode DevOps Adventure
 *
 * Core Concepts:
 * - Players navigate rooms and interact with infrastructure
 * - Commands like ping, ssh, restart simulate DevOps tools
 * - Missions require specific sequences of actions to complete
 *
 * PDDL Types:
 * - enemy: Problems/obstacles that must be defeated
 * - server: Infrastructure components that can be interacted when inside
 *
 * PDDL Predicates:
 * - (enemy-at ?e ?r): Enemy ?e is in room ?r
 * - (enemy-defeated ?e): Enemy ?e has been defeated
 * - (reachable ?s): Server ?s is reachable/online
 *
 * PDDL Actions:
 * - ping: Test server reachability
 * - ssh: Connect to a server
 * - restart: Restart a service
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
