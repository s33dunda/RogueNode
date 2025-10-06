import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
} from "./_generated/server";
import { getMissionPlan, matchesStep } from "./domainSpec";
import { getMissionsForRoom } from "./domainSpec/runtime";
import {
	type MissionStepValidationResult,
	missionProgressEntry,
	missionStepValidationResult,
} from "./types";

/**
 * Pure validation function - no database operations
 *
 * Takes a mission progress document and validates the player command against it.
 * Returns the validation result and any database changes needed.
 *
 * This is a pure function with no side effects, enabling batch validation.
 */
export function validateAndPrepareUpdate(
	progress: Doc<"missionProgress">,
	playerCommand: string,
): {
	id: Id<"missionProgress">;
	changes: Partial<Doc<"missionProgress">> | null;
	result: MissionStepValidationResult;
} {
	// Mission not in progress
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

	// Prepare database changes (only if step was matched or attempted)
	const changes: Partial<Doc<"missionProgress">> = {
		currentStepIndex: nextStepIndex,
		completedSteps: [
			...progress.completedSteps,
			{
				stepIndex: progress.currentStepIndex,
				playerCommand,
				expectedAction: currentStep.action,
				matched,
				timestamp: Date.now(),
			},
		],
		status: missionComplete ? "completed" : "in_progress",
		...(missionComplete ? { completedAt: Date.now() } : {}),
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

/**
 * Batch validation function - optimized for cache hits
 *
 * Validates all active missions for a player in a single transaction:
 * 1. Single query to get all active missions
 * 2. In-memory validation using pure function
 * 3. Sequential patches within same transaction
 *
 * This maintains atomicity while reducing query count from O(N) to O(1).
 */
export async function validateAllMissionsInBatch(
	ctx: MutationCtx,
	playerId: string,
	playerCommand: string,
): Promise<{
	feedback: string[];
	totalSkillGained: number;
}> {
	// Single query for all active missions
	const allProgress = await ctx.db
		.query("missionProgress")
		.withIndex("by_player_status", (q) =>
			q.eq("playerId", playerId).eq("status", "in_progress"),
		)
		.collect();

	// No active missions
	if (allProgress.length === 0) {
		return {
			feedback: [],
			totalSkillGained: 0,
		};
	}

	// Validate all in memory (no DB operations)
	const updates = allProgress.map((progress) =>
		validateAndPrepareUpdate(progress, playerCommand),
	);

	// Apply all patches sequentially within the same mutation transaction
	const aggregatedFeedback: string[] = [];
	let totalSkillGained = 0;

	for (const update of updates) {
		if (update.changes) {
			// Only patch if validation determined changes are needed
			await ctx.db.patch(update.id, update.changes);
		}

		// Aggregate results
		if (update.result.feedback.length > 0) {
			aggregatedFeedback.push(...update.result.feedback);
		}
		totalSkillGained += update.result.skillGained;
	}

	return {
		feedback: aggregatedFeedback,
		totalSkillGained,
	};
}

/**
 * Legacy function - kept for backward compatibility
 *
 * This function performs a single mission validation with database operations.
 * For batch operations, use validateAllMissionsInBatch instead.
 */
export async function validateMissionStepInternal(
	ctx: MutationCtx,
	playerId: string,
	missionId: string,
	playerCommand: string,
): Promise<MissionStepValidationResult> {
	const progress = await ctx.db
		.query("missionProgress")
		.withIndex("by_player_mission", (q) =>
			q.eq("playerId", playerId).eq("missionId", missionId),
		)
		.first();

	if (!progress) {
		return {
			matched: false,
			expectedAction: "",
			feedback: ["No active mission found. Start a mission first."],
			missionComplete: false,
			skillGained: 0,
		};
	}

	// Use pure validation function
	const { changes, result } = validateAndPrepareUpdate(progress, playerCommand);

	// Apply changes if needed
	if (changes) {
		await ctx.db.patch(progress._id, changes);
	}

	return result;
}

/**
 * Internal query: Get all active missions for a player
 *
 * Retrieves all missions currently in progress for the specified player.
 * Used for dynamic mission validation instead of hardcoded mission IDs.
 *
 * @security This is an internal function called by authenticated mutations.
 * The caller is responsible for ensuring the playerId matches the authenticated user.
 */
export const getActiveMissions = internalQuery({
	args: {
		playerId: v.string(),
	},
	returns: v.array(missionProgressEntry),
	handler: async (ctx, { playerId }) => {
		return await ctx.db
			.query("missionProgress")
			.withIndex("by_player_status", (q) =>
				q.eq("playerId", playerId).eq("status", "in_progress"),
			)
			.collect();
	},
});

/**
 * Internal query: Get mission progress for player
 *
 * Retrieves the current progress state for a specific player and mission.
 * Returns null if no progress record exists (mission not started).
 *
 * @security This is an internal function called by authenticated mutations.
 * The caller is responsible for ensuring the playerId matches the authenticated user.
 */
export const getMissionProgress = internalQuery({
	args: {
		playerId: v.string(),
		missionId: v.string(),
	},
	returns: v.union(missionProgressEntry, v.null()),
	handler: async (ctx, { playerId, missionId }) => {
		return await ctx.db
			.query("missionProgress")
			.withIndex("by_player_mission", (q) =>
				q.eq("playerId", playerId).eq("missionId", missionId),
			)
			.first();
	},
});

/**
 * Internal mutation: Start a mission
 *
 * Creates a new mission progress tracker for the player.
 * If mission is already started, returns existing progress ID.
 */
export const startMission = internalMutation({
	args: {
		playerId: v.string(),
		gameStateId: v.id("gameState"),
		missionId: v.string(),
	},
	returns: v.id("missionProgress"),
	handler: async (ctx, { playerId, gameStateId, missionId }) => {
		// Check if already started
		const existing = await ctx.db
			.query("missionProgress")
			.withIndex("by_player_mission", (q) =>
				q.eq("playerId", playerId).eq("missionId", missionId),
			)
			.first();

		if (existing) {
			return existing._id;
		}

		// Create new progress tracker
		return await ctx.db.insert("missionProgress", {
			playerId,
			gameStateId,
			missionId,
			currentStepIndex: 0,
			completedSteps: [],
			status: "in_progress",
			startedAt: Date.now(),
		});
	},
});

/**
 * Internal mutation: Validate player step against plan
 *
 * Compares the player's command against the expected next step in the mission plan.
 * Records the attempt, updates progress, and returns feedback for the player.
 *
 * @security Ownership is enforced by querying with playerId index filter.
 */
export const validateMissionStep = internalMutation({
	args: {
		playerId: v.string(),
		missionId: v.string(),
		playerCommand: v.string(),
	},
	returns: missionStepValidationResult,
	handler: async (ctx, { playerId, missionId, playerCommand }) => {
		return await validateMissionStepInternal(
			ctx,
			playerId,
			missionId,
			playerCommand,
		);
	},
});

export const validateAllMissionSteps = internalMutation({
	args: {
		playerId: v.string(),
		missionIds: v.array(v.string()),
		playerCommand: v.string(),
	},
	returns: v.object({
		feedback: v.array(v.string()),
		totalSkillGained: v.number(),
	}),
	handler: async (ctx, { playerId, missionIds, playerCommand }) => {
		const aggregatedFeedback: string[] = [];
		let totalSkillGained = 0;

		for (const missionId of missionIds) {
			const result = await validateMissionStepInternal(
				ctx,
				playerId,
				missionId,
				playerCommand,
			);
			if (result.feedback.length > 0) {
				aggregatedFeedback.push(...result.feedback);
			}
			totalSkillGained += result.skillGained;
		}

		return {
			feedback: aggregatedFeedback,
			totalSkillGained,
		};
	},
});

/**
 * Internal query: Get all missions for a player with their progress status
 *
 * Returns missions available in the player's current room along with their
 * completion status (available, in_progress, completed).
 */
export const getMissionsWithProgress = internalQuery({
	args: {
		playerId: v.string(),
		roomId: v.string(),
	},
	returns: v.array(
		v.object({
			id: v.string(),
			title: v.string(),
			synopsis: v.string(),
			status: v.union(
				v.literal("available"),
				v.literal("in_progress"),
				v.literal("completed"),
			),
			progressId: v.optional(v.id("missionProgress")),
		}),
	),
	handler: async (ctx, { playerId, roomId }) => {
		// Get missions available in this room
		const missions = getMissionsForRoom(roomId);

		const result = [];
		for (const mission of missions) {
			const progress = await ctx.db
				.query("missionProgress")
				.withIndex("by_player_mission", (q) =>
					q.eq("playerId", playerId).eq("missionId", mission.id),
				)
				.first();

			result.push({
				id: mission.id,
				title: mission.title,
				synopsis: mission.synopsis,
				status:
					progress?.status === "completed"
						? ("completed" as const)
						: progress?.status === "in_progress"
							? ("in_progress" as const)
							: ("available" as const),
				progressId: progress?._id,
			});
		}

		return result;
	},
});
