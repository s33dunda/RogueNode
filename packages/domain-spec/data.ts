import planPocReachability from "./generated/problems/poc-reachability/plan.json";
import { domainBundleSchema, missionSchema } from "./schema";

type PlannerPlanJson = {
	plan?: string[];
	actions?: string[];
	_meta?: {
		derivedBy?: string;
		problemRef?: string;
		timestamp?: string;
	};
};

const pocReachabilityPlanStrings = (() => {
	const parsed = planPocReachability as PlannerPlanJson;
	if (Array.isArray(parsed.plan) && parsed.plan.length > 0) {
		return parsed.plan;
	}
	if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
		return parsed.actions;
	}
	return [] as string[];
})();

const pocReachabilityPlanSteps = pocReachabilityPlanStrings.map((step) => {
	const [action, ...rest] = step.split(" ").filter(Boolean);
	const target = rest.join(" ") || undefined;
	return {
		action,
		target,
		description: `Auto-generated step: ${step}`,
	};
});

const hasGeneratedPlan = pocReachabilityPlanSteps.length > 0;

const rawDomain = {
	rooms: [
		{
			id: "server-room",
			name: "Server Room",
			description:
				"A compact operations closet humming with servers. Status lights flicker between amber and green while packets fly across patch cables.",
			exits: {
				north: null,
				south: null,
				east: null,
				west: null,
			},
		},
	],
	items: [],
	enemies: [],
	missions: [
		missionSchema.parse({
			id: "ping-tutorial",
			title: "Bring the server online",
			synopsis:
				"Confirm connectivity to the main server using the ping utility.",
			entryRoomId: "server-room",
			successCondition: "Server responds successfully to a ping.",
			optimalPlan: hasGeneratedPlan
				? pocReachabilityPlanSteps
				: [
						{
							action: "ping",
							target: "main-server",
							description:
								"Run ping against the main server to verify reachability.",
						},
					],
			problemRef: "poc-reachability",
		}),
	],
};

const parsedDomain = domainBundleSchema.parse(rawDomain);

export const domainData = parsedDomain;

export const roomList = parsedDomain.rooms;
export const enemyList = parsedDomain.enemies;
export const missionList = parsedDomain.missions;

export const toolCatalog = [
	{
		name: "ping",
		syntax: "ping <host>",
		description: "Send an ICMP-style echo request to test reachability.",
		example: "ping main-server",
		explanation:
			"Used to verify connectivity and latency between your terminal and a target host.",
	},
];

export const missionPlans = {
	"poc-reachability": pocReachabilityPlanSteps,
};

export const missionPlanSequences = {
	"poc-reachability": pocReachabilityPlanStrings,
};

export const missionPlanMetadata = {
	"poc-reachability": (planPocReachability as PlannerPlanJson)._meta ?? null,
};
