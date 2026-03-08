import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
} from "./_generated/server";
import { getMissionsForRoom } from "./domainSpec/runtime";
import { validateAndPrepareUpdate } from "./missionValidation";
import {
	type MissionStepValidationResult,
	missionProgressEntry,
	missionStepValidationResult,
} from "./types";

/**
 * Validate every in-progress mission for a player using a single read and apply any resulting progress updates atomically.
 *
 * Performs one query to load all "in_progress" missionProgress records for `playerId`, runs in-memory validation for each step, and applies necessary patches sequentially within the same mutation transaction so updates are atomic for this mutation. Intended for internal/server-side use on behalf of the authenticated `playerId`.
 *
 * @param ctx - Mutation context used to query and patch the database; must represent an authenticated/internal call executing on behalf of `playerId`
 * @param playerId - The player whose active missions will be validated
 * @param playerCommand - The player's input/action to validate against each mission's current step
 * @returns An object with:
 *   - `feedback`: Aggregated feedback messages produced by validating each mission step
 *   - `totalSkillGained`: Sum of skill points awarded across all validated missions (points granted only for matched steps)
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
 * Validate a player's command against a specific mission's current step and persist any resulting progress updates.
 *
 * Load a mission's progress, apply the pure validation helper, and persist any resulting patch.
 *
 * @param ctx - Mutation context providing database access and execution environment
 * @param playerId - Identifier of the player whose mission progress will be validated
 * @param missionId - Identifier of the mission to validate against
 * @param playerCommand - The player's submitted command to validate for the current mission step
 * @returns The mission step validation result containing whether the step matched, the expected action, feedback messages, whether the mission completed, and skill gained
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
		return ctx.db
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
		return ctx.db
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
		return ctx.db.insert("missionProgress", {
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
		return validateMissionStepInternal(ctx, playerId, missionId, playerCommand);
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

		const result: Array<{
			id: string;
			title: string;
			synopsis: string;
			status: "available" | "in_progress" | "completed";
			progressId?: Id<"missionProgress">;
		}> = [];
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
