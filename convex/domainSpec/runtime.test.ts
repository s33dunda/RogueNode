import { describe, expect, it } from "vitest";
import {
	getMissionById,
	getMissionPlan,
	getMissionsForRoom,
	hasPlan,
	matchesStep,
} from "./runtime";

describe("domainSpec runtime helpers", () => {
	it("finds the starter mission and its plan", () => {
		const mission = getMissionById("ping-tutorial");
		const plan = getMissionPlan("ping-tutorial");

		expect(mission?.title).toBe("Bring the server online");
		expect(plan).toBeDefined();
		expect(plan).not.toHaveLength(0);
		expect(hasPlan("ping-tutorial")).toBe(true);
		expect(getMissionPlan("missing-mission")).toBeUndefined();
		expect(hasPlan("missing-mission")).toBe(false);
	});

	it("filters missions by room", () => {
		expect(getMissionsForRoom("server-room").map((mission) => mission.id)).toEqual(
			["ping-tutorial"],
		);
		expect(getMissionsForRoom("missing-room")).toEqual([]);
	});

	it("matches commands case-insensitively", () => {
		const [firstStep] = getMissionPlan("ping-tutorial");
		expect(firstStep).toBeDefined();
		expect(matchesStep("PING MAIN-SERVER", firstStep!)).toBe(true);
		expect(matchesStep("ping localhost", firstStep!)).toBe(false);
	});
});
