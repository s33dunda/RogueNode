import { z } from "zod";

/**
 * Planning metadata derived from the RogueNode domain. Keeping it in TypeScript
 * lets us share structure across gameplay code and PDDL generation.
 */

export const typeSchema = z.object({
	name: z.string(),
	parent: z.string().optional(),
});

export const parameterSchema = z.object({
	name: z.string(),
	type: z.string().optional(),
});

export const predicateSchema = z.object({
	name: z.string(),
	parameters: z.array(parameterSchema).default([]),
	documentation: z.string().optional(),
});

export const literalSchema = z.object({
	predicate: z.string(),
	args: z.array(z.string()).default([]),
	negated: z.boolean().default(false),
});

export const actionSchema = z.object({
	name: z.string(),
	parameters: z.array(parameterSchema).default([]),
	preconditions: z.array(literalSchema).default([]),
	effects: z.array(literalSchema),
	documentation: z.string().optional(),
});

export const planningDomainSchema = z.object({
	name: z.string(),
	requirements: z.array(z.string()).default([":strips", ":typing"]),
	types: z.array(typeSchema).default([]),
	predicates: z.array(predicateSchema),
	actions: z.array(actionSchema),
	documentation: z.string().optional(),
});

export type PlanningTypeSpec = z.infer<typeof typeSchema>;
export type PlanningParameterSpec = z.infer<typeof parameterSchema>;
export type PlanningPredicateSpec = z.infer<typeof predicateSchema>;
export type PlanningLiteralSpec = z.infer<typeof literalSchema>;
export type PlanningActionSpec = z.infer<typeof actionSchema>;
export type PlanningDomainSpec = z.infer<typeof planningDomainSchema>;

export const rogueDevOpsDomain: PlanningDomainSpec = planningDomainSchema.parse(
	{
		name: "rogue-devops-poc",
		requirements: [":strips", ":typing"],
		types: [{ name: "server" }],
		predicates: [
			{
				name: "reachable",
				parameters: [{ name: "s", type: "server" }],
				documentation: "True when a server has been brought online via ping.",
			},
		],
		actions: [
			{
				name: "ping",
				parameters: [{ name: "s", type: "server" }],
				preconditions: [],
				effects: [
					{
						predicate: "reachable",
						args: ["?s"],
					},
				],
				documentation: "Bring a server online by issuing a ping.",
			},
		],
		documentation:
			"Minimal domain supporting pinging servers to mark them reachable. Extend this structure as new verbs appear in the MVP.",
	},
);
