import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { GameState } from "../types";
import { commandOutputCacheEntry } from "../types";

/**
 * Produce a compact, stable representation of a player's GameState for use in cache keys.
 *
 * @param gameState - The full game state; this function reads `health`, `currentRoom`, `threatLevel`, and `enemies`.
 * @returns An object with:
 *   - `room`: the current room id,
 *   - `healthCategory`: `"healthy"`, `"wounded"`, or `"critical"` based on `health` (>=70, 30–69, <30),
 *   - `threatLevel`: the original numeric threatLevel from the game state,
 *   - `activeThreatCount`: number of non-defeated enemies located in the current room.
 *
 * @example
 * normalizeGameState({
 *   health: 85,
 *   currentRoom: "dungeon-1",
 *   threatLevel: 2,
 *   enemies: [{ location: "dungeon-1", defeated: false }]
 * });
 * // Returns: { room: "dungeon-1", healthCategory: "healthy", threatLevel: 2, activeThreatCount: 1 }
 */
function normalizeGameState(gameState: GameState) {
	// Health categories: healthy (70-100), wounded (30-69), critical (0-29)
	const healthCategory =
		gameState.health >= 70
			? "healthy"
			: gameState.health >= 30
				? "wounded"
				: "critical";

	// Count active threats in current room
	const activeThreatCount = gameState.enemies.filter(
		(e) => e.location === gameState.currentRoom && !e.defeated,
	).length;

	return {
		room: gameState.currentRoom,
		healthCategory,
		threatLevel: gameState.threatLevel,
		activeThreatCount,
	};
}

/**
 * Create a stable cache key by combining a command, a target, and a normalized snapshot of the game state.
 *
 * @param command - The player command or action to cache (e.g., "attack", "inspect")
 * @param target - The command target identifier (e.g., enemy id, object id, or "none")
 * @param gameState - Current game state; only the normalized, cache-relevant fields are considered when generating the key
 * @returns A deterministic string key in the format `command:target:hash` where `hash` is a non-negative base-36 hash of the normalized game state
 *
 * @example
 * // Possible result: "attack:orc-123:1a2b"
 * const key = generateCacheKey("attack", "orc-123", currentGameState);
 */
export function generateCacheKey(
	command: string,
	target: string,
	gameState: GameState,
): string {
	const normalizedState = normalizeGameState(gameState);
	const stateString = JSON.stringify(
		normalizedState,
		Object.keys(normalizedState).sort(),
	);

	// Simple hash function for the state
	let hash = 0;
	for (let i = 0; i < stateString.length; i++) {
		const char = stateString.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}

	return `${command}:${target}:${Math.abs(hash).toString(36)}`;
}

// Look up cached result for exact match (shared across all players with same game state)
export const lookupCache = internalQuery({
	args: {
		command: v.string(),
		target: v.string(),
		gameStateHash: v.string(),
	},
	returns: v.union(v.null(), commandOutputCacheEntry),
	handler: async (ctx, { command, target, gameStateHash }) => {
		const result = await ctx.db
			.query("commandOutputCache")
			.withIndex("by_command_target_hash", (q) =>
				q
					.eq("command", command)
					.eq("target", target)
					.eq("gameStateHash", gameStateHash),
			)
			.first();

		return result || null;
	},
});

// Store new cache entry (playerId stored for analytics, but cache is shared across players)
export const storeInCache = internalMutation({
	args: {
		command: v.string(),
		target: v.string(),
		gameStateHash: v.string(),
		output: v.array(v.string()),
		skillGained: v.number(),
		success: v.boolean(),
		playerId: v.string(), // Original generator for analytics only
		threadId: v.optional(v.string()),
	},
	returns: v.id("commandOutputCache"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("commandOutputCache", {
			...args,
			timestamp: Date.now(),
			hitCount: 0,
		});
	},
});

// Increment cache hit count (increments for any player using the cached result)
export const incrementCacheHit = internalMutation({
	args: {
		cacheId: v.id("commandOutputCache"),
	},
	returns: v.null(),
	handler: async (ctx, { cacheId }) => {
		const entry = await ctx.db.get(cacheId);
		if (entry) {
			await ctx.db.patch(cacheId, {
				hitCount: entry.hitCount + 1,
			});
		}
	},
});

// Clean up old cache entries (older than 24 hours)
export const cleanupOldCacheEntries = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

		const oldEntries = await ctx.db
			.query("commandOutputCache")
			.withIndex("by_timestamp", (q) => q.lt("timestamp", oneDayAgo))
			.collect();

		for (const entry of oldEntries) {
			await ctx.db.delete(entry._id);
		}

		return oldEntries.length;
	},
});

// Get all cache entries for stats (internal use)
export const getAllCacheEntries = internalQuery({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("commandOutputCache"),
			command: v.string(),
			target: v.string(),
			hitCount: v.number(),
			timestamp: v.number(),
		}),
	),
	handler: async (ctx) => {
		const entries = await ctx.db.query("commandOutputCache").collect();
		return entries.map((e) => ({
			_id: e._id,
			command: e.command,
			target: e.target,
			hitCount: e.hitCount,
			timestamp: e.timestamp,
		}));
	},
});
