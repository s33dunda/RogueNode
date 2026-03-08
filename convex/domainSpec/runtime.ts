import { domainData, missionList, missionPlans } from "./data";
import type { MissionSpec, PlanStepSpec } from "./schema";

// Shared domain bundle for both runtime code and tests.
export const runtime = {
	domain: domainData,
	missions: missionList,
	plans: missionPlans,
} as const;

export function getMissionById(missionId: string): MissionSpec | undefined {
	return missionList.find((m) => m.id === missionId);
}

export function getMissionPlan(
	missionId: string,
): PlanStepSpec[] | undefined {
	const mission = getMissionById(missionId);
	return mission?.optimalPlan;
}

export function matchesStep(
	playerCommand: string,
	expectedStep: PlanStepSpec,
): boolean {
	const normalized = playerCommand.trim().toLowerCase();
	const [action, ...targetParts] = normalized.split(/\s+/);
	const target = targetParts.join(" ");

	const actionMatches = action === expectedStep.action.toLowerCase();
	const targetMatches =
		!expectedStep.target || target === expectedStep.target.toLowerCase();

	return actionMatches && targetMatches;
}

export function getMissionsForRoom(roomId: string): MissionSpec[] {
	return missionList.filter((m) => m.entryRoomId === roomId);
}

export function hasPlan(missionId: string): boolean {
	return (getMissionPlan(missionId)?.length ?? 0) > 0;
}
