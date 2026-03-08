import { describe, expect, it } from "vitest";
import {
	commandOutputCacheFields,
	missionProgressFields,
	missionProgressStatus,
	terminalOutputFields,
} from "./types";

describe("shared convex validators", () => {
	it("defines reusable field maps for schema-backed tables", () => {
		expect(Object.keys(commandOutputCacheFields)).toEqual([
			"command",
			"target",
			"gameStateHash",
			"output",
			"skillGained",
			"success",
			"playerId",
			"timestamp",
			"hitCount",
			"threadId",
		]);
		expect(Object.keys(terminalOutputFields)).toEqual([
			"playerId",
			"gameStateId",
			"commandInput",
			"outputLines",
			"commandType",
			"success",
		]);
		expect(Object.keys(missionProgressFields)).toEqual([
			"playerId",
			"gameStateId",
			"missionId",
			"currentStepIndex",
			"completedSteps",
			"status",
			"startedAt",
			"completedAt",
		]);
		expect(missionProgressStatus).toBeDefined();
	});
});
