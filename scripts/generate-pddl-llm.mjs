#!/usr/bin/env node
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptTemplatePath = path.resolve(__dirname, "templates/pddl_prompt.txt");
const promptTemplate = await fs.readFile(promptTemplatePath, "utf8");

const repoRoot = path.resolve(__dirname, "..");

const defaultContextFiles = [
	"pddl/planning.ts",
	"convex/domainSpec/schema.ts",
	"convex/domainSpec/data.ts",
];

function parseArgs(argv) {
	const options = {
		provider: "codex", // Default to Codex
		model: null,
		invoke: true, // Default to invoking the provider
		include: [],
		domainOut: "pddl/generated/domains/rogue-devops-poc-domain.pddl",
		problemOut: "pddl/generated/problems/poc-reachability/problem.pddl",
		outputDir: path.join("docs", "prompts", "sessions"),
	};

	const args = [...argv];
	while (args.length) {
		const arg = args.shift();
		switch (arg) {
			case "--provider":
				options.provider = args.shift() ?? null;
				break;
			case "--model":
				options.model = args.shift() ?? null;
				break;
			case "--invoke":
				options.invoke = true;
				break;
			case "--no-invoke":
				options.invoke = false;
				break;
			case "--include":
				options.include.push(args.shift());
				break;
			case "--domain-out":
				options.domainOut = args.shift();
				break;
			case "--problem-out":
				options.problemOut = args.shift();
				break;
			case "--output-dir":
				options.outputDir = args.shift();
				break;
			case "-h":
			case "--help":
				options.help = true;
				break;
			default:
				console.error(`Unknown argument: ${arg}`);
				options.help = true;
				break;
		}
	}
	return options;
}

function usage() {
	return `Usage: devbox run -- node scripts/generate-pddl-llm.mjs [options]

Options:
  --provider <openai|codex|claude|gemini>  Select provider CLI (default: codex)
  --model <name>                            Override the default model for the provider
  --include <path>                         Extra file to append to the mission context (repeatable)
  --domain-out <path>                      Write the first Lisp block into this file
  --problem-out <path>                     Write the second Lisp block into this file
  --output-dir <path>                      Where to store prompt/response snapshots (default: docs/prompts/sessions)
  --invoke                                 Call the provider CLI (default: true)
  --no-invoke                              Skip calling the provider CLI
  -h, --help                               Show this help

Environment overrides:
  CODEX_CLI, CODEX_PDDL_MODEL (default model: gpt-5-codex)
  CLAUDE_CLI, CLAUDE_PDDL_MODEL (default model: claude-3-5-sonnet-20241022)
  GEMINI_CLI, GEMINI_PDDL_MODEL (default model: gemini-1.5-pro)
`;
}

async function readFileOrWarn(relPath) {
	const absPath = path.resolve(repoRoot, relPath);
	try {
		const content = await fs.readFile(absPath, "utf8");
		return { relPath, content };
	} catch (error) {
		console.warn(`⚠️  Skipping missing file ${relPath}: ${error.message}`);
		return { relPath, content: "" };
	}
}

function buildPrompt(domainContext, missionContexts) {
	const missionEntries = missionContexts.map(({ relPath, content }) => {
		const body = content.trim();
		const display = body.length > 0 ? body : "(empty)";
		return `Additional context (${relPath}):\n${display}\n`;
	});

	const missionBlock =
		missionEntries.length > 0
			? `${missionEntries.join("\n")}\n`
			: "Additional context: (none)\n";

	const domainContent = domainContext.content.trim();

	return promptTemplate
		.replace("{{DOMAIN_REL_PATH}}", domainContext.relPath)
		.replace(
			"{{DOMAIN_CONTENT}}",
			domainContent.length > 0 ? domainContent : "(empty)",
		)
		.replace("{{MISSION_CONTEXTS}}", missionBlock);
}

function providerConfig(provider, model, promptPath) {
	switch (provider) {
		case "codex": {
			const command = process.env.CODEX_CLI || "codex";
			const chosenModel =
				model || process.env.CODEX_PDDL_MODEL || "gpt-5-codex";
			return {
				command,
				args: ["exec", "--model", chosenModel, "-"],
				info: `Using Codex CLI (${command}) model ${chosenModel}`,
				useStdin: true,
			};
		}
		case "openai": {
			const command = process.env.OPENAI_CLI || "openai";
			const chosenModel =
				model || process.env.OPENAI_PDDL_MODEL || "gpt-4.1-mini";
			return {
				command,
				args: [
					"chat.completions.create",
					"-m",
					chosenModel,
					"-g",
					`user@${promptPath}`,
				],
				info: `Using OpenAI CLI (${command}) model ${chosenModel}`,
			};
		}
		case "claude": {
			const command = process.env.CLAUDE_CLI || "claude";
			const chosenModel =
				model || process.env.CLAUDE_PDDL_MODEL || "claude-3-5-sonnet-20241022";
			return {
				command,
				args: ["-p", "--model", chosenModel, "--output-format", "text"],
				info: `Using Claude CLI (${command}) model ${chosenModel}`,
				useStdin: true,
			};
		}
		case "gemini": {
			const command = process.env.GEMINI_CLI || "gemini";
			const chosenModel =
				model || process.env.GEMINI_PDDL_MODEL || "gemini-1.5-pro";
			return {
				command,
				args: ["prompt", "--model", chosenModel, "--input-file", promptPath],
				info: `Using Gemini CLI (${command}) model ${chosenModel}`,
			};
		}
		default:
			throw new Error(`Unsupported provider: ${provider}`);
	}
}

