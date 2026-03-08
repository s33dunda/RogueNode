// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameTerminal, {
	buildRenderedOutput,
	getNavVisibility,
	isMissionCommand,
	INTRO_LINES,
} from "./GameTerminal";

vi.mock("@clerk/nextjs", () => ({
	useUser: vi.fn(),
}));

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("../lib/hooks/useCommandProcessor", () => ({
	useCommandProcessor: () => ({
		processCommand: vi.fn(),
	}),
}));

vi.mock("./CRTEffects", () => ({
	default: () => <div data-testid="crt-effects" />,
}));

vi.mock("./MissionPanel", () => ({
	default: ({ isVisible }: { isVisible: boolean }) => (
		<div data-testid="mission-panel">{String(isVisible)}</div>
	),
}));

vi.mock("./TerminalInput", () => ({
	default: () => <div data-testid="terminal-input" />,
}));

vi.mock("./TerminalNav", () => ({
	default: ({ isVisible }: { isVisible: boolean }) => (
		<div data-testid="terminal-nav">{String(isVisible)}</div>
	),
}));

vi.mock("./TerminalOutput", () => ({
	default: ({ output }: { output: string[] }) => (
		<div data-testid="terminal-output">{output.join("\n")}</div>
	),
}));

const mockUseUser = vi.mocked(useUser);
const mockUseMutation = vi.mocked(useMutation);
const mockUseQuery = vi.mocked(useQuery);

describe("GameTerminal helpers", () => {
	it("detects mission commands", () => {
		expect(isMissionCommand(" missions ")).toBe(true);
		expect(isMissionCommand("help")).toBe(false);
	});

	it("computes nav visibility thresholds", () => {
		expect(getNavVisibility(25, false)).toBe(true);
		expect(getNavVisibility(120, true)).toBe(false);
		expect(getNavVisibility(75, true)).toBe(true);
	});

	it("builds rendered output from intro and history", () => {
		expect(buildRenderedOutput(undefined)).toEqual([...INTRO_LINES, "> "]);
		expect(
			buildRenderedOutput([
				{
					commandInput: "help",
					outputLines: ["STATUS:", "online"],
				},
			]),
		).toEqual([...INTRO_LINES, "> help", "STATUS:", "online"]);
	});
});

describe("GameTerminal", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders a loading state while Clerk is loading", () => {
		mockUseUser.mockReturnValue({ user: null, isLoaded: false } as never);
		mockUseMutation.mockReturnValue(vi.fn());
		mockUseQuery.mockReturnValue(undefined);

		render(<GameTerminal />);

		expect(screen.getByText("Loading...")).toBeInTheDocument();
	});

	it("asks unauthenticated users to sign in", () => {
		mockUseUser.mockReturnValue({ user: null, isLoaded: true } as never);
		mockUseMutation.mockReturnValue(vi.fn());
		mockUseQuery.mockReturnValue(undefined);

		render(<GameTerminal />);

		expect(
			screen.getByText("Please sign in to access the DevOps training terminal."),
		).toBeInTheDocument();
	});

	it("initializes game state for a newly loaded user", async () => {
		const initializeGameState = vi.fn().mockResolvedValue(undefined);
		mockUseUser.mockReturnValue({
			user: { id: "user-1" },
			isLoaded: true,
		} as never);
		mockUseMutation.mockReturnValue(initializeGameState);
		mockUseQuery
			.mockReturnValueOnce(null)
			.mockReturnValueOnce(undefined);

		render(<GameTerminal />);

		await waitFor(() => expect(initializeGameState).toHaveBeenCalled());
		expect(screen.getByText("Initializing game state...")).toBeInTheDocument();
	});

	it("renders the terminal shell when game state is ready", () => {
		mockUseUser.mockReturnValue({
			user: { id: "user-1" },
			isLoaded: true,
		} as never);
		mockUseMutation.mockReturnValue(vi.fn());
		mockUseQuery
			.mockReturnValueOnce({ playerId: "user-1", gameOver: false })
			.mockReturnValueOnce([]);

		render(<GameTerminal />);

		expect(screen.getByTestId("terminal-nav")).toHaveTextContent("false");
		expect(screen.getByTestId("terminal-output")).toHaveTextContent(
			"RogueNode v0.1 - DevOps Rogue Training Ground",
		);
		expect(screen.getByTestId("terminal-input")).toBeInTheDocument();
		expect(screen.getByTestId("mission-panel")).toHaveTextContent("false");
	});
});
