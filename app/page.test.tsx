// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("@clerk/nextjs", () => ({
	SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	UserButton: () => <div>User</div>,
}));

vi.mock("convex/react", () => ({
	Authenticated: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="authenticated">{children}</div>
	),
	Unauthenticated: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="unauthenticated">{children}</div>
	),
}));

vi.mock("../components/GameTerminal", () => ({
	default: () => <div data-testid="game-terminal">Terminal</div>,
}));

describe("app/page", () => {
	it("renders the authenticated terminal shell and unauthenticated sign-in form", () => {
		render(<Home />);

		expect(screen.getByTestId("game-terminal")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
	});
});
