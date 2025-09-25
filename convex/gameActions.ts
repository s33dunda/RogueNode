import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

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
		sessionId: v.string(),
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

		let sessionId: string;
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
