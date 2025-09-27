import type { Enemy, GameState } from "../convex/types";
import {
	commandLineTools,
	enemies,
	type GameCommands,
	items,
	rooms,
} from "./GameData";

/**
 * Produce a deterministic, ls -l style string listing that simulates ~/bin symlinked tools.
 *
 * Produces an array of display-ready lines: a narrative prefix, an ls command header, and one line per tool
 * formatted like a symbolic-link listing (e.g., "lrwxrwxrwx ... name -> /path/to/target").
 *
 * @param tools - Array of tool descriptors (each with `name`, `description`, and `syntax`) to include in the listing.
 * @param options - Optional presentation settings:
 *   - `username` — owner and group name used in the listing (default: "oncall").
 *   - `symlinkTimestamp` — timestamp string shown for each entry (default: "Sep 25 02:00").
 *   - `directoryPath` — directory shown in the ls command header (default: "~/bin").
 *   - `narrativePrefix` — first-line narrative shown before the listing (default: a brief on-call bin description).
 *   - `closingMessage` — reserved for an optional trailing message (not used by default).
 * @returns An array of strings representing the formatted listing lines suitable for display.
 *
 **/
function generateToolsOutput(
	tools: { name: string; description: string; syntax: string }[],
	options?: {
		username?: string;
		symlinkTimestamp?: string;
		directoryPath?: string;
		narrativePrefix?: string;
		closingMessage?: string;
	},
): string[] {
	const {
		username = "oncall",
		symlinkTimestamp = "Sep 25 02:00",
		directoryPath = "~/bin",
		narrativePrefix = "You check your home directory and find a bin folder with essential utilities for quick access during investigations.",
	} = options || {};

	const targetMap: Record<string, string> = {
		ping: "/bin/ping",
		ssh: "/usr/bin/ssh",
		tail: "/usr/bin/tail",
		grep: "/usr/bin/grep",
		netstat: "/usr/bin/netstat",
		docker: "/usr/bin/docker",
		kubectl: "/usr/local/bin/kubectl",
		top: "/usr/bin/top",
	};

	const lsLines = tools
		.map((tool) => {
			const targetPath = targetMap[tool.name] || `/usr/bin/${tool.name}`;
			const permissions = "lrwxrwxrwx"; // standard symlink perms
			const ownerGroup = `${username} ${username}`;
			const size = String(targetPath.length).padStart(2, " ");
			return `${permissions} 1 ${ownerGroup}  ${size} ${symlinkTimestamp} ${tool.name} -> ${targetPath}`;
		})
		.join("\n");

	// Assemble deterministic sections with explicit spacing
	const linesArr = [
		narrativePrefix,
		"",
		`$ ls -l ${directoryPath}`,
		...lsLines.split("\n"),
	];
	return linesArr;
}

