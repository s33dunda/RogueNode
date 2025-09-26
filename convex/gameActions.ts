import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// Initialize game state for a new player
export const initializeGameState = mutation({
	args: {},
	returns: v.object({ gameStateId: v.id("gameState") }),
	handler: async (ctx) => {
		const identity = await requireAuth(ctx);

		// Check if player already has game state
		const existingGameState = await ctx.db
			.query("gameState")
			.withIndex("by_player", (q) => q.eq("playerId", identity.subject))
			.first();

		if (existingGameState) {
			return { gameStateId: existingGameState._id };
		}

		// Create initial game state
		const gameStateId = await ctx.db.insert("gameState", {
			playerId: identity.subject,
			currentRoom: "server-room", // Starting room
			inventory: [],
			health: 100,
			visited: ["server-room"],
			enemies: [],
			gameOver: false,
			skillPoints: 0,
			threatLevel: 0,
		});

		return { gameStateId };
	},
});

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
		gameStateId: v.id("gameState"),
		toolUsageId: v.id("toolUsage"),
		gameStateCreated: v.boolean(),
	}),
	handler: async (ctx, args) => {
		// Update or create game state tracking first to get unique game state ID
		const existingGameState = await ctx.db
			.query("gameState")
			.withIndex("by_player", (q) => q.eq("playerId", args.playerId))
			.order("desc")
			.first();

		let gameStateId: Id<"gameState">;
		let gameStateCreated = false;

		if (existingGameState) {
			await ctx.db.patch(existingGameState._id, {
				currentRoom: args.room,
			});
			gameStateId = existingGameState._id;
		} else {
			// Create initial game state if none exists
			const newGameStateId = await ctx.db.insert("gameState", {
				playerId: args.playerId,
				currentRoom: args.room,
				inventory: [],
				health: 100,
				visited: [args.room],
				enemies: [],
				gameOver: false,
				skillPoints: 0,
				threatLevel: 0,
			});
			gameStateId = newGameStateId;
			gameStateCreated = true;
		}

		// Record the tool usage with the unique game state ID
		const toolUsageId = await ctx.db.insert("toolUsage", {
			playerId: args.playerId,
			gameStateId,
			tool: args.tool,
			command: args.command,
			room: args.room,
			timestamp: Date.now(),
			success: args.success,
			context: args.context,
		});

		return {
			gameStateId,
			toolUsageId,
			gameStateCreated,
		};
	},
});

// Deterministic environment scan for the 'look' command
export const getLook = query({
	args: {},
	returns: v.object({ output: v.array(v.string()) }),
	handler: async (ctx) => {
		// Ensure the caller is authenticated and matches the playerId
		const identity = await requireAuth(ctx);

		const gameState = await ctx.db
			.query("gameState")
			.withIndex("by_player", (q) => q.eq("playerId", identity.subject))
			.order("desc")
			.first();

		// Minimal stub output for step 1 integration; backend logic will be expanded in step 2
		return {
			output: [
				`[${gameState?.currentRoom}]`,
				"Environment scan ready.",
				"Type 'tools' to see available DevOps commands.",
			],
		};
	},
});
