import type React from "react";
import type { RefObject } from "react";

interface TerminalOutputProps {
	output: string[];
	terminalRef: RefObject<HTMLDivElement | null>;
}

const TerminalOutput: React.FC<TerminalOutputProps> = ({
	output,
	terminalRef,
}) => {
	return (
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
					// biome-ignore lint/suspicious/noArrayIndexKey: POC
					<div key={i} className={className}>
						{line === "" ? "\u00A0" : line}
					</div>
				);
			})}
		</div>
	);
};

export default TerminalOutput;
