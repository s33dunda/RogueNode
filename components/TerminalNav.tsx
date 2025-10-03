import { HelpCircle, Info, RefreshCw, Terminal } from "lucide-react";
import type React from "react";

interface TerminalNavProps {
	executeCommand: (command: string) => void;
	isVisible: boolean;
}

const TerminalNav: React.FC<TerminalNavProps> = ({
	executeCommand,
	isVisible,
}) => {
	return (
		<div
			className={`transition-all duration-300 ease-in-out border-b border-green-800 bg-black ${isVisible ? "h-12 opacity-100" : "h-0 opacity-0 overflow-hidden"}`}
		>
			<div className="flex items-center justify-between px-4 h-full">
				<div className="flex space-x-4">
					<button
						type="button"
						onClick={() => executeCommand("help")}
						className="flex items-center text-green-500 hover:text-green-400 transition"
					>
						<HelpCircle className="w-4 h-4 mr-1" />
						<span className="text-sm">Help</span>
					</button>
					<button
						type="button"
						onClick={() => executeCommand("tools")}
						className="flex items-center text-green-500 hover:text-green-400 transition"
					>
						<Terminal className="w-4 h-4 mr-1" />
						<span className="text-sm">Tools</span>
					</button>
					<button
						type="button"
						onClick={() => executeCommand("missions")}
						className="flex items-center text-green-500 hover:text-green-400 transition"
					>
						<svg
							className="w-4 h-4 mr-1"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>Missions</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
							/>
						</svg>
						<span className="text-sm">Missions</span>
					</button>
					<button
						type="button"
						onClick={() => executeCommand("restart")}
						className="flex items-center text-green-500 hover:text-green-400 transition"
					>
						<RefreshCw className="w-4 h-4 mr-1" />
						<span className="text-sm">Restart</span>
					</button>
					<button
						type="button"
						onClick={() => executeCommand("status")}
						className="flex items-center text-green-500 hover:text-green-400 transition"
					>
						<Info className="w-4 h-4 mr-1" />
						<span className="text-sm">Status</span>
					</button>
				</div>
			</div>
		</div>
	);
};

export default TerminalNav;
