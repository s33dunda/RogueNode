/**
 * Game Data Module - Convex Backend
 *
 * This module provides game data (rooms, enemies, missions, tools) for use
 * within Convex functions. It imports from the canonical domain-spec runtime
 * to ensure consistency across the application.
 *
 * This replaces the old utils/GameData.ts for backend usage.
 */

import { runtime, toolCatalog } from "./domainSpec";
import type { CommandLineTool, Room, RoomsRecord } from "./types";

/**
 * Game map dimensions (for future expansion)
 */
export const gameMap = {
	width: 1,
	height: 1,
};

/**
 * Rooms indexed by room ID for fast lookup
 *
 * Converts the array of rooms from domain-spec into a record
 * for O(1) access by room ID.
 */
export const rooms: RoomsRecord = runtime.domain.rooms.reduce((acc, room) => {
	acc[room.id] = room as Room;
	return acc;
}, {} as RoomsRecord);

/**
 * Enemy roster from domain specification
 *
 * These are the base enemy definitions. Each player's game state
 * gets a deep clone of this array to track defeated enemies.
 */
export const enemies = runtime.domain.enemies;

/**
 * Mission definitions from domain specification
 *
 * Includes mission metadata, optimal plans, and problem references.
 */
export const missions = runtime.missions;

/**
 * Command-line tools available to players
 *
 * Maps the tool catalog from domain-spec to the CommandLineTool type
 * used by the game's help system.
 */
export const commandLineTools: CommandLineTool[] = toolCatalog.map((tool) => ({
	name: tool.name,
	syntax: tool.syntax,
	description: tool.description,
	example: tool.example,
	explanation: tool.explanation,
}));

/**
 * Initial/starting room for new players
 *
 * Defaults to "server-room" if no rooms are defined.
 */
export const initialRoom: Room =
	rooms[runtime.domain.rooms[0]?.id ?? "server-room"];
