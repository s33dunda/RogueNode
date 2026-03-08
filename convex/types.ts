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

export const commandOutputCacheFields = {
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
};

export const terminalOutputFields = {
	playerId: v.string(),
	gameStateId: v.id("gameState"),
	commandInput: v.string(),
	outputLines: v.array(v.string()),
	commandType: v.string(),
	success: v.boolean(),
};

export const missionProgressStep = v.object({
	stepIndex: v.number(),
	playerCommand: v.string(),
	expectedAction: v.string(),
	matched: v.boolean(),
	timestamp: v.number(),
});

export const missionProgressStatus = v.union(
	v.literal("not_started"),
	v.literal("in_progress"),
	v.literal("completed"),
	v.literal("failed"),
);

export const missionProgressFields = {
	playerId: v.string(),
	gameStateId: v.id("gameState"),
	missionId: v.string(),
	currentStepIndex: v.number(),
	completedSteps: v.array(missionProgressStep),
	status: missionProgressStatus,
	startedAt: v.number(),
	completedAt: v.optional(v.number()),
};

// Command output cache validator (matches schema exactly)
export const commandOutputCacheEntry = v.object({
	_id: v.id("commandOutputCache"),
	_creationTime: v.number(),
	...commandOutputCacheFields,
});

// Terminal output entry validator (matches terminalOutput table schema)
export const terminalOutputEntry = v.object({
	_id: v.id("terminalOutput"),
	_creationTime: v.number(),
	...terminalOutputFields,
});

// Mission progress entry validator (matches missionProgress table schema)
export const missionProgressEntry = v.object({
	_id: v.id("missionProgress"),
	_creationTime: v.number(),
	...missionProgressFields,
});

// Mission step validation result (matches validateMissionStep response)
export const missionStepValidationResult = v.object({
	matched: v.boolean(),
	expectedAction: v.string(),
	feedback: v.array(v.string()),
	missionComplete: v.boolean(),
	skillGained: v.number(),
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
export type TerminalOutputEntry = Infer<typeof terminalOutputEntry>;
export type MissionProgressEntry = Infer<typeof missionProgressEntry>;
export type MissionProgressStatus = Infer<typeof missionProgressStatus>;
export type MissionStepValidationResult = Infer<
	typeof missionStepValidationResult
>;
