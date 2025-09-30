import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import type React from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import { useCommandProcessor } from "../lib/hooks/useCommandProcessor";
import CRTEffects from "./CRTEffects";
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
	const [gameStateInitialized, setGameStateInitialized] = useState(false);

	const terminalRef = useRef<HTMLDivElement>(null);

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

	// Reset state when user changes to prevent cross-account leakage
	// biome-ignore lint/correctness/useExhaustiveDependencies: maybe we create a reset or clearCache later
	useLayoutEffect(() => {
		setGameStateInitialized(false);
	}, [user?.id]);

	// Initialize game state when user loads
	useLayoutEffect(() => {
		if (!user?.id) {
			return;
		}

		// If server already has correct user data, just set initialized
		if (serverGameState?.playerId === user.id) {
			if (!gameStateInitialized) {
				setGameStateInitialized(true);
			}
			return;
		}

		// If already tried to initialize, don't retry
		if (gameStateInitialized) {
			return;
		}

		// Initialize game state in the database first
		initializeGameState().catch((err) => {
			console.error("Failed to initialize game state:", err);
			// Don't set initialized=true on error to allow manual retry
		});
	}, [
		user?.id,
		serverGameState?.playerId,
		gameStateInitialized,
		initializeGameState,
	]);

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
	if (!gameStateInitialized || terminalOutputs === undefined) {
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
		await processCommand(input);
		setInput("");
	};

	const executeCommand = async (command: string) => {
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
		</nav>
	);
};

export default GameTerminal;
