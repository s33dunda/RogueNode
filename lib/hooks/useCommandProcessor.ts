import type { FunctionReturnType, OptionalRestArgs } from "convex/server";
import { useCallback } from "react";
import type { api } from "../../convex/_generated/api";
import type { GameState } from "../../convex/types";
import { parseCommand } from "../../utils/GameCommands";

// Extract the action type from the generated API
type PingCommandAction = typeof api.agents.pingAgent.executePingCommand;

interface UseCommandProcessorProps {
	gameState: GameState;
	setGameState: (state: GameState) => void;
	output: string[];
	setOutput: (output: string[]) => void;
	executePingCommand: (
		...args: OptionalRestArgs<PingCommandAction>
	) => Promise<FunctionReturnType<PingCommandAction>>;
}

export const useCommandProcessor = ({
	gameState,
	setGameState,
	output,
	setOutput,
	executePingCommand,
}: UseCommandProcessorProps) => {
	const processCommand = useCallback(
		async (command: string) => {
			// Immediately show command
			const userOutput = [...output.slice(0, -1), `> ${command}`, ""];
			setOutput(userOutput);

			if (command.trim() !== "") {
				try {
					// Check if this is an async command-line tool
					const isAsyncCommand = ["ping"].includes(
						command.toLowerCase().split(" ")[0],
					);

					// Show processing indicator for async commands
					if (isAsyncCommand) {
						const processingOutput = [...userOutput, "Processing..."];
						setOutput(processingOutput);
					}

					// Process command and get response with injected actions
					const result = await parseCommand(command.toLowerCase(), gameState, {
						executePingCommand,
					});

					// Show final response (replace processing indicator)
					const finalOutput = [...userOutput, ...result.response, "> "];
					setOutput(finalOutput);

					// Update game state if command changed it
					if (result.newState) {
						setGameState(result.newState);
					}
				} catch (error) {
					console.error("Command execution error:", error);
					const errorOutput = [
						...userOutput,
						"Error executing command. Please try again.",
						"> ",
					];
					setOutput(errorOutput);
				}
			} else {
				const emptyOutput = [...userOutput, "> "];
				setOutput(emptyOutput);
			}
		},
		[gameState, output, setOutput, setGameState, executePingCommand],
	);

	return { processCommand };
};
