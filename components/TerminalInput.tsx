import type React from "react";

interface TerminalInputProps {
	input: string;
	onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onSubmit: (e: React.FormEvent) => void;
	disabled: boolean;
}

const TerminalInput: React.FC<TerminalInputProps> = ({
	input,
	onInputChange,
	onSubmit,
	disabled,
}) => {
	return (
		<form onSubmit={onSubmit} className="flex border-t border-green-800 p-4">
			<div className="text-yellow-500 mr-2">&gt;</div>
			<input
				type="text"
				value={input}
				onChange={onInputChange}
				className="flex-1 bg-transparent border-none outline-none text-green-500 caret-green-500"
				// biome-ignore lint/a11y/noAutofocus: POC
				autoFocus
				disabled={disabled}
				spellCheck="false"
			/>
		</form>
	);
};

export default TerminalInput;
