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

const GameTerminal = () => {
	// Get authenticated user from Clerk
	const { user, isLoaded } = useUser();

	// Convex action hooks (must be called before any returns)
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

	const introLines = useMemo(
		() => [
			"RogueNode v0.1 - DevOps Rogue Training Ground",
			"© 1977 TERMINAL INDUSTRIES",
			"---------------------------------------",
			"You awaken in a dimly lit server room. The hum of machines surrounds you.",
			"Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
			"",
			"Type 'help' for available commands or 'tools' to see DevOps commands.",
		],
		[],
	);

	const renderedOutput = useMemo(() => {
		if (!terminalOutputs || terminalOutputs.length === 0) {
			return [...introLines, "> "];
		}

		const history = terminalOutputs.flatMap((entry) => [
			`> ${entry.commandInput}`,
			...entry.outputLines,
		]);

		return [...introLines, ...history];
	}, [introLines, terminalOutputs]);

	const gameStateReady = !!user?.id && serverGameState?.playerId === user.id;

	// Initialize game state for the current user once their identity is known.
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
			console.error("Failed to initialize game state:", err);
			if (initializationAttemptedForUserRef.current === user.id) {
				initializationAttemptedForUserRef.current = null;
			}
		});
	}, [user?.id, gameStateReady, initializeGameState]);

	// Auto-scroll to bottom when output changes
	useLayoutEffect(() => {
		const lines = renderedOutput.length;
		if (terminalRef.current) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
		void lines;
	}, [renderedOutput.length]);

	// Show loading state while user data loads
	if (!isLoaded) {
		return (
			<div className="terminal-container bg-black text-green-400 p-4 font-mono">
				<div>Loading...</div>
			</div>
		);
	}

	// Require authentication - redirect to sign in if no user
	if (!user) {
		return (
			<div className="terminal-container bg-black text-green-400 p-4 font-mono">
				<div>Please sign in to access the DevOps training terminal.</div>
			</div>
		);
	}

	// Show loading state while game state is being initialized or query is loading
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

		// Check for mission command
		if (input.trim().toLowerCase() === "missions") {
			setIsMissionPanelVisible(true);
			setInput("");
			return;
		}

		await processCommand(input);
		setInput("");
	};

	const executeCommand = async (command: string) => {
		// Check for mission command
		if (command.trim().toLowerCase() === "missions") {
			setIsMissionPanelVisible(true);
			return;
		}

		await processCommand(command);
	};

	return (
		<nav
			className="flex flex-col h-full w-full bg-black text-green-500 overflow-hidden font-mono relative"
			onMouseMove={(e) => {
				// Show nav when mouse is near the top of the screen
				if (e.clientY < 50) {
					setIsNavVisible(true);
				} else if (e.clientY > 100) {
					setIsNavVisible(false);
				}
			}}
		>
			{/* Terminal navigation bar */}
			<TerminalNav executeCommand={executeCommand} isVisible={isNavVisible} />

			{/* Terminal output */}
			<TerminalOutput output={renderedOutput} terminalRef={terminalRef} />

			{/* Input form */}
			<TerminalInput
				input={input}
				onInputChange={handleInput}
				onSubmit={handleSubmit}
				disabled={serverGameState?.gameOver || !serverGameState}
			/>

			{/* CRT effect overlays */}
			<CRTEffects />

			{/* Mission panel overlay */}
			<MissionPanel
				isVisible={isMissionPanelVisible}
				onClose={() => setIsMissionPanelVisible(false)}
			/>
		</nav>
	);
};

export default GameTerminal;
