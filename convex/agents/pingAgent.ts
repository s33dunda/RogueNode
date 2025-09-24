import { openai } from "@ai-sdk/openai";
import { Agent, createTool } from "@convex-dev/agent";
import { z } from "zod";
import { components, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { type CommandResult, commandArgs, commandResult } from "../types";
import { generateCacheKey } from "../utils/cacheUtils";

// Network context tool for realistic ping simulation
const getNetworkContext = createTool({
	description: "Get current network conditions for ping simulation",
	args: z.object({
		target: z.string().describe("The target system to ping"),
		sourceRoom: z.string().describe("The room where ping is executed from"),
		playerId: z.string().describe("Player ID for context"),
	}),
	handler: async (_, { target, sourceRoom }): Promise<string> => {
		// This provides context to the agent about current network conditions
		const roomNetworkProfiles = {
			"server-room": {
				baseLatency: 12,
				infrastructure: ["local-servers", "management-switch"],
				connectedSystems: ["database-01", "web-server", "backup-system"],
			},
			"network-hub": {
				baseLatency: 8,
				infrastructure: ["core-router", "firewall", "load-balancer"],
				connectedSystems: ["external-gateway", "internal-network", "dmz"],
			},
			"datacenter-core": {
				baseLatency: 15,
				infrastructure: ["mainframe", "storage-array", "cooling-system"],
				connectedSystems: ["primary-db", "backup-db", "monitoring"],
			},
			"monitoring-station": {
				baseLatency: 20,
				infrastructure: ["monitoring-server", "log-aggregator"],
				connectedSystems: ["all-systems", "alert-gateway"],
			},
		};

		const profile = roomNetworkProfiles[
			sourceRoom as keyof typeof roomNetworkProfiles
		] || {
			baseLatency: 45,
			infrastructure: ["unknown"],
			connectedSystems: ["unknown"],
		};

		return JSON.stringify({
			baseLatency: profile.baseLatency,
			infrastructure: profile.infrastructure,
			connectedSystems: profile.connectedSystems,
			targetKnown: profile.connectedSystems.includes(target),
		});
	},
});

// Network Ping Specialist Agent
export const pingAgent = new Agent(components.agent, {
	name: "Network Ping Specialist",
	languageModel: openai.chat("gpt-5-nano"),
	maxSteps: 3, // Allow multiple steps: tool call + text generation
	instructions: `You are a network engineer expert in ping/ICMP diagnostics.
Generate authentic ping command outputs with realistic RTT, TTL,
packet loss, and timing patterns based on network conditions.

CRITICAL REQUIREMENTS:
1. ALWAYS call getNetworkContext tool first to get network conditions
2. AFTER getting network context, generate AUTHENTIC ping command outputs that mirror real command-line tools
3. Base outputs on the provided network context (latency, packet loss, threats)
4. Use realistic ping syntax and formatting

WORKFLOW:
1. Use getNetworkContext tool to get network conditions
2. Generate the ping output based on the network context

PING OUTPUT FORMAT:
Use standard ping output format:
PING target (IP) 56(84) bytes of data.
64 bytes from target (IP): icmp_seq=1 ttl=64 time=X.X ms
64 bytes from target (IP): icmp_seq=2 ttl=64 time=X.X ms
...
--- target ping statistics ---
X packets transmitted, X received, X% packet loss, time Xms
rtt min/avg/max/mdev = X.X/X.X/X.X/X.X ms`,
	tools: {
		getNetworkContext,
	},
});

// Convex action to execute ping commands using the agent
export const executePingCommand = action({
	args: commandArgs,
	returns: commandResult,
	handler: async (
		ctx,
		{ target, gameState, threadId },
	): Promise<CommandResult> => {
		try {
			// Generate cache key for this command
			const cacheKey = generateCacheKey("ping", target, gameState);
			const gameStateHash = cacheKey.split(":")[2]; // Extract hash portion

			// Check for cached result first
			const cachedResult: Doc<"commandOutputCache"> | null = await ctx.runQuery(
				internal.utils.cacheUtils.lookupCache,
				{
					command: "ping",
					target,
					gameStateHash,
				},
			);

			if (cachedResult) {
				// Increment hit count and return cached result
				await ctx.runMutation(internal.utils.cacheUtils.incrementCacheHit, {
					cacheId: cachedResult._id,
				});

				return {
					output: [...cachedResult.output, ""],
					threadId,
					skillGained: cachedResult.skillGained,
					success: cachedResult.success,
				};
			}

			// No cache hit - proceed with AI generation
			// Create or continue thread for this ping session
			const { thread } = threadId
				? await pingAgent.continueThread(ctx, { threadId })
				: await pingAgent.createThread(ctx, {
						userId: gameState.playerId,
					});

			// Generate ping output using the agent
			const result = await thread.generateText({
				prompt: `Execute ping ${target} from ${gameState.currentRoom}.
Current context: ${gameState.enemies.filter((e) => e.location === gameState.currentRoom && !e.defeated).length} active threats, player health ${gameState.health}%.
Use getNetworkContext tool to get network conditions, then provide realistic ping output.`,
			});

			// Calculate skill gain based on conditions
			const activeThreatCount = gameState.enemies.filter(
				(e) => e.location === gameState.currentRoom && !e.defeated,
			).length;
			let skillGain = 1; // Base skill gain
			if (activeThreatCount > 0) skillGain += 2; // Bonus for dealing with threats
			if (gameState.health < 50) skillGain += 1; // Bonus for working under pressure

			// Split the result text into lines for game output
			const outputLines = result.text
				.split("\n")
				.filter((line) => line.trim() !== "");

			// Store result in cache
			await ctx.runMutation(internal.utils.cacheUtils.storeInCache, {
				command: "ping",
				target,
				gameStateHash,
				output: outputLines,
				skillGained: skillGain,
				success: true,
				playerId: gameState.playerId,
			});

			return {
				output: outputLines,
				threadId: thread.threadId,
				skillGained: skillGain,
				success: true,
			};
		} catch (error) {
			console.error("Ping agent error:", error);
			return {
				output: [
					"ping: network error occurred",
					"Unable to reach target system",
					"Check network connectivity and try again",
				],
				threadId,
				skillGained: 0,
				success: false,
			};
		}
	},
});
