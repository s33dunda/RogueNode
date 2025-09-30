import { v } from "convex/values";
import { commandLineTools, enemies, rooms } from "../utils/GameData";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { requireAuth } from "./lib/auth";
import type { GameState } from "./types";
import { generateCacheKey } from "./utils/cacheUtils";

// Initialize game state for a new player
export const initializeGameState = mutation({
	args: v.object({}),
	returns: v.object({ gameStateId: v.id("gameState") }),
	handler: async (ctx) => {
		const identity = await requireAuth(ctx);

		// Check if player already has game state
		const existingGameState = await ctx.db
			.query("gameState")
			.withIndex("by_player", (q) => q.eq("playerId", identity.subject))
			.order("desc")
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
			enemies: enemies.map((enemy) => ({ ...enemy })), // Deep clone enemy roster
			gameOver: false,
			skillPoints: 0,
			threatLevel: 0,
		});

		return { gameStateId };
	},
});

const cachedAsyncResult = v.object({
	commandType: v.string(),
	target: v.string(),
	output: v.array(v.string()),
	success: v.boolean(),
	skillGained: v.number(),
	threadId: v.optional(v.string()),
});

export const sendCommand = mutation({
	args: v.object({
		command: v.string(),
		cachedResult: v.optional(cachedAsyncResult),
	}),
	returns: v.object({
		outputId: v.id("terminalOutput"),
	}),
	handler: async (ctx, { command, cachedResult }) => {
		const identity = await requireAuth(ctx);
		const trimmed = command.trim();
		const { commandType, target } = parseCommandType(trimmed);

		const gameState = await loadPlayerGameState(ctx, identity.subject);

		if (!commandType) {
			const outputId = await ctx.db.insert("terminalOutput", {
				playerId: identity.subject,
				gameStateId: gameState._id,
				commandInput: command,
				outputLines: [],
				commandType,
				success: false,
			});
			return { outputId };
		}

		if (!isSyncCommand(commandType)) {
			const normalizedTarget = target || "localhost";

			if (
				cachedResult &&
				cachedResult.commandType === commandType &&
				cachedResult.target === normalizedTarget
			) {
				const outputId = await ctx.db.insert("terminalOutput", {
					playerId: identity.subject,
					gameStateId: gameState._id,
					commandInput: command,
					outputLines: cachedResult.output,
					commandType,
					success: cachedResult.success,
				});

				await ctx.runMutation(internal.gameActions.persistCommandGameState, {
					gameStateId: gameState._id,
					skillDelta: cachedResult.success ? cachedResult.skillGained : 0,
					toolSessionId: cachedResult.threadId ?? gameState.toolSessionId,
				});

				return { outputId };
			}

			const outputId = await ctx.db.insert("terminalOutput", {
				playerId: identity.subject,
				gameStateId: gameState._id,
				commandInput: command,
				outputLines: ["Processing..."],
				commandType,
				success: false,
			});

			await ctx.scheduler.runAfter(
				0,
				internal.gameActions.executeAsyncCommand,
				{
					playerId: identity.subject,
					gameStateId: gameState._id,
					command,
					commandType,
					target,
					outputId,
				},
			);

			return { outputId };
		}

		const { outputLines, success } = processSyncCommand({
			commandType,
			gameState,
		});

		const outputId = await ctx.db.insert("terminalOutput", {
			playerId: identity.subject,
			gameStateId: gameState._id,
			commandInput: command,
			outputLines,
			commandType,
			success,
		});

		return { outputId };
	},
});

