import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";

export const useCommandProcessor = () => {
	const sendCommand = useMutation(api.gameActions.sendCommand);

	const processCommand = useCallback(
		async (command: string) => {
			const trimmed = command.trim();
			if (trimmed === "") {
				return;
			}

			return await sendCommand({ command: trimmed });
		},
		[sendCommand],
	);

	return { processCommand };
};
