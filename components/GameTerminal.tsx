import { HelpCircle, Info, RefreshCw, Terminal } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { parseCommand } from "../utils/GameCommands";
import { enemies, initialRoom, type GameState } from "../utils/GameData";

const GameTerminal = () => {
	const [output, setOutput] = useState<string[]>([
		"RogueNode v0.1 - DevOps Rogue Training Ground",
		"© 1977 TERMINAL INDUSTRIES",
		"---------------------------------------",
		"You awaken in a dimly lit server room. The hum of machines surrounds you.",
		"Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
		"",
		"Type 'help' for available commands or 'tools' to see DevOps commands.",
		"> ",
	]);
	const [input, setInput] = useState("");
	const [isNavVisible, setIsNavVisible] = useState(false);
	const [gameState, setGameState] = useState<GameState>({
		currentRoom: initialRoom,
		inventory: [],
		health: 100,
		visited: [initialRoom],
		enemies: [...enemies],
		gameOver: false,
	});

	const terminalRef = useRef<HTMLDivElement>(null);

	const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInput(e.target.value);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Add user command to output
		const newOutput = [...output.slice(0, -1), `> ${input}`, ""];

		if (input.trim() !== "") {
			// Process command and get response
			const { response, newState } = parseCommand(
				input.toLowerCase(),
				gameState,
			);
			// Add response to output
			newOutput.push(...response, "> ");
			// Update game state if command changed it
			if (newState) {
				setGameState(newState);
			}
		} else {
			newOutput.push("> ");
		}

		setOutput(newOutput);
		setInput("");
	};

	const executeCommand = (command: string) => {
		// Simulate typing a command through the navbar
		const newOutput = [...output.slice(0, -1), `> ${command}`, ""];
		const { response, newState } = parseCommand(command, gameState);
		newOutput.push(...response, "> ");
		if (newState) {
			setGameState(newState);
		}
		setOutput(newOutput);
	};

	// Auto-scroll to bottom when output changes
	useEffect(() => {
		if (terminalRef.current) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
	}, [output]);

	return (
		<div
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
			<div
				className={`transition-all duration-300 ease-in-out border-b border-green-800 bg-black ${isNavVisible ? "h-12 opacity-100" : "h-0 opacity-0 overflow-hidden"}`}
			>
				<div className="flex items-center justify-between px-4 h-full">
					<div className="text-green-500 font-bold tracking-wider">
						CYBERDUNGEON v0.1
					</div>
					<div className="flex space-x-4">
						<button
							onClick={() => executeCommand("help")}
							className="flex items-center text-green-500 hover:text-green-400 transition"
						>
							<HelpCircle className="w-4 h-4 mr-1" />
							<span className="text-sm">Help</span>
						</button>
						<button
							onClick={() => executeCommand("tools")}
							className="flex items-center text-green-500 hover:text-green-400 transition"
						>
							<Terminal className="w-4 h-4 mr-1" />
							<span className="text-sm">Tools</span>
						</button>
						<button
							onClick={() => executeCommand("restart")}
							className="flex items-center text-green-500 hover:text-green-400 transition"
						>
							<RefreshCw className="w-4 h-4 mr-1" />
							<span className="text-sm">Restart</span>
						</button>
						<button
							onClick={() => executeCommand("status")}
							className="flex items-center text-green-500 hover:text-green-400 transition"
						>
							<Info className="w-4 h-4 mr-1" />
							<span className="text-sm">Status</span>
						</button>
					</div>
				</div>
			</div>

			{/* Terminal output */}
			<div
				ref={terminalRef}
				className="flex-1 overflow-y-auto whitespace-pre-wrap p-4"
				style={{
					textShadow: "0 0 5px rgba(0, 255, 0, 0.5)",
					lineHeight: "1.3",
				}}
			>
				{output.map((line, i) => {
					const isCommand = line.startsWith(">");
					const isHeading = line.match(/^[A-Z]+:$/);
					const className = `${isCommand ? "text-yellow-500" : ""} ${isHeading ? "font-bold text-green-400" : ""}`;
					return (
						<div key={i} className={className}>
							{line}
						</div>
					);
				})}
			</div>

			{/* Input form */}
			<form
				onSubmit={handleSubmit}
				className="flex border-t border-green-800 p-4"
			>
				<div className="text-yellow-500 mr-2">&gt;</div>
				<input
					type="text"
					value={input}
					onChange={handleInput}
					className="flex-1 bg-transparent border-none outline-none text-green-500 caret-green-500"
					autoFocus
					disabled={gameState.gameOver}
					spellCheck="false"
				/>
			</form>

			{/* CRT effect overlays */}
			<div className="fixed inset-0 pointer-events-none bg-green-900 opacity-[0.03] z-10"></div>
			<div
				className="fixed inset-0 pointer-events-none z-20"
				style={{
					background:
						"linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.2) 50%, transparent 100%)",
					backgroundSize: "100% 4px",
					animation: "scanline 10s linear infinite",
				}}
			></div>
			<style>{`
        @keyframes scanline {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }
      `}</style>
		</div>
	);
};

export default GameTerminal;
