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
 * - room: Navigable locations in the game world
 * - item: Objects that can be picked up and used
 * - enemy: Problems/obstacles that must be defeated
 * - server: Infrastructure components that can be interacted with
 *
 * PDDL Predicates:
 * - (at-room ?r): Player is currently in room ?r
 * - (room-exit ?from ?to ?dir): Room ?from has exit to ?to in direction ?dir
 * - (item-at ?i ?r): Item ?i is located in room ?r
 * - (has-item ?i): Player has item ?i in inventory
 * - (enemy-at ?e ?r): Enemy ?e is in room ?r
 * - (enemy-defeated ?e): Enemy ?e has been defeated
 * - (requires-item ?e ?i): Enemy ?e requires item ?i to defeat
 * - (reachable ?s): Server ?s is reachable/online
 *
 * PDDL Actions:
 * - ping: Test server reachability
 * - ssh: Connect to a server
 * - restart: Restart a service
 * - move: Navigate between rooms
 * - take: Pick up an item
 * - use: Use an item (e.g., to defeat an enemy)
 */

export const planningDomain = {
	name: "rogue-node",
	requirements: [":strips", ":typing"],
	types: ["room", "item", "enemy", "server"],
	predicates: [
		"at-room",
		"room-exit",
		"item-at",
		"has-item",
		"enemy-at",
		"enemy-defeated",
		"requires-item",
		"reachable",
	],
	actions: ["ping", "ssh", "restart", "move", "take", "use"],
};

/**
 * Example Mission: Ping Tutorial
 *
 * Goal: Verify server reachability using ping command
 * Initial State: Player in server-room, main-server offline
 * Goal State: main-server is reachable
 * Optimal Plan: ping main-server
 */
