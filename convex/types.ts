import { type Infer, v } from "convex/values";

// Item validator for game inventory (functions excluded - handled on frontend)
export const item = v.object({
	id: v.string(),
	name: v.string(),
	description: v.string(),
	location: v.string(),
	taken: v.boolean(),
	aliases: v.optional(v.array(v.string())),
	examineText: v.optional(v.string()),
	onTake: v.optional(v.string()),
	// Note: 'use' function is handled on frontend, not serialized to database
});

// Enemy validator for game threats
export const enemy = v.object({
	id: v.string(),
	name: v.string(),
	description: v.string(),
	location: v.string(),
	defeated: v.boolean(),
	requiredItemId: v.string(),
	aliases: v.array(v.string()),
	examineText: v.string(),
	failMessage: v.string(),
	defeatMessage: v.string(),
});

// Shared GameState type for consistent validation across the application
export const gameState = v.object({
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
});

// Room validator for game world
export const room = v.object({
	id: v.string(),
	name: v.string(),
	description: v.string(),
	exits: v.object({
		north: v.union(v.string(), v.null()),
		south: v.union(v.string(), v.null()),
		east: v.union(v.string(), v.null()),
		west: v.union(v.string(), v.null()),
	}),
});

// Record of rooms keyed by room ID
export const roomsRecord = v.record(v.string(), room);

// Command line tool validator for game help system
export const commandLineTool = v.object({
	name: v.string(),
	syntax: v.string(),
	description: v.string(),
	example: v.string(),
	explanation: v.string(),
});

// Command arguments type
export const commandArgs = v.object({
	target: v.string(),
	gameState: gameState,
	threadId: v.optional(v.string()),
});

// Command execution result type
export const commandResult = v.object({
	output: v.array(v.string()),
	threadId: v.optional(v.string()),
	skillGained: v.number(),
	success: v.boolean(),
});

// Frontend-only Item type that includes the use function
export interface ItemWithFunctions extends Item {
	use?: (gameState: GameState) => {
		message: string[];
		updateState?: Partial<GameState>;
	};
}

// Action function type for executePingCommand
export type ExecuteCommandAction = {
	args: {
		target: string;
		gameState: GameState;
		threadId?: string;
	};
	returns: CommandResult;
};

// Command output cache validator (matches schema exactly)
export const commandOutputCacheEntry = v.object({
	_id: v.id("commandOutputCache"),
	_creationTime: v.number(),
	command: v.string(),
	target: v.string(),
	gameStateHash: v.string(),
	output: v.array(v.string()),
	skillGained: v.number(),
	success: v.boolean(),
	playerId: v.string(),
	timestamp: v.number(),
	hitCount: v.number(),
	threadId: v.optional(v.string()),
});

// TypeScript types derived from validators
export type Item = Infer<typeof item>;
export type Enemy = Infer<typeof enemy>;
export type Room = Infer<typeof room>;
export type RoomsRecord = Infer<typeof roomsRecord>;
export type CommandLineTool = Infer<typeof commandLineTool>;
export type GameState = Infer<typeof gameState>;
export type CommandResult = Infer<typeof commandResult>;
export type CommandArgs = Infer<typeof commandArgs>;
export type CommandOutputCacheEntry = Infer<typeof commandOutputCacheEntry>;
