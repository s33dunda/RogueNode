import type { CommandLineTool, Room, RoomsRecord } from "../convex/types";
import { enemyList, roomList, toolCatalog } from "../packages/domain-spec";

export const gameMap = {
	width: 1,
	height: 1,
};

export const rooms: RoomsRecord = roomList.reduce((acc, room) => {
	acc[room.id] = room as Room;
	return acc;
}, {} as RoomsRecord);

export const enemies = enemyList;

export const commandLineTools: CommandLineTool[] = toolCatalog.map((tool) => ({
	name: tool.name,
	syntax: tool.syntax,
	description: tool.description,
	example: tool.example,
	explanation: tool.explanation,
}));

export const initialRoom: Room = rooms[roomList[0]?.id ?? "server-room"];
