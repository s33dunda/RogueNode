import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import { useCommandProcessor } from "../lib/hooks/useCommandProcessor";
import CRTEffects from "./CRTEffects";
import MissionPanel from "./MissionPanel";
import TerminalInput from "./TerminalInput";
import TerminalNav from "./TerminalNav";
import TerminalOutput from "./TerminalOutput";

export const INTRO_LINES = [
	"RogueNode v0.1 - DevOps Rogue Training Ground",
	"© 1977 TERMINAL INDUSTRIES",
	"---------------------------------------",
	"You awaken in a dimly lit server room. The hum of machines surrounds you.",
	"Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
	"",
	"Type 'help' for available commands or 'tools' to see DevOps commands.",
];

type TerminalHistoryEntry = {
	commandInput: string;
	outputLines: string[];
};

export function isMissionCommand(command: string): boolean {
	return command.trim().toLowerCase() === "missions";
}

export function getNavVisibility(clientY: number, currentVisibility: boolean) {
	if (clientY < 50) {
		return true;
	}

	if (clientY > 100) {
		return false;
	}

	return currentVisibility;
}

export function buildRenderedOutput(
	terminalOutputs: TerminalHistoryEntry[] | null | undefined,
	introLines: readonly string[] = INTRO_LINES,
) {
	if (!terminalOutputs || terminalOutputs.length === 0) {
		return [...introLines, "> "];
	}

	const history = terminalOutputs.flatMap((entry) => [
		`> ${entry.commandInput}`,
		...entry.outputLines,
	]);

	return [...introLines, ...history];
}

interface GameTerminalShellProps {
	disabled: boolean;
	input: string;
	isMissionPanelVisible: boolean;
	isNavVisible: boolean;
	onCloseMissionPanel: () => void;
	onExecuteCommand: (command: string) => Promise<void>;
	onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
	onSubmit: (e: React.FormEvent) => Promise<void>;
	renderedOutput: string[];
	terminalRef: React.RefObject<HTMLDivElement | null>;
}

function GameTerminalShell({
	disabled,
	input,
	isMissionPanelVisible,
	isNavVisible,
	onCloseMissionPanel,
	onExecuteCommand,
	onInputChange,
	onMouseMove,
	onSubmit,
	renderedOutput,
	terminalRef,
}: GameTerminalShellProps) {
	return (
		<nav
			className="flex flex-col h-full w-full bg-black text-green-500 overflow-hidden font-mono relative"
			onMouseMove={onMouseMove}
		>
			<TerminalNav executeCommand={onExecuteCommand} isVisible={isNavVisible} />
			<TerminalOutput output={renderedOutput} terminalRef={terminalRef} />
			<TerminalInput
				input={input}
				onInputChange={onInputChange}
				onSubmit={onSubmit}
				disabled={disabled}
			/>
			<CRTEffects />
			<MissionPanel
				isVisible={isMissionPanelVisible}
				onClose={onCloseMissionPanel}
			/>
		</nav>
	);
}

const GameTerminal = () => {
	const { user, isLoaded } = useUser();
	const identityReady = isLoaded && !!user?.id;
	const initializeGameState = useMutation(api.gameActions.initializeGameState);
	const serverGameState = useQuery(
		api.gameActions.getGameState,
		identityReady ? {} : "skip",
	);
	const terminalOutputs = useQuery(
		api.gameActions.getTerminalOutput,
		identityReady ? {} : "skip",
	);

	const [input, setInput] = useState("");
	const [isNavVisible, setIsNavVisible] = useState(false);
	const [isMissionPanelVisible, setIsMissionPanelVisible] = useState(false);

	const terminalRef = useRef<HTMLDivElement>(null);
	const initializationAttemptedForUserRef = useRef<string | null>(null);

	const { processCommand } = useCommandProcessor();

	const renderedOutput = useMemo(
		() => buildRenderedOutput(terminalOutputs),
		[terminalOutputs],
	);

	const gameStateReady = !!user?.id && serverGameState?.playerId === user.id;

	useEffect(() => {
		if (!user?.id) {
			initializationAttemptedForUserRef.current = null;
			return;
		}

		if (gameStateReady) {
			initializationAttemptedForUserRef.current = user.id;
			return;
		}

		if (initializationAttemptedForUserRef.current === user.id) {
			return;
		}

		initializationAttemptedForUserRef.current = user.id;
		initializeGameState().catch((err) => {
			console.warn("Failed to initialize game state:", err);
			if (initializationAttemptedForUserRef.current === user.id) {
				initializationAttemptedForUserRef.current = null;
			}
		});
	}, [user?.id, gameStateReady, initializeGameState]);

	useLayoutEffect(() => {
		if (terminalRef.current) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
	}, [renderedOutput]);

	if (!isLoaded) {
		return (
			<div className="terminal-container bg-black text-green-400 p-4 font-mono">
				<div>Loading...</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="terminal-container bg-black text-green-400 p-4 font-mono">
				<div>Please sign in to access the DevOps training terminal.</div>
			</div>
		);
	}

	if (!gameStateReady || terminalOutputs === undefined) {
		return (
			<div className="terminal-container bg-black text-green-400 p-4 font-mono">
				<div>Initializing game state...</div>
			</div>
		);
	}

	const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInput(e.target.value);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (isMissionCommand(input)) {
			setIsMissionPanelVisible(true);
			setInput("");
			return;
		}

		await processCommand(input);
		setInput("");
	};

	const executeCommand = async (command: string) => {
		if (isMissionCommand(command)) {
			setIsMissionPanelVisible(true);
			return;
		}

		await processCommand(command);
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
		setIsNavVisible((currentVisibility) =>
			getNavVisibility(e.clientY, currentVisibility),
		);
	};

	return (
		<GameTerminalShell
			disabled={serverGameState?.gameOver || !serverGameState}
			input={input}
			isMissionPanelVisible={isMissionPanelVisible}
			isNavVisible={isNavVisible}
			onCloseMissionPanel={() => setIsMissionPanelVisible(false)}
			onExecuteCommand={executeCommand}
			onInputChange={handleInput}
			onMouseMove={handleMouseMove}
			onSubmit={handleSubmit}
			renderedOutput={renderedOutput}
			terminalRef={terminalRef}
		/>
	);
};

export default GameTerminal;
