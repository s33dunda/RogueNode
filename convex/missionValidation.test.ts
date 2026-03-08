import { describe, expect, it } from "vitest";
import { validateAndPrepareUpdate } from "./missionValidation";
import type { MissionProgressEntry } from "./types";

const baseProgress: MissionProgressEntry = {
	_id: "mission-progress-1" as MissionProgressEntry["_id"],
	_creationTime: 1,
	playerId: "player-1",
	gameStateId: "game-state-1" as MissionProgressEntry["gameStateId"],
	missionId: "ping-tutorial",
	currentStepIndex: 0,
	completedSteps: [],
	status: "in_progress",
	startedAt: 1,
};

describe("mission validation", () => {
	it("records a deterministic completion attempt when the command matches", () => {
		const { changes, result } = validateAndPrepareUpdate(
			baseProgress,
			"ping main-server",
			() => 1234,
		);

		expect(result).toMatchObject({
			matched: true,
			missionComplete: true,
			skillGained: 10,
		});
		expect(changes).toMatchObject({
			currentStepIndex: 1,
			status: "completed",
			completedAt: 1234,
			completedSteps: [
				expect.objectContaining({
					playerCommand: "ping main-server",
					matched: true,
					timestamp: 1234,
				}),
			],
		});
	});

	it("keeps the mission in progress when the command does not match", () => {
		const { changes, result } = validateAndPrepareUpdate(
			baseProgress,
			"ping localhost",
			() => 2222,
		);

		expect(result).toMatchObject({
			matched: false,
			missionComplete: false,
			skillGained: 0,
		});
		expect(changes).toMatchObject({
			currentStepIndex: 0,
			status: "in_progress",
			completedSteps: [
				expect.objectContaining({
					playerCommand: "ping localhost",
					matched: false,
					timestamp: 2222,
				}),
			],
		});
		expect(changes?.completedAt).toBeUndefined();
	});

	it("returns a stable no-op result for non-active progress", () => {
		const { changes, result } = validateAndPrepareUpdate(
			{
				...baseProgress,
				status: "completed",
			},
			"ping main-server",
		);

		expect(changes).toBeNull();
		expect(result.feedback).toContain("No active mission found. Start a mission first.");
	});
});
