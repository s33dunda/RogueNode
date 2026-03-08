import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
	commandOutputCacheFields,
	gameState,
	missionProgressFields,
	terminalOutputFields,
} from "./types";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
	numbers: defineTable({
		value: v.number(),
	}),

	gameState: defineTable(gameState).index("by_player", ["playerId"]),

	terminalOutput: defineTable(terminalOutputFields)
		.index("by_player", ["playerId"])
		.index("by_gameState", ["gameStateId"]),

	// Tool usage history for learning progression
	toolUsage: defineTable({
		playerId: v.string(),
		gameStateId: v.id("gameState"),
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
		.index("by_gameState", ["gameStateId"]),

	// Network context for realistic ping simulation
	roomNetwork: defineTable({
		roomId: v.string(),
		baseLatency: v.number(),
		connectedSystems: v.array(v.string()),
		threatLevel: v.number(),
		lastUpdate: v.number(),
	}).index("by_room", ["roomId"]),

	// Command output cache for agent responses (shared across players for same game states)
	commandOutputCache: defineTable(commandOutputCacheFields)
		.index("by_command_target_hash", ["command", "target", "gameStateHash"])
		.index("by_timestamp", ["timestamp"]),

	// Mission progress tracking for PDDL-driven validation
	missionProgress: defineTable(missionProgressFields)
		.index("by_player_mission", ["playerId", "missionId"])
		.index("by_player_status", ["playerId", "status"])
		.index("by_gameState", ["gameStateId"]),
});
