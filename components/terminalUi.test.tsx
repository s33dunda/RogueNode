// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CRTEffects from "./CRTEffects";
import TerminalInput from "./TerminalInput";
import TerminalNav from "./TerminalNav";
import TerminalOutput from "./TerminalOutput";

describe("terminal UI components", () => {
	it("renders the CRT overlays", () => {
		const { container } = render(<CRTEffects />);

		expect(container.querySelectorAll(".fixed.inset-0")).toHaveLength(2);
		expect(container.querySelector("style")).toHaveTextContent("scanline");
	});

	it("submits input changes and form events", () => {
		const onInputChange = vi.fn();
		const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

		render(
			<TerminalInput
				input="help"
				onInputChange={onInputChange}
				onSubmit={onSubmit}
				disabled={false}
			/>,
		);

		fireEvent.change(screen.getByRole("textbox"), {
			target: { value: "status" },
		});
		fireEvent.submit(screen.getByRole("textbox").closest("form")!);

		expect(onInputChange).toHaveBeenCalled();
		expect(onSubmit).toHaveBeenCalled();
	});

	it("renders terminal output with headings and commands", () => {
		const terminalRef = { current: null };
		render(
			<TerminalOutput
				output={["", "> help", "STATUS:", "online"]}
				terminalRef={terminalRef}
			/>,
		);

		expect(screen.getByText("> help")).toBeInTheDocument();
		expect(screen.getByText("STATUS:")).toHaveClass("font-bold");
		expect(screen.getByText("online")).toBeInTheDocument();
	});

	it("routes terminal nav buttons to commands", () => {
		const executeCommand = vi.fn();
		render(<TerminalNav executeCommand={executeCommand} isVisible />);

		for (const [label, command] of [
			["Help", "help"],
			["Tools", "tools"],
			[/Missions/, "missions"],
			["Restart", "restart"],
			["Status", "status"],
		] as const) {
			fireEvent.click(screen.getByRole("button", { name: label }));
			expect(executeCommand).toHaveBeenCalledWith(command);
		}
	});
});
