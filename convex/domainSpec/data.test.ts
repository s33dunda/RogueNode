import { describe, expect, it } from "vitest";
import {
	domainData,
	missionList,
	missionPlanMetadata,
	missionPlanSequences,
	roomList,
	toolCatalog,
} from "./data";

describe("domainSpec data", () => {
	it("keeps a non-empty domain bundle", () => {
		expect(domainData.rooms).not.toHaveLength(0);
		expect(roomList.map((room) => room.id)).toContain("server-room");
		expect(missionList.map((mission) => mission.id)).toContain("ping-tutorial");
	});

	it("exposes generated plan metadata for the starter problem", () => {
		expect(missionPlanSequences["poc-reachability"]).toBeDefined();
		expect(missionPlanSequences["poc-reachability"].length).toBeGreaterThan(0);
		expect(missionPlanMetadata["poc-reachability"]).not.toBeNull();
	});

	it("publishes the starter tool catalog", () => {
		expect(toolCatalog).toEqual([
			expect.objectContaining({
				name: "ping",
				syntax: "ping <host>",
			}),
		]);
	});
});
