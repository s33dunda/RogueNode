import { domainData, missionList, toolCatalog } from "./domainSpec/data";
import type { RoomSpec } from "./domainSpec/schema";
import type { CommandLineTool, Room, RoomsRecord } from "./types";

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

export const enemies = domainData.enemies;

export const missions = missionList;

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
