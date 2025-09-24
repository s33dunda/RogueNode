import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
	numbers: defineTable({
		value: v.number(),
	}),

	// Game session tracking for tool usage
	gameSessions: defineTable({
		playerId: v.string(),
		currentRoom: v.string(),
		health: v.number(),
		skillLevel: v.number(),
		toolSessionId: v.optional(v.string()),
		lastActivity: v.number(),
	}).index("by_player", ["playerId"]),

	// Tool usage history for learning progression
	toolUsage: defineTable({
		playerId: v.string(),
		sessionId: v.string(),
		tool: v.string(),
		command: v.string(),
		room: v.string(),
		timestamp: v.number(),
		success: v.boolean(),
		context: v.object({
			networkState: v.optional(
				v.object({
					threatLevel: v.number(),
					latency: v.number(),
					packetLoss: v.number(),
				}),
			),
			roomInfrastructure: v.optional(v.array(v.string())),
		}),
	})
		.index("by_player_tool", ["playerId", "tool"])
		.index("by_session", ["sessionId"]),

	// Network context for realistic ping simulation
	roomNetwork: defineTable({
		roomId: v.string(),
		baseLatency: v.number(),
		connectedSystems: v.array(v.string()),
		threatLevel: v.number(),
		lastUpdate: v.number(),
	}).index("by_room", ["roomId"]),

	// Command output cache for agent responses (shared across players for same game states)
	commandOutputCache: defineTable({
		command: v.string(), // "ping", "ssh", etc.
		target: v.string(), // Command target (e.g., "database-01")
		gameStateHash: v.string(), // Hashed game state for matching
		output: v.array(v.string()), // Cached agent output
		skillGained: v.number(), // Skill points from command
		success: v.boolean(), // Command success status
		playerId: v.string(), // Player who originally generated this (for analytics only)
		timestamp: v.number(), // When cached
		hitCount: v.number(), // How many times used across all players
		threadId: v.optional(v.string()), // Thread context from original generation
	})
		.index("by_command_target_hash", ["command", "target", "gameStateHash"])
		.index("by_timestamp", ["timestamp"]),
});
