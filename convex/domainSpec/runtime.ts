import { domainData, missionList, missionPlans } from "./data";
import type { MissionSpec, PlanStepSpec } from "./schema";

/**
 * Runtime bundle - import this in both Convex and client code
 *
 * This module provides a single source of truth for game data + plan artifacts,
 * ensuring consistency between backend validation and frontend display.
 */
export const runtime = {
	domain: domainData,
	missions: missionList,
	plans: missionPlans,
} as const;

/**
 * Get mission by ID with type safety
 *
 * @param missionId - The unique identifier for the mission
 * @returns The mission specification or undefined if not found
 *
 * @example
 * const mission = getMissionById("ping-tutorial");
 * if (mission) {
 *   console.log(mission.title); // "Bring the server online"
 * }
 */
export function getMissionById(missionId: string): MissionSpec | undefined {
	return missionList.find((m) => m.id === missionId);
}

/**
 * Get optimal plan for a mission
 *
 * @param missionId - The unique identifier for the mission
 * @returns Array of plan steps, or empty array if mission has no plan
 *
 * @example
 * const plan = getMissionPlan("ping-tutorial");
 * console.log(plan); // [{ action: "ping", target: "main-server", ... }]
 */
export function getMissionPlan(missionId: string): PlanStepSpec[] {
	const mission = getMissionById(missionId);
	return mission?.optimalPlan ?? [];
}

/**
 * Check if player command matches expected plan step
 *
 * Performs case-insensitive matching of command action and optional target.
 * Handles whitespace normalization and multi-word targets.
 *
 * @param playerCommand - Raw command string from player (e.g., "ping main-server")
 * @param expectedStep - The plan step to validate against
 * @returns true if command matches the expected action and target
 *
 * @example
 * const step = { action: "ping", target: "main-server", description: "..." };
 * matchesStep("ping main-server", step); // true
 * matchesStep("PING MAIN-SERVER", step); // true (case-insensitive)
 * matchesStep("ping localhost", step);   // false (wrong target)
 * matchesStep("ssh main-server", step);  // false (wrong action)
 */
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

/**
 * Get all missions available in a specific room
 *
 * @param roomId - The room identifier to search for missions
 * @returns Array of missions that start in the specified room
 *
 * @example
 * const missions = getMissionsForRoom("server-room");
 * console.log(missions.length); // 1 (ping-tutorial)
 */
export function getMissionsForRoom(roomId: string): MissionSpec[] {
	return missionList.filter((m) => m.entryRoomId === roomId);
}

/**
 * Check if a mission has a generated plan
 *
 * @param missionId - The unique identifier for the mission
 * @returns true if mission has at least one plan step
 *
 * @example
 * hasPlan("ping-tutorial"); // true
 */
export function hasPlan(missionId: string): boolean {
	return getMissionPlan(missionId).length > 0;
}
