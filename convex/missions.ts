import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { getMissionPlan, matchesStep } from "./domainSpec";
import { getMissionsForRoom } from "./domainSpec/runtime";
import { missionProgressEntry, missionStepValidationResult } from "./types";

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
 * @security This function validates ownership by checking that the progress record
 * belongs to the requesting player. Throws an error if ownership validation fails.
 */
export const validateMissionStep = internalMutation({
	args: {
		playerId: v.string(),
		missionId: v.string(),
		playerCommand: v.string(),
	},
	returns: missionStepValidationResult,
	handler: async (ctx, { playerId, missionId, playerCommand }) => {
		const progress = await ctx.db
			.query("missionProgress")
			.withIndex("by_player_mission", (q) =>
				q.eq("playerId", playerId).eq("missionId", missionId),
			)
			.first();

		// Validate ownership: ensure the progress record belongs to the requesting player
		if (progress && progress.playerId !== playerId) {
			throw new Error("Unauthorized: Cannot access another player's mission");
		}

		if (!progress || progress.status !== "in_progress") {
			return {
				matched: false,
				expectedAction: "",
				feedback: ["No active mission found. Start a mission first."],
				missionComplete: false,
				skillGained: 0,
			};
		}

		const plan = getMissionPlan(missionId);
		if (plan.length === 0) {
			return {
				matched: false,
				expectedAction: "",
				feedback: ["Mission has no validation plan."],
				missionComplete: false,
				skillGained: 0,
			};
		}

		const currentStep = plan[progress.currentStepIndex];
		if (!currentStep) {
			return {
				matched: false,
				expectedAction: "",
				feedback: ["Mission already complete."],
				missionComplete: true,
				skillGained: 0,
			};
		}

		const matched = matchesStep(playerCommand, currentStep);
		const nextStepIndex = matched
			? progress.currentStepIndex + 1
			: progress.currentStepIndex;
		const missionComplete = matched && nextStepIndex >= plan.length;

		// Record step attempt
		await ctx.db.patch(progress._id, {
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
		});

		const feedback = matched
			? [
					`✓ Correct! ${currentStep.description}`,
					missionComplete
						? "Mission complete! Well done."
						: `Next step: ${plan[nextStepIndex]?.description ?? "Unknown"}`,
				]
			: [
					`✗ Not quite. Expected: ${currentStep.action} ${currentStep.target ?? ""}`,
					`Hint: ${currentStep.description}`,
				];

		return {
			matched,
			expectedAction:
				`${currentStep.action} ${currentStep.target ?? ""}`.trim(),
			feedback,
			missionComplete,
			skillGained: matched ? 10 : 0,
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