export const executeAsyncCommand = internalAction({
	args: v.object({
		playerId: v.string(),
		gameStateId: v.id("gameState"),
		command: v.string(),
		commandType: v.string(),
		target: v.string(),
		outputId: v.id("terminalOutput"),
	}),
	handler: async (ctx, args) => {
		const gameStateDoc = await ctx.runQuery(
			internal.gameActions.getGameStateById,
			{ gameStateId: args.gameStateId },
		);

		if (!gameStateDoc) {
			await ctx.runMutation(internal.gameActions.writeCommandOutput, {
				playerId: args.playerId,
				gameStateId: args.gameStateId,
				commandInput: args.command,
				outputLines: [
					"Unable to process command.",
					"No active game state found.",
				],
				commandType: args.commandType,
				success: false,
				outputId: args.outputId,
			});
			return;
		}

		const gameState = docToGameState(gameStateDoc);

		try {
			switch (args.commandType) {
				case "ping": {
					const target = args.target || "localhost";
					const result = await ctx.runAction(
						api.agents.pingAgent.executePingCommand,
						{
							target,
							gameState: gameState,
							threadId: gameState.toolSessionId,
						},
					);

					await ctx.runMutation(internal.gameActions.writeCommandOutput, {
						playerId: args.playerId,
						gameStateId: args.gameStateId,
						commandInput: args.command,
						outputLines: result.output,
						commandType: args.commandType,
						success: result.success,
						outputId: args.outputId,
					});

					await ctx.runMutation(internal.gameActions.persistCommandGameState, {
						gameStateId: args.gameStateId,
						skillDelta: result.success ? result.skillGained : 0,
						toolSessionId: result.threadId ?? gameState.toolSessionId,
					});
					break;
				}
				default: {
					await ctx.runMutation(internal.gameActions.writeCommandOutput, {
						playerId: args.playerId,
						gameStateId: args.gameStateId,
						commandInput: args.command,
						outputLines: [
							`Command '${args.commandType}' is not yet implemented.`,
						],
						commandType: args.commandType,
						success: false,
						outputId: args.outputId,
					});
				}
			}
		} catch (error) {
			console.error("executeAsyncCommand error", error);
			await ctx.runMutation(internal.gameActions.writeCommandOutput, {
				playerId: args.playerId,
				gameStateId: args.gameStateId,
				commandInput: args.command,
				outputLines: [
					"An unexpected error occurred while processing the command.",
					"Please try again shortly.",
				],
				commandType: args.commandType,
				success: false,
				outputId: args.outputId,
			});
		}
	},
});

export const getCachedAsyncCommandResult = query({
	args: v.object({
		command: v.string(),
	}),
	returns: v.union(
		v.null(),
		v.object({
			commandType: v.string(),
			target: v.string(),
			output: v.array(v.string()),
			success: v.boolean(),
			skillGained: v.number(),
			threadId: v.optional(v.string()),
		}),
	),
	handler: async (ctx, { command }) => {
		const identity = await requireAuth(ctx);
		const { commandType, target } = parseCommandType(command);

		if (!isAsyncCommand(commandType)) {
			return null;
		}

		const gameStateDoc = await loadPlayerGameStateForQuery(
			ctx,
			identity.subject,
		);
		if (!gameStateDoc) {
			return null;
		}

		const normalizedTarget = target || "localhost";
		const cacheKey = generateCacheKey(
			commandType,
			normalizedTarget,
			docToGameState(gameStateDoc),
		);
		const hash = cacheKey.slice(cacheKey.lastIndexOf(":") + 1);

		const cached = await ctx.db
			.query("commandOutputCache")
			.withIndex("by_command_target_hash", (q) =>
				q
					.eq("command", commandType)
					.eq("target", normalizedTarget)
					.eq("gameStateHash", hash),
			)
			.first();

		if (!cached) {
			return null;
		}

		return {
			commandType,
			target: normalizedTarget,
			output: cached.output,
			success: cached.success,
			skillGained: cached.skillGained,
			threadId: cached.threadId,
		};
	},
});

export const getGameStateById = internalQuery({
	args: v.object({
		gameStateId: v.id("gameState"),
	}),
	handler: async (ctx, { gameStateId }) => {
		return await ctx.db.get(gameStateId);
	},
});

export const writeCommandOutput = internalMutation({
	args: v.object({
		playerId: v.string(),
		gameStateId: v.id("gameState"),
		commandInput: v.string(),
		outputLines: v.array(v.string()),
		commandType: v.string(),
		success: v.boolean(),
		outputId: v.id("terminalOutput"),
	}),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.outputId, {
			outputLines: args.outputLines,
			success: args.success,
		});
	},
});

export const persistCommandGameState = internalMutation({
	args: v.object({
		gameStateId: v.id("gameState"),
		skillDelta: v.optional(v.number()),
		toolSessionId: v.optional(v.string()),
	}),
	handler: async (ctx, { gameStateId, skillDelta, toolSessionId }) => {
		const state = await ctx.db.get(gameStateId);
		if (!state) {
			return;
		}

		const updates: Partial<Doc<"gameState">> = {};
		if (typeof skillDelta === "number" && skillDelta !== 0) {
			updates.skillPoints = (state.skillPoints ?? 0) + skillDelta;
		}
		if (toolSessionId !== undefined) {
			updates.toolSessionId = toolSessionId;
		}

		if (Object.keys(updates).length > 0) {
			await ctx.db.patch(gameStateId, updates);
		}
	},
});