// Process player commands and return response text and updated game state
export const parseCommand = async (
	command: string,
	gameState: GameState,
	commands?: GameCommands,
) => {
	const words = command.trim().toLowerCase().split(" ");
	const action = words[0];
	const target = words.slice(1).join(" ");

	let response: string[] = [];
	let newState = { ...gameState };

	// Handle commands
	switch (action) {
		case "help":
			response = [
				"Available commands:",
				"- look: Examine your surroundings",
				"- move [north|south|east|west]: Move in a direction",
				"- examine [object]: Look at something specific",
				"- take [item]: Pick up an item",
				"- use [item]: Use an item in your inventory",
				"- inventory: Check what you're carrying",
				"- status: Check your system status",
				"- fix [target]: Attempt to repair a broken system",
				"- tools: List available command-line tools",
				"- [toolname] help: Get help on a specific tool (e.g. 'ping help')",
				"- restart: Restart the game (if you're stuck)",
				"- help: Show this help text",
			];
			break;

		case "look": {
			// Prefer server-side deterministic look via Convex, fallback to client
			if (commands?.executeLookCommand) {
				try {
					const result = commands.executeLookCommand;
					response = result.output;
				} catch (err) {
					console.error("Look command error:", err);
					response = ["look: environment scan failed", "Please try again."];
				}
				break;
			}

			// Fallback client-side implementation
			const room = rooms[gameState.currentRoom];
			response = [`[${room.name}]`, room.description];

			// List exits
			const exits = Object.entries(room.exits)
				.filter(([_, roomId]) => roomId !== null)
				.map(([direction, _]) => direction);
			if (exits.length > 0) {
				response.push("", `Exits: ${exits.join(", ")}`);
			} else {
				response.push("", "There are no visible exits.");
			}

			// List items
			const roomItems = items.filter(
				(item) => item.location === gameState.currentRoom && !item.taken,
			);
			if (roomItems.length > 0) {
				response.push("", "You see:");
				roomItems.forEach((item) => {
					response.push(`- ${item.name}: ${item.description}`);
				});
			}

			// List enemies
			const roomEnemies = gameState.enemies.filter(
				(enemy: Enemy) =>
					enemy.location === gameState.currentRoom && !enemy.defeated,
			);
			if (roomEnemies.length > 0) {
				response.push("", "ALERT! System threats detected:");
				roomEnemies.forEach((enemy) => {
					response.push(`- ${enemy.name}: ${enemy.description}`);
				});
			}
			break;
		}

		case "move":
		case "go": {
			const direction = target.toLowerCase();
			const currentRoom = rooms[gameState.currentRoom];
			if (["north", "south", "east", "west"].includes(direction)) {
				const nextRoomId =
					currentRoom.exits[direction as keyof typeof currentRoom.exits];
				if (nextRoomId) {
					const nextRoom = rooms[nextRoomId];
					newState.currentRoom = nextRoomId;

					// Add room to visited list if first time
					if (!newState.visited.includes(nextRoomId)) {
						newState.visited.push(nextRoomId);
						response = [
							`You move ${direction} to ${nextRoom.name}.`,
							"",
							nextRoom.description,
						];
					} else {
						response = [`You move ${direction} to ${nextRoom.name}.`];
					}

					// Check if room has enemies
					const roomEnemies = newState.enemies.filter(
						(enemy: Enemy) => enemy.location === nextRoomId && !enemy.defeated,
					);
					if (roomEnemies.length > 0) {
						response.push("", "ALERT! System threats detected!");
					}
				} else {
					response = [`You cannot move ${direction} from here.`];
				}
			} else {
				response = [
					"Invalid direction. Try 'north', 'south', 'east', or 'west'.",
				];
			}
			break;
		}

		case "inventory":
		case "inv": {
			const inventoryItems = items.filter((item) => item.taken);
			if (inventoryItems.length > 0) {
				response = ["Your inventory contains:"];
				inventoryItems.forEach((item) => {
					response.push(`- ${item.name}: ${item.description}`);
				});
			} else {
				response = ["Your inventory is empty."];
			}
			break;
		}

		case "take":
		case "pickup":
		case "get": {
			if (!target) {
				response = ["What do you want to take?"];
				break;
			}
			const itemToTake = items.find(
				(item) =>
					item.location === gameState.currentRoom &&
					!item.taken &&
					(item.name.toLowerCase() === target ||
						item.aliases?.includes(target)),
			);
			if (itemToTake) {
				itemToTake.taken = true;
				response = [`You take the ${itemToTake.name}.`];
				if (itemToTake.onTake) {
					response.push(itemToTake.onTake);
				}
			} else {
				response = ["You don't see that here."];
			}
			break;
		}

		case "use": {
			if (!target) {
				response = ["What do you want to use?"];
				break;
			}
			const itemToUse = items.find(
				(item) =>
					item.taken &&
					(item.name.toLowerCase() === target ||
						item.aliases?.includes(target)),
			);
			if (itemToUse) {
				if (itemToUse.use) {
					const useResult = itemToUse.use(gameState);
					response = useResult.message;
					if (
						useResult.updateState &&
						typeof useResult.updateState === "object"
					) {
						newState = { ...newState, ...useResult.updateState };
					}
				} else {
					response = [`You're not sure how to use the ${itemToUse.name} here.`];
				}
			} else {
				response = ["You don't have that item."];
			}
			break;
		}

		case "status":
			response = [
				"SYSTEM STATUS:",
				`Health: ${gameState.health}%`,
				`Visited nodes: ${gameState.visited.length}/${Object.keys(rooms).length}`,
				`Threats neutralized: ${gameState.enemies.filter((e: Enemy) => e.defeated).length}/${gameState.enemies.length}`,
			];
			break;

		case "tools": {
			response = generateToolsOutput(
				commandLineTools.map((t) => ({
					name: t.name,
					description: t.description,
					syntax: t.syntax,
				})),
			);
			break;
		}

		case "ping": {
			// Check if this is a help request for the ping tool
			if (target === "help") {
				const tool = commandLineTools.find((t) => t.name === action);
				if (tool) {
					response = [
						`${tool.name.toUpperCase()}:`,
						`Syntax: ${tool.syntax}`,
						`Description: ${tool.description}`,
						`Example: ${tool.example}`,
						`${tool.explanation}`,
					];
				} else {
					response = ["Unknown tool. Type 'tools' to see available tools."];
				}
			} else {
				// Execute ping command using injected action
				if (!commands?.executePingCommand) {
					response = [
						"ping: command-line tools not available",
						"Network diagnostics require agent integration",
						"Contact system administrator",
					];
				} else {
					try {
						const result = await commands.executePingCommand({
							target: target || "localhost",
							gameState,
							threadId: gameState.toolSessionId,
						});

						response = result.output;
						newState = {
							...newState,
							skillPoints: (newState.skillPoints || 0) + result.skillGained,
							// Preserve existing session if no new threadId was returned
							toolSessionId: result.threadId ?? gameState.toolSessionId,
						};
					} catch (error) {
						console.error("Ping command error:", error);
						response = [
							"ping: network error occurred",
							"Unable to reach target system",
							"Check network connectivity and try again",
						];
					}
				}
			}
			break;
		}

		case "ssh":
		case "tail":
		case "grep":
		case "netstat":
		case "docker":
		case "kubectl":
		case "top":
			// Check if this is a help request for a tool
			if (target === "help") {
				const tool = commandLineTools.find((t) => t.name === action);
				if (tool) {
					response = [
						`${tool.name.toUpperCase()}:`,
						`Syntax: ${tool.syntax}`,
						`Description: ${tool.description}`,
						`Example: ${tool.example}`,
						`${tool.explanation}`,
					];
				} else {
					response = ["Unknown tool. Type 'tools' to see available tools."];
				}
			} else {
				response = [
					`You attempt to use the ${action} command...`,
					"This is a simulation - these commands won't actually execute.",
					`Type '${action} help' to learn more about this command.`,
				];
			}
			break;

		case "fix":
		case "repair":
		case "debug": {
			if (!target) {
				response = ["What do you want to fix?"];
				break;
			}
			const enemyToFix = gameState.enemies.find(
				(enemy: Enemy) =>
					enemy.location === gameState.currentRoom &&
					!enemy.defeated &&
					(enemy.name.toLowerCase() === target ||
						enemy.aliases?.includes(target)),
			);
			if (enemyToFix) {
				const requiredItem = items.find(
					(item) => item.id === enemyToFix.requiredItemId && item.taken,
				);
				if (requiredItem) {
					enemyToFix.defeated = true;
					response = [
						`You use the ${requiredItem.name} to fix the ${enemyToFix.name}.`,
						enemyToFix.defeatMessage,
					];
					// Check if all enemies are defeated
					if (gameState.enemies.every((e: Enemy) => e.defeated)) {
						response.push(
							"",
							"CONGRATULATIONS! All system threats have been neutralized.",
							"The datacenter is secure once again thanks to your DevOps skills!",
							"",
							"Game Complete - Type 'restart' to play again.",
						);
						newState.gameOver = true;
					}
				} else {
					response = [
						`You attempt to fix the ${enemyToFix.name} but lack the proper tools.`,
						enemyToFix.failMessage ||
							"You need to find the right tool for this job.",
					];
					// Take damage
					newState.health -= 10;
					response.push(`You take damage! Health: ${newState.health}%`);
					if (newState.health <= 0) {
						response.push(
							"",
							"CRITICAL SYSTEM FAILURE",
							"Your connection has been terminated.",
							"",
							"Game Over - Type 'restart' to try again.",
						);
						newState.gameOver = true;
					}
				}
			} else {
				response = ["There's nothing like that to fix here."];
			}
			break;
		}

		case "examine":
		case "inspect":
		case "check": {
			if (!target) {
				response = ["What do you want to examine?"];
				break;
			}
			// Check for items in room
			const itemToExamine = items.find(
				(item) =>
					((item.location === gameState.currentRoom && !item.taken) ||
						item.taken) &&
					(item.name.toLowerCase() === target ||
						item.aliases?.includes(target)),
			);
			if (itemToExamine) {
				response = [
					`${itemToExamine.name}: ${itemToExamine.description}`,
					itemToExamine.examineText || "Nothing unusual about it.",
				];
				break;
			}

			// Check for enemies
			const enemyToExamine = gameState.enemies.find(
				(enemy: Enemy) =>
					enemy.location === gameState.currentRoom &&
					(enemy.name.toLowerCase() === target ||
						enemy.aliases?.includes(target)),
			);
			if (enemyToExamine) {
				response = [
					`${enemyToExamine.name}: ${enemyToExamine.description}`,
					enemyToExamine.examineText ||
						"You'll need the right tools to fix this issue.",
				];
				break;
			}

			// Default response
			response = ["You don't see anything like that here."];
			break;
		}

		case "restart":
			newState = {
				currentRoom: "server-room",
				inventory: [],
				health: 100,
				visited: ["server-room"],
				enemies: [...enemies],
				gameOver: false,
				playerId: gameState.playerId,
				toolSessionId: gameState.toolSessionId,
				skillPoints: 0,
				threatLevel: 1,
			};
			items.forEach((item) => {
				item.taken = false;
			});
			response = [
				"Game restarted.",
				"",
				"You awaken in a dimly lit server room. The hum of machines surrounds you.",
				"Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
				"",
				"Type 'help' for available commands.",
			];
			break;

		default:
			response = ["Unknown command. Type 'help' for a list of commands."];
	}

	return { response, newState };
};
