import type { MissionProgressEntry, MissionStepValidationResult } from "./types";
import { getMissionPlan, matchesStep } from "./domainSpec/runtime";

export type MissionProgressPatch = Pick<
	MissionProgressEntry,
	"currentStepIndex" | "completedSteps" | "status" | "completedAt"
>;

type MissionValidationClock = () => number;

export function validateAndPrepareUpdate(
	progress: MissionProgressEntry,
	playerCommand: string,
	now: MissionValidationClock = Date.now,
): {
	id: MissionProgressEntry["_id"];
	changes: MissionProgressPatch | null;
	result: MissionStepValidationResult;
} {
	if (progress.status !== "in_progress") {
		return {
			id: progress._id,
			changes: null,
			result: {
				matched: false,
				expectedAction: "",
				feedback: ["No active mission found. Start a mission first."],
				missionComplete: false,
				skillGained: 0,
			},
		};
	}

	const plan = getMissionPlan(progress.missionId);
	if (plan.length === 0) {
		return {
			id: progress._id,
			changes: null,
			result: {
				matched: false,
				expectedAction: "",
				feedback: ["Mission has no validation plan."],
				missionComplete: false,
				skillGained: 0,
			},
		};
	}

	const currentStep = plan[progress.currentStepIndex];
	if (!currentStep) {
		return {
			id: progress._id,
			changes: null,
			result: {
				matched: false,
				expectedAction: "",
				feedback: ["Mission already complete."],
				missionComplete: true,
				skillGained: 0,
			},
		};
	}

	const matched = matchesStep(playerCommand, currentStep);
	const nextStepIndex = matched
		? progress.currentStepIndex + 1
		: progress.currentStepIndex;
	const missionComplete = matched && nextStepIndex >= plan.length;
	const timestamp = now();

	const feedback = matched
		? [
				`✓ Correct! ${currentStep.description}`,
				missionComplete
					? "Mission complete! Well done."
					: `Next step: ${plan[nextStepIndex]?.description ?? "Unknown"}`,
			]
		: [
				`✗ Not quite. Expected: ${currentStep.action} ${
					currentStep.target ?? ""
				}`,
				`Hint: ${currentStep.description}`,
			];

	const changes: MissionProgressPatch = {
		currentStepIndex: nextStepIndex,
		completedSteps: [
			...progress.completedSteps,
			{
				stepIndex: progress.currentStepIndex,
				playerCommand,
				expectedAction: currentStep.action,
				matched,
				timestamp,
			},
		],
		status: missionComplete ? "completed" : "in_progress",
		...(missionComplete ? { completedAt: timestamp } : {}),
	};

	return {
		id: progress._id,
		changes,
		result: {
			matched,
			expectedAction:
				`${currentStep.action} ${currentStep.target ?? ""}`.trim(),
			feedback,
			missionComplete,
			skillGained: matched ? 10 : 0,
		},
	};
}