// Record tool usage for learning progression tracking
export const recordToolUsage = internalMutation({
	args: v.object({
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
	}),
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
				enemies: enemies.map((enemy) => ({ ...enemy })), // Deep clone enemy roster
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

// Get the current game state for the authenticated player
export const getGameState = query({
	args: v.object({}),
	handler: async (ctx) => {
		// Ensure the caller is authenticated
		const identity = await requireAuth(ctx);

		const gameState = await ctx.db
			.query("gameState")
			.withIndex("by_player", (q) => q.eq("playerId", identity.subject))
			.order("desc")
			.first();

		return gameState;
	},
});

// Deterministic environment scan for the 'look' command
export const getLook = query({
	args: v.object({}),
	returns: v.object({ output: v.array(v.string()) }),
	handler: async (ctx) => {
		// Ensure the caller is authenticated and matches the playerId
		const identity = await requireAuth(ctx);

		const gameState = await ctx.db
			.query("gameState")
			.withIndex("by_player", (q) => q.eq("playerId", identity.subject))
			.order("desc")
			.first();

		if (!gameState) {
			return {
				output: [
					"[scanning]",
					"Environment sensors are warming up.",
					"Please run 'look' again once initialization completes.",
				],
			};
		}

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

type ProcessSyncCommandArgs = {
	commandType: string;
	gameState: Doc<"gameState">;
};

const ASYNC_COMMANDS = new Set(["ping"]);

function isAsyncCommand(commandType: string) {
	return commandType !== "" && ASYNC_COMMANDS.has(commandType);
}

function parseCommandType(command: string) {
	const normalized = command.trim().toLowerCase();
	if (!normalized) {
		return { commandType: "", target: "" };
	}
	const [commandType, ...rest] = normalized.split(/\s+/);
	return { commandType, target: rest.join(" ") };
}

function isSyncCommand(commandType: string) {
	return commandType !== "" && !ASYNC_COMMANDS.has(commandType);
}

async function loadPlayerGameState(ctx: MutationCtx, playerId: string) {
	const existingGameState = await ctx.db
		.query("gameState")
		.withIndex("by_player", (q) => q.eq("playerId", playerId))
		.order("desc")
		.first();

	if (!existingGameState) {
		throw new Error("Game state not initialized for player");
	}

	return existingGameState;
}

async function loadPlayerGameStateForQuery(ctx: QueryCtx, playerId: string) {
	return await ctx.db
		.query("gameState")
		.withIndex("by_player", (q) => q.eq("playerId", playerId))
		.order("desc")
		.first();
}

function docToGameState(doc: Doc<"gameState">): GameState {
	const { _id: _unusedId, _creationTime: _unusedCreationTime, ...rest } = doc;
	void _unusedId;
	void _unusedCreationTime;
	return rest as GameState;
}

function processSyncCommand({
	commandType,
	gameState,
}: ProcessSyncCommandArgs) {
	switch (commandType) {
		case "help":
			return {
				outputLines: [
					"Available commands:",
					"- look: Examine your surroundings",
					"- move [north|south|east|west]: Move in a direction",
					"- examine [object]: Look at something specific",
					"- take [item]: Pick up an item",
					"- use [item]: Use an item in your inventory",
					"- inventory: Check what you're carrying",
					"- status: Check your system status",
					"- fix [target]: Attempt to repair a broken system",
					"- tools: List available command-line tools",
					"- [toolname] help: Get help on a specific tool (e.g. 'ping help')",
					"- restart: Restart the game (if you're stuck)",
					"- help: Show this help text",
				],
				success: true,
			};
		case "look":
			return {
				outputLines: buildLookOutput(gameState),
				success: true,
			};
		case "tools":
			return {
				outputLines: buildToolsOutput(),
				success: true,
			};
		default:
			return {
				outputLines: [
					`Command '${commandType}' is not yet available on the server.`,
					"Type 'help' to review supported commands.",
				],
				success: false,
			};
	}
}

function buildLookOutput(gameState: Doc<"gameState">) {
	const room = rooms[gameState.currentRoom];
	if (!room) {
		return ["You look around but the area is undefined."];
	}

	const lines = [`[${room.name}]`, room.description];

	const exits = Object.entries(room.exits)
		.filter(([, destination]) => destination !== null)
		.map(([direction]) => direction);

	if (exits.length > 0) {
		lines.push("", `Exits: ${exits.join(", ")}`);
	} else {
		lines.push("", "There are no visible exits.");
	}

	const roomEnemies = gameState.enemies.filter(
		(enemy) => enemy.location === gameState.currentRoom && !enemy.defeated,
	);
	if (roomEnemies.length > 0) {
		lines.push("", "ALERT! System threats detected:");
		for (const enemy of roomEnemies) {
			lines.push(`- ${enemy.name}: ${enemy.description}`);
		}
	}

	return lines;
}

function buildToolsOutput() {
	const lines = [
		"You inspect the ~/bin directory and note the following utilities:",
		"",
		"$ ls -l ~/bin",
	];

	for (const tool of commandLineTools) {
		lines.push(
			`${tool.name.padEnd(10, " ")} -> ${tool.description} (usage: ${tool.syntax})`,
		);
	}

	return lines;
}
