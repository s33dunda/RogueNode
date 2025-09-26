import { useUser } from "@clerk/nextjs";
import { useAction } from "convex/react";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import type { GameState } from "@/convex/types";
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
	const executeLookCommand = useAction(api.gameActions.getLook);

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
	const [gameState, setGameState] = useState<GameState>({
		currentRoom: initialRoom.id,
		inventory: [],
		health: 100,
		visited: [initialRoom.id],
		enemies: [...enemies],
		gameOver: false,
		// Use authenticated Clerk user ID as playerId (fallback for loading state)
		playerId: user?.id || "loading",
		toolSessionId: undefined,
		skillPoints: 0,
		threatLevel: 1,
	});

	const terminalRef = useRef<HTMLDivElement>(null);

	// Use command processor hook
	const { processCommand } = useCommandProcessor({
		gameState,
		setGameState,
		output,
		setOutput,
		executePingCommand,
		executeLookCommand,
	});

	// Update playerId when user loads
	useLayoutEffect(() => {
		if (!user?.id || gameState.playerId === user.id) {
			return;
		}

		setGameState({
			currentRoom: initialRoom.id,
			inventory: [],
			health: 100,
			visited: [initialRoom.id],
			enemies: enemies.map((enemy) => ({ ...enemy })),
			gameOver: false,
			playerId: user.id,
			toolSessionId: undefined,
			skillPoints: 0,
			threatLevel: 1,
		});
		setOutput([
			"RogueNode v0.1 - DevOps Rogue Training Ground",
			"© 1977 TERMINAL INDUSTRIES",
			"---------------------------------------",
			"You awaken in a dimly lit server room. The hum of machines surrounds you.",
			"Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
			"",
			"Type 'help' for available commands or 'tools' to see DevOps commands.",
			"> ",
		]);
	}, [user?.id, gameState.playerId]);

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
