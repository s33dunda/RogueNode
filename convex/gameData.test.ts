import { describe, expect, it } from "vitest";
import { commandLineTools, initialRoom, missions, rooms } from "./gameData";

describe("game data", () => {
	it("builds a room record keyed by room id", () => {
		expect(rooms[initialRoom.id]).toEqual(initialRoom);
	});

	it("keeps missions and tools aligned with the starter domain", () => {
		expect(missions.map((mission) => mission.id)).toContain("ping-tutorial");
		expect(commandLineTools).toEqual([
			expect.objectContaining({
				name: "ping",
				description: expect.stringContaining("reachability"),
			}),
		]);
	});
});
