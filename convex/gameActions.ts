import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { requireAuthWithPlayerId } from "./lib/auth";
import { gameState as gameStateValidator } from "./types";

// Record tool usage for learning progression tracking
export const recordToolUsage = internalMutation({
	args: {
		playerId: v.string(),
		tool: v.string(),
		command: v.string(),
		room: v.string(),
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
	},
	returns: v.object({
		sessionId: v.id("gameSessions"),
		toolUsageId: v.id("toolUsage"),
		sessionCreated: v.boolean(),
	}),
	handler: async (ctx, args) => {
		// Update or create game session tracking first to get unique session ID
		const existingSession = await ctx.db
			.query("gameSessions")
			.withIndex("by_player", (q) => q.eq("playerId", args.playerId))
			.order("desc")
			.first();

		let sessionId: Id<"gameSessions">;
		let sessionCreated = false;

		if (existingSession) {
			await ctx.db.patch(existingSession._id, {
				currentRoom: args.room,
				lastActivity: Date.now(),
			});
			sessionId = existingSession._id;
		} else {
			const newSessionId = await ctx.db.insert("gameSessions", {
				playerId: args.playerId,
				currentRoom: args.room,
				health: 100,
				skillLevel: 1,
				lastActivity: Date.now(),
			});
			sessionId = newSessionId;
			sessionCreated = true;
		}

		// Record the tool usage with the unique session ID
		const toolUsageId = await ctx.db.insert("toolUsage", {
			playerId: args.playerId,
			sessionId,
			tool: args.tool,
			command: args.command,
			room: args.room,
			timestamp: Date.now(),
			success: args.success,
			context: args.context,
		});

		return {
			sessionId,
			toolUsageId,
			sessionCreated,
		};
	},
});

// Deterministic environment scan for the 'look' command
export const getLook = action({
	args: { gameState: gameStateValidator },
	returns: v.object({ output: v.array(v.string()) }),
	handler: async (ctx, { gameState }) => {
		// Ensure the caller is authenticated and matches the playerId
		await requireAuthWithPlayerId(ctx, gameState.playerId);

		// Minimal stub output for step 1 integration; backend logic will be expanded in step 2
		return {
			output: [
				`[${gameState.currentRoom}]`,
				"Environment scan ready.",
				"Type 'tools' to see available DevOps commands.",
			],
		};
	},
});
