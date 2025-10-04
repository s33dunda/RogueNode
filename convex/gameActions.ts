import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	query,
} from "./_generated/server";
import { getMissionById } from "./domainSpec/runtime";
import { commandLineTools, enemies, rooms } from "./gameData";
import { requireAuth } from "./lib/auth";
import type { GameState } from "./types";
import { enemy, item, terminalOutputEntry } from "./types";
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

export const sendCommand = mutation({
	args: v.object({
		command: v.string(),
	}),
	returns: v.object({
		outputId: v.id("terminalOutput"),
	}),
	handler: async (
		ctx,
		{ command },
	): Promise<{ outputId: Id<"terminalOutput"> }> => {
		const identity = await requireAuth(ctx);
		const trimmed = command.trim();
		const { commandType, target } = parseCommandType(trimmed);

		const gameState = await loadPlayerGameState(ctx, identity.subject);

		if (!commandType) {
			const outputId: Id<"terminalOutput"> = await ctx.db.insert(
				"terminalOutput",
				{
					playerId: identity.subject,
					gameStateId: gameState._id,
					commandInput: command,
					outputLines: [],
					commandType,
					success: false,
				},
			);
			return { outputId };
		}

		if (!isSyncCommand(commandType)) {
			const normalizedTarget = target || "localhost";
			const normalizedState = docToGameState(gameState);
			const cacheKey = generateCacheKey(
				commandType,
				normalizedTarget,
				normalizedState,
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

			if (cached) {
				await ctx.runMutation(internal.utils.cacheUtils.incrementCacheHit, {
					cacheId: cached._id,
				});

				// Validate against active missions even for cached commands
				const activeMissions: Array<{ missionId: string }> = await ctx.runQuery(
					internal.missions.getActiveMissions,
					{
						playerId: identity.subject,
					},
				);

				let missionFeedback: string[] = [];
				let totalMissionSkillGained = 0;
				if (activeMissions.length > 0) {
					const aggregated = await ctx.runMutation(
						internal.missions.validateAllMissionSteps,
						{
							playerId: identity.subject,
							missionIds: activeMissions.map((mission) => mission.missionId),
							playerCommand: command,
						},
					);
					missionFeedback = aggregated.feedback;
					totalMissionSkillGained = aggregated.totalSkillGained;
				}

				// Combine cached output with mission feedback
				const outputLines: string[] = [
					...cached.output,
					...(missionFeedback.length > 0
						? ["", "=== Mission Progress ===", ...missionFeedback]
						: activeMissions.length === 0
							? []
							: []),
				];

				const outputId: Id<"terminalOutput"> = await ctx.db.insert(
					"terminalOutput",
					{
						playerId: identity.subject,
						gameStateId: gameState._id,
						commandInput: command,
						outputLines,
						commandType,
						success: cached.success,
					},
				);

				await ctx.runMutation(internal.gameActions.persistCommandGameState, {
					gameStateId: gameState._id,
					skillDelta: cached.success
						? cached.skillGained + totalMissionSkillGained
						: 0,
					toolSessionId: cached.threadId ?? normalizedState.toolSessionId,
				});

				return { outputId };
			}

			const outputId: Id<"terminalOutput"> = await ctx.db.insert(
				"terminalOutput",
				{
					playerId: identity.subject,
					gameStateId: gameState._id,
					commandInput: command,
					outputLines: ["Processing..."],
					commandType,
					success: false,
				},
			);

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

		const outputId: Id<"terminalOutput"> = await ctx.db.insert(
			"terminalOutput",
			{
				playerId: identity.subject,
				gameStateId: gameState._id,
				commandInput: command,
				outputLines,
				commandType,
				success,
			},
		);

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
	returns: v.null(),
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
						internal.agents.pingAgent.executePingCommand,
						{
							target,
							gameState: gameState,
							threadId: gameState.toolSessionId,
						},
					);

					// Get all active missions for this player
					const activeMissions = await ctx.runQuery(
						internal.missions.getActiveMissions,
						{
							playerId: args.playerId,
						},
					);

					// Validate command against all active missions
					let missionFeedback: string[] = [];
					let totalMissionSkillGained = 0;
					if (activeMissions.length > 0) {
						const aggregated = await ctx.runMutation(
							internal.missions.validateAllMissionSteps,
							{
								playerId: args.playerId,
								missionIds: activeMissions.map((mission) => mission.missionId),
								playerCommand: args.command,
							},
						);
						missionFeedback = aggregated.feedback;
						totalMissionSkillGained = aggregated.totalSkillGained;
					}

					// Combine command output with mission feedback
					const outputLines = [
						...result.output,
						...(missionFeedback.length > 0
							? ["", "=== Mission Progress ===", ...missionFeedback]
							: activeMissions.length === 0
								? [
										"",
										"=== Mission Progress ===",
										"No active mission found. Start a mission first.",
									]
								: []),
					];

					await ctx.runMutation(internal.gameActions.writeCommandOutput, {
						playerId: args.playerId,
						gameStateId: args.gameStateId,
						commandInput: args.command,
						outputLines,
						commandType: args.commandType,
						success: result.success,
						outputId: args.outputId,
					});

					await ctx.runMutation(internal.gameActions.persistCommandGameState, {
						gameStateId: args.gameStateId,
						skillDelta: result.success
							? result.skillGained + totalMissionSkillGained
							: 0,
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

export const getGameStateById = internalQuery({
	args: v.object({
		gameStateId: v.id("gameState"),
	}),
	returns: v.union(
		v.object({
			_id: v.id("gameState"),
			_creationTime: v.number(),
			currentRoom: v.string(),
			inventory: v.array(item),
			health: v.number(),
			visited: v.array(v.string()),
			enemies: v.array(enemy),
			gameOver: v.boolean(),
			playerId: v.string(),
			toolSessionId: v.optional(v.string()),
			skillPoints: v.number(),
			threatLevel: v.number(),
		}),
		v.null(),
	),
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
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.outputId, {
			outputLines: args.outputLines,
			success: args.success,
		});
		return null;
	},
});

export const persistCommandGameState = internalMutation({
	args: v.object({
		gameStateId: v.id("gameState"),
		skillDelta: v.optional(v.number()),
		toolSessionId: v.optional(v.string()),
	}),
	returns: v.null(),
	handler: async (ctx, { gameStateId, skillDelta, toolSessionId }) => {
		const state = await ctx.db.get(gameStateId);
		if (!state) {
			return null;
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
		return null;
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
	returns: v.union(
		v.object({
			_id: v.id("gameState"),
			_creationTime: v.number(),
			currentRoom: v.string(),
			inventory: v.array(item),
			health: v.number(),
			visited: v.array(v.string()),
			enemies: v.array(enemy),
			gameOver: v.boolean(),
			playerId: v.string(),
			toolSessionId: v.optional(v.string()),
			skillPoints: v.number(),
			threatLevel: v.number(),
		}),
		v.null(),
	),
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

/**
 * Extracts the command type and target from a raw command string.
 *
 * Trims whitespace, lowercases the input, and splits on the first token. If the input is empty or whitespace, both `commandType` and `target` are empty strings.
 *
 * @param command - Raw user-entered command string (may include leading/trailing whitespace and multiple words)
 * @returns An object with `commandType` set to the first token and `target` set to the remaining text joined by spaces; both are `""` when the input contains no tokens.
 */
function parseCommandType(command: string) {
	const normalized = command.trim().toLowerCase();
	if (!normalized) {
		return { commandType: "", target: "" };
	}
	const [commandType, ...rest] = normalized.split(/\s+/);
	return { commandType, target: rest.join(" ") };
}

/**
 * Determine whether a command type should be processed synchronously.
 *
 * @param commandType - The normalized command name provided by the player (e.g., "look", "ping")
 * @returns `true` if `commandType` is a non-empty string that should be handled synchronously, `false` otherwise.
 */
function isSyncCommand(commandType: string) {
	return commandType !== "" && !ASYNC_COMMANDS.has(commandType);
}

/**
 * Retrieve the most recent gameState document for the specified player.
 *
 * @param ctx - Mutation context providing database access
 * @param playerId - The player's identifier whose game state to load
 * @returns The latest `gameState` document for `playerId`
 * @throws Error if no game state exists for the player
 *
 * @example
 * const state = await loadPlayerGameState(ctx, identity.subject);
 */
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

/**
 * Convert a Convex `Doc<"gameState">` into a plain `GameState` by removing internal Convex metadata.
 *
 * Use this after loading a `gameState` document from the database to obtain a value suitable for
 * game logic and serialization; the result represents the stored game state without `_id` or
 * `_creationTime` metadata.
 *
 * @param doc - The Convex document for a game state
 * @returns The `GameState` object with Convex-specific fields removed
 */
function docToGameState(doc: Doc<"gameState">): GameState {
	const { _id: _unusedId, _creationTime: _unusedCreationTime, ...rest } = doc;
	void _unusedId;
	void _unusedCreationTime;
	return rest as GameState;
}

/**
 * Execute a built-in synchronous game command and produce terminal lines with a success flag.
 *
 * @param args.commandType - The normalized command name to execute (e.g., "look", "help", "tools").
 * @param args.gameState - The authenticated player's current game state (read-only) used to generate command output; caller must supply the latest game state for meaningful results.
 * @returns An object with `outputLines` containing terminal display lines and `success` set to `true` if the command completed successfully, `false` otherwise.
 *
 * @example
 * // Example usage within an authenticated mutation:
 * // processSyncCommand({ commandType: "look", gameState: playerGameState })
 *
 * @example
 * // Typical return for unknown command:
 * // {
 * //   outputLines: ["Command 'foo' is not yet available on the server.", "Type 'help' to review supported commands."],
 * //   success: false
 * // }
 */
function processSyncCommand({
	commandType,
	gameState,
}: ProcessSyncCommandArgs) {
	switch (commandType) {
		case "help":
			return {
				outputLines: [
					"Available commands:",
					"- look: Inspect your current environment",
					"- tools: List available DevOps command-line tools",
					"- missions: View and start available missions",
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

/**
 * Builds the array of text lines displayed to the player for their current room.
 *
 * If the game's current room is not defined, returns a single-line message indicating the area is undefined.
 *
 * @param gameState - The game state document used to determine currentRoom, visible exits, and non-defeated enemies
 * @returns An array of strings containing the room header, description, exits (or absence of exits), and any active threat lines
 */
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

/**
 * Build a textual, line-by-line description of available command-line tools for the player.
 *
 * The output is suitable for writing to the game's terminal UI and lists each tool's name,
 * short description, and example syntax.
 *
 * @returns An array of lines (`string[]`) representing the terminal output for the tools listing.
 *
 * @example
 * // Result can be written directly to a terminal output document:
 * const lines = buildToolsOutput();
 * // lines -> [
 * //   "You inspect the ~/bin directory and note the following utilities:",
 * //   "",
 * //   "$ ls -l ~/bin",
 * //   "ping       -> Send ICMP-style probe (usage: ping <host>)",
 * //   "scan       -> Quick port scan (usage: scan <host> <ports>)",
 * //   ...
 * // ]
 */
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

export const getTerminalOutput = query({
	args: {},
	returns: v.array(terminalOutputEntry),
	handler: async (ctx) => {
		const identity = await requireAuth(ctx);
		const outputs = await ctx.db
			.query("terminalOutput")
			.withIndex("by_player", (q) => q.eq("playerId", identity.subject))
			.order("desc") // sorted by `_creationTime`
			.take(50);
		return outputs.reverse(); // Chronological order
	},
});

// ============================================================================
// Mission System - PDDL Integration
// ============================================================================

/**
 * Public mutation: Start a mission (with auth)
 *
 * Initiates a new mission for the authenticated player. Creates a progress
 * tracker and returns mission details for UI display.
 */
export const startMission = mutation({
	args: { missionId: v.string() },
	returns: v.object({
		missionProgressId: v.id("missionProgress"),
		mission: v.object({
			id: v.string(),
			title: v.string(),
			synopsis: v.string(),
		}),
	}),
	handler: async (
		ctx,
		{ missionId },
	): Promise<{
		missionProgressId: Id<"missionProgress">;
		mission: { id: string; title: string; synopsis: string };
	}> => {
		const identity = await requireAuth(ctx);
		const gameState = await loadPlayerGameState(ctx, identity.subject);

		// Validate mission before creating any progress records
		const mission = getMissionById(missionId);
		if (!mission) {
			throw new Error(`Mission ${missionId} not found`);
		}

		// Verify mission is available in current room with progress status check
		const missionsInRoom = await ctx.runQuery(
			internal.missions.getMissionsWithProgress,
			{
				playerId: identity.subject,
				roomId: gameState.currentRoom,
			},
		);
		const missionInRoom = missionsInRoom.find((m) => m.id === missionId);
		if (!missionInRoom || missionInRoom.status === "completed") {
			throw new Error(
				`Mission ${missionId} is not available in room ${gameState.currentRoom}`,
			);
		}

		const missionProgressId: Id<"missionProgress"> = await ctx.runMutation(
			internal.missions.startMission,
			{
				playerId: identity.subject,
				gameStateId: gameState._id,
				missionId,
			},
		);

		return {
			missionProgressId,
			mission: {
				id: mission.id,
				title: mission.title,
				synopsis: mission.synopsis,
			},
		};
	},
});

/**
 * Public query: Get active missions for current room
 *
 * Returns all missions available in the player's current room along with
 * their completion status (available, in_progress, completed).
 */
export const getActiveMissions = query({
	args: {},
	returns: v.array(
		v.object({
			id: v.string(),
			title: v.string(),
			synopsis: v.string(),
			status: v.union(
				v.literal("available"),
				v.literal("in_progress"),
				v.literal("completed"),
			),
		}),
	),
	handler: async (
		ctx,
	): Promise<
		Array<{
			id: string;
			title: string;
			synopsis: string;
			status: "available" | "in_progress" | "completed";
		}>
	> => {
		const identity = await requireAuth(ctx);
		const gameState = await ctx.db
			.query("gameState")
			.withIndex("by_player", (q) => q.eq("playerId", identity.subject))
			.order("desc")
			.first();

		if (!gameState) {
			return [];
		}

		const missionsWithProgress: Array<{
			id: string;
			title: string;
			synopsis: string;
			status: "available" | "in_progress" | "completed";
			progressId?: Id<"missionProgress">;
		}> = await ctx.runQuery(internal.missions.getMissionsWithProgress, {
			playerId: identity.subject,
			roomId: gameState.currentRoom,
		});

		// Strip progressId before returning to client
		return missionsWithProgress.map(({ progressId: _unused, ...mission }) => {
			void _unused;
			return mission;
		});
	},
});