async function ensureDir(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

async function runCommand(config, options, promptFile, sessionDir, promptText) {
	console.log(config.info);
	console.log(`Executing: ${config.command} ${config.args.join(" ")}`);

	const child = spawn(config.command, config.args, {
		cwd: repoRoot,
		stdio: ["pipe", "pipe", "pipe"],
		env: process.env,
	});

	let stdout = "";
	let stderr = "";

	if (config.useStdin) {
		child.stdin.write(promptText);
	}
	child.stdin.end();

	child.stdout.on("data", (chunk) => {
		const text = chunk.toString();
		stdout += text;
		process.stdout.write(text);
	});

	child.stderr.on("data", (chunk) => {
		const text = chunk.toString();
		stderr += text;
		process.stderr.write(text);
	});

	const exitCode = await new Promise((resolve) => {
		child.on("close", resolve);
	});

	const responsePath = path.join(sessionDir, "response.txt");
	await fs.writeFile(responsePath, stdout, "utf8");
	if (stderr.trim()) {
		await fs.writeFile(path.join(sessionDir, "stderr.txt"), stderr, "utf8");
	}

	if (exitCode !== 0) {
		throw new Error(`Provider command exited with code ${exitCode}`);
	}

	return stdout;
}

function extractLispBlocks(text) {
	// For Codex output, look for blocks after the model's response marker
	// Codex includes the full prompt in its output, so we need to skip those blocks
	const codexMarkerPattern = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\]\s+codex\s*$/gm;
	const matches = Array.from(text.matchAll(codexMarkerPattern));

	let searchText = text;
	if (matches.length > 0) {
		// Extract only the text after the last "codex" marker (not "thinking")
		const lastMatch = matches[matches.length - 1];
		const lastMarkerIndex = lastMatch.index + lastMatch[0].length;
		searchText = text.substring(lastMarkerIndex);
	}

	const pattern = /```lisp\s*([\s\S]*?)```/g;
	const blocks = [];
	let match = pattern.exec(searchText);
	while (match !== null) {
		blocks.push(match[1].trim());
		match = pattern.exec(searchText);
	}
	return blocks;
}

function resolvePathMaybe(rel, fallbackMessage) {
	if (!rel) return null;
	const resolved = path.resolve(repoRoot, rel);
	const dir = path.dirname(resolved);
	return { resolved, dir, fallbackMessage };
}

async function writeBlock(target, content) {
	await fs.mkdir(path.dirname(target), { recursive: true });
	const trimmed = content.trim();
	const isPddl = target.endsWith(".pddl");
	const banner = isPddl
		? ";; Derived. Use `pnpm planning:refresh` to regenerate.\n"
		: "";
	await fs.writeFile(target, `${banner}${trimmed}\n`, "utf8");
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		console.log(usage());
		process.exit(options.help ? 0 : 1);
	}

	const sessionDir = path.resolve(
		repoRoot,
		options.outputDir,
		new Date().toISOString().replace(/[:.]/g, "-"),
	);
	await ensureDir(sessionDir);

	const contextFiles = new Set();
	defaultContextFiles.forEach((file) => contextFiles.add(file));
	options.include.filter(Boolean).forEach((file) => contextFiles.add(file));

	const contextArray = Array.from(contextFiles);
	const contextData = await Promise.all(
		contextArray.map((relPath) => readFileOrWarn(relPath)),
	);
	const [domainContext, ...missionContexts] = contextData;

	if (!domainContext) {
		throw new Error("Domain planning schema is required but missing");
	}

	const prompt = buildPrompt(domainContext, missionContexts);
	const promptPath = path.join(sessionDir, "prompt.txt");
	await fs.writeFile(promptPath, prompt, "utf8");

	console.log(`Prompt written to ${path.relative(repoRoot, promptPath)}`);
	console.log(`Context files: ${contextArray.join(", ")}`);

	let responseText = null;

	if (options.invoke) {
		const config = providerConfig(options.provider, options.model, promptPath);
		responseText = await runCommand(
			config,
			options,
			promptPath,
			sessionDir,
			prompt,
		);
	} else {
		console.log(
			"--invoke not set; skipping provider call. Use --invoke to run automatically.",
		);
	}

	if (!responseText) {
		console.log("No response captured; manual run required. Prompt is ready.");
		return;
	}

	const blocks = extractLispBlocks(responseText);
	if (!blocks.length) {
		console.warn(
			"⚠️  No ```lisp``` blocks found in provider output. Check response.txt for details.",
		);
		return;
	}

	const [domainBlock, problemBlock] = blocks;

	const domainTarget = resolvePathMaybe(
		options.domainOut,
		"Domain block detected but no --domain-out provided.",
	);
	if (domainBlock && domainTarget) {
		await writeBlock(domainTarget.resolved, domainBlock);
		console.log(
			`Domain PDDL written to ${path.relative(repoRoot, domainTarget.resolved)}`,
		);
	} else if (domainBlock) {
		console.log(
			"Domain block captured but not persisted (supply --domain-out to write it).",
		);
	}

	if (problemBlock) {
		const problemTarget = resolvePathMaybe(
			options.problemOut,
			"Problem block detected but no --problem-out provided.",
		);
		if (problemTarget) {
			await writeBlock(problemTarget.resolved, problemBlock);
			console.log(
				`Problem PDDL written to ${path.relative(repoRoot, problemTarget.resolved)}`,
			);
		} else {
			console.log(
				"Problem block captured but not persisted (supply --problem-out to write it).",
			);
		}
	}

	if (blocks.length > 2) {
		console.warn(
			"⚠️  More than two Lisp blocks returned; review response.txt to ensure correct ordering.",
		);
	}

	console.log(
		`Session artifacts stored under ${path.relative(repoRoot, sessionDir)}`,
	);
}

main().catch((error) => {
	console.error("\n✖ LLM prompt workflow failed:", error.message);
	process.exit(1);
});
