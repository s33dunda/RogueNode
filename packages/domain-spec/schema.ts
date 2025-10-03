import { z } from "zod";

/**
 * RogueNode MVP domain schema
 * ---------------------------
 *
 * Describes the minimal game entities we rely on today:
 * - rooms form the navigable map
 * - items populate rooms and interact with commands
 * - enemies gate progress and reference required items
 * - missions stitch rooms + plans into playable experiences
 *
 * Runtime code (`utils/GameData.ts`, `convex/gameActions.ts`) should import
 * these validators/types instead of re-declaring shapes inline. This keeps the
 * canonical definitions in one place while we bootstrap generators.
 */

const exitId = z.union([z.string(), z.null()]);

export const roomSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	exits: z.object({
		north: exitId,
		south: exitId,
		east: exitId,
		west: exitId,
	}),
});

export const itemSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	location: z.string(),
	taken: z.boolean().default(false),
	aliases: z.array(z.string()).default([]),
	examineText: z.string().optional(),
	onTake: z.string().optional(),
	/**
	 * Optional identifier pointing at a runtime effect handler. The handler lives
	 * in the frontend for now, but this hook keeps the declarative spec aware of
	 * the side effect entry point.
	 */
	useEffectId: z.string().optional(),
});

export const enemySchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	location: z.string(),
	defeated: z.boolean().default(false),
	requiredItemId: z.string(),
	aliases: z.array(z.string()).default([]),
	examineText: z.string(),
	failMessage: z.string(),
	defeatMessage: z.string(),
});

export const planStepSchema = z.object({
	action: z.string(),
	target: z.string().optional(),
	description: z.string(),
});

export const missionSchema = z.object({
	id: z.string(),
	title: z.string(),
	synopsis: z.string(),
	entryRoomId: z.string(),
	successCondition: z.string(),
	/**
	 * Optional solver-derived plan (e.g. from Fast Downward). This keeps
	 * alignment between authored content and the automation we surface to
	 * players.
	 */
	optimalPlan: z.array(planStepSchema).optional(),
	/**
	 * Reference to the problem definition (e.g. PDDL problem id) used to produce
	 * the plan. Enables regeneration and drift detection later.
	 */
	problemRef: z.string().optional(),
});

export const domainBundleSchema = z.object({
	rooms: z.array(roomSchema),
	items: z.array(itemSchema),
	enemies: z.array(enemySchema).default([]),
	missions: z.array(missionSchema).default([]),
});

export type RoomSpec = z.infer<typeof roomSchema>;
export type ItemSpec = z.infer<typeof itemSchema>;
export type EnemySpec = z.infer<typeof enemySchema>;
export type PlanStepSpec = z.infer<typeof planStepSchema>;
export type MissionSpec = z.infer<typeof missionSchema>;
export type DomainBundleSpec = z.infer<typeof domainBundleSchema>;

export const domainSpecVersion = "0.1.0";

export const domainSpec = {
	version: domainSpecVersion,
	schemas: {
		room: roomSchema,
		item: itemSchema,
		enemy: enemySchema,
		mission: missionSchema,
		bundle: domainBundleSchema,
	},
};
