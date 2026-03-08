import { domainData, missionList, toolCatalog } from "./domainSpec/data";
import type { RoomSpec } from "./domainSpec/schema";
import type { CommandLineTool, Room, RoomsRecord } from "./types";

/**
 * Game map dimensions (for future expansion)
 */
export const gameMap = {
	width: 1,
	height: 1,
};

function toRoom(room: RoomSpec): Room {
	return {
		id: room.id,
		name: room.name,
		description: room.description,
		exits: { ...room.exits },
	};
}

function buildRoomsRecord(domainRooms: readonly RoomSpec[]): RoomsRecord {
	const roomMap: RoomsRecord = {};
	for (const room of domainRooms) {
		roomMap[room.id] = toRoom(room);
	}
	return roomMap;
}

export const rooms = buildRoomsRecord(domainData.rooms);

/**
 * Enemy roster from domain specification
 *
 * These are the base enemy definitions. Each player's game state
 * gets a deep clone of this array to track defeated enemies.
 */
export const enemies = domainData.enemies;

/**
 * Mission definitions from domain specification
 *
 * Includes mission metadata, optimal plans, and problem references.
 */
export const missions = missionList;

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

const [firstRoom] = domainData.rooms;

if (!firstRoom) {
	throw new Error("Domain data must define at least one room");
}

export const initialRoom = toRoom(firstRoom);
