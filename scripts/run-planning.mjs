#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pddlProblemsDir = path.resolve(repoRoot, "pddl/generated/problems");
const pddlDomainsDir = path.resolve(repoRoot, "pddl/generated/domains");
const convexPlanDir = path.resolve(
	repoRoot,
	"convex/domainSpec/generated/problems",
);

function findDevboxRoot(startDir) {
	let current = startDir;
	const { root } = path.parse(startDir);
	while (true) {
		if (existsSync(path.join(current, "devbox.json"))) {
			return current;
		}
		if (current === root) {
			return startDir;
		}
		current = path.dirname(current);
	}
}

const generatorDevboxRoot = findDevboxRoot(repoRoot);
const scenarioRoot = path.resolve(repoRoot, ".");
const plannerDevboxRoot = findDevboxRoot(scenarioRoot);

const provider = process.env.PDDL_PROVIDER ?? "claude";
const model = process.env.PDDL_MODEL ?? null;

function resolveAbsolute(base, relOrAbs) {
	if (!relOrAbs) return relOrAbs;
	if (path.isAbsolute(relOrAbs)) {
		return relOrAbs;
	}
	return path.resolve(base, relOrAbs);
}

const domainOutInput =
	process.env.PDDL_DOMAIN_OUT ??
	"./pddl/generated/domains/rogue-devops-poc-domain.pddl";
const problemOutInput =
	process.env.PDDL_PROBLEM_OUT ??
	"./pddl/generated/problems/poc-reachability/problem.pddl";

const domainOutAbs = resolveAbsolute(repoRoot, domainOutInput);
const problemOutAbs = resolveAbsolute(repoRoot, problemOutInput);

const generatorDomainPath = path.relative(generatorDevboxRoot, domainOutAbs);
const generatorProblemPath = path.relative(generatorDevboxRoot, problemOutAbs);

const plannerDomainPath = path.relative(plannerDevboxRoot, domainOutAbs);
const plannerProblemPath = path.relative(plannerDevboxRoot, problemOutAbs);

const generatorScript = path.relative(
	generatorDevboxRoot,
	path.resolve(repoRoot, "scripts/generate-pddl-llm.mjs"),
);
const plannerScript = path.relative(
	plannerDevboxRoot,
	path.resolve(scenarioRoot, "scripts/plan_fd.py"),
);

function buildGeneratorArgs() {
	const args = ["run", "--", "node", generatorScript, "--provider", provider];
	if (model) {
		args.push("--model", model);
	}
	args.push(
		"--invoke",
		"--domain-out",
		generatorDomainPath,
		"--problem-out",
		generatorProblemPath,
	);
	return args;
}

const plannerArgs = [
	"run",
	"--",
	"python",
	plannerScript,
	"--domain",
	plannerDomainPath,
	"--problem",
	plannerProblemPath,
	"--json",
];

async function runStep(label, command, args, cwd) {
	console.log(`\n▶ ${label}`);
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: "inherit",
			env: process.env,
		});

		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`${label} failed with exit code ${code}`));
			} else {
				resolve();
			}
		});
	});
}

async function copyPlanJson(problemPddlAbs) {
	const problemDir = path.dirname(problemPddlAbs);
	const planSource = path.join(problemDir, "plan.json");

	try {
		await fs.access(planSource);
	} catch {
		console.warn(`⚠️  No plan.json found at ${planSource}; skipping plan sync.`);
		return;
	}

	const problemSlug =
		path.basename(problemDir) || path.basename(problemPddlAbs, ".pddl");
	const raw = await fs.readFile(planSource, "utf8");
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		console.warn(`⚠️  Failed to parse ${planSource} as JSON:`, error);
		return;
	}

	const meta = {
		derivedBy: "pnpm planning:refresh",
		problemRef: problemSlug,
		timestamp: new Date().toISOString(),
	};

	const enriched = {
		...parsed,
		_meta: meta,
	};

	// Write to Convex directory (for runtime import)
	const convexPlanTarget = path.join(convexPlanDir, problemSlug, "plan.json");
	await fs.mkdir(path.dirname(convexPlanTarget), { recursive: true });
	await fs.writeFile(
		convexPlanTarget,
		JSON.stringify(enriched, null, 2),
		"utf8",
	);
	console.log(
		`✅ Plan JSON written to ${path.relative(repoRoot, convexPlanTarget)}`,
	);
}

async function main() {
	await fs.mkdir(pddlDomainsDir, { recursive: true });
	await fs.mkdir(pddlProblemsDir, { recursive: true });
	await fs.mkdir(convexPlanDir, { recursive: true });
	await runStep(
		"Generating PDDL via LLM",
		"devbox",
		buildGeneratorArgs(),
		generatorDevboxRoot,
	);
	await runStep(
		"Running planner smoke test",
		"devbox",
		plannerArgs,
		plannerDevboxRoot,
	);
	await copyPlanJson(problemOutAbs);
	console.log("\n✅ Planning artifacts generated and validated.");
}

main().catch((error) => {
	console.error("\n✖ Planning refresh failed:", error.message);
	process.exit(1);
});
