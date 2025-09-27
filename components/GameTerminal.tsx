import { useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import { useCommandProcessor } from "../lib/hooks/useCommandProcessor";
import { enemies, initialRoom } from "../utils/GameData";
import CRTEffects from "./CRTEffects";
import TerminalInput from "./TerminalInput";
import TerminalNav from "./TerminalNav";
import TerminalOutput from "./TerminalOutput";

const GameTerminal = () => {
	// Get authenticated user from Clerk
	const { user, isLoaded } = useUser();

	// Convex action hooks (must be called before any returns)
	const executePingCommand = useAction(api.agents.pingAgent.executePingCommand);
	const identityReady = isLoaded && !!user?.id;
	const executeLookCommand = useQuery(
		api.gameActions.getLook,
		identityReady ? {} : "skip",
	);
	const initializeGameState = useMutation(api.gameActions.initializeGameState);
	const serverGameState = useQuery(
		api.gameActions.getGameState,
		identityReady ? {} : "skip",
	);

	const [output, setOutput] = useState<string[]>([
		"RogueNode v0.1 - DevOps Rogue Training Ground",
		"© 1977 TERMINAL INDUSTRIES",
		"---------------------------------------",
		"You awaken in a dimly lit server room. The hum of machines surrounds you.",
		"Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
		"",
		"Type 'help' for available commands like 'look' to take inventory",
		"> ",
	]);
	const [input, setInput] = useState("");
	const [isNavVisible, setIsNavVisible] = useState(false);
	const [gameStateInitialized, setGameStateInitialized] = useState(false);

	// Reusable output for initialized game state
	const initializedOutput = [
		"RogueNode v0.1 - DevOps Rogue Training Ground",
		"© 1977 TERMINAL INDUSTRIES",
		"---------------------------------------",
		"You awaken in a dimly lit server room. The hum of machines surrounds you.",
		"Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
		"",
		"Type 'help' for available commands or 'tools' to see DevOps commands.",
		"> ",
	];

	// Use server game state as single source of truth
	const gameState = serverGameState || {
		currentRoom: initialRoom.id,
		inventory: [],
		health: 100,
		visited: [initialRoom.id],
		enemies: [...enemies],
		gameOver: false,
		playerId: "loading",
		toolSessionId: undefined,
		skillPoints: 0,
		threatLevel: 1,
	};

	const terminalRef = useRef<HTMLDivElement>(null);

	// Use command processor hook
	const { processCommand } = useCommandProcessor({
		gameState,
		output,
		setOutput,
		executePingCommand,
		executeLookCommand,
	});

	// Reset state when user changes to prevent cross-account leakage
	// biome-ignore lint/correctness/useExhaustiveDependencies: maybe we create a reset or clearCache later
	useLayoutEffect(() => {
		setGameStateInitialized(false);
		setOutput([
			"RogueNode v0.1 - DevOps Rogue Training Ground",
			"© 1977 TERMINAL INDUSTRIES",
			"---------------------------------------",
			"Loading...",
			"> ",
		]);
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
				setOutput(initializedOutput);
			}
			return;
		}

		// If already tried to initialize, don't retry
		if (gameStateInitialized) {
			return;
		}

		// Initialize game state in the database first
		initializeGameState()
			.then(() => {
				setGameStateInitialized(true);
				setOutput(initializedOutput);
			})
			.catch((err) => {
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
		const lines = output.length;
		if (terminalRef.current) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
		void lines;
	}, [output.length]);

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
	if (!gameStateInitialized || executeLookCommand === undefined) {
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
			<TerminalOutput output={output} terminalRef={terminalRef} />

			{/* Input form */}
			<TerminalInput
				input={input}
				onInputChange={handleInput}
				onSubmit={handleSubmit}
				disabled={gameState.gameOver}
			/>

			{/* CRT effect overlays */}
			<CRTEffects />
		</nav>
	);
};

export default GameTerminal;
