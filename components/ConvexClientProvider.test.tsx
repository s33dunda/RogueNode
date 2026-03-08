// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
const mockProvider = vi.fn(({ children }: { children: React.ReactNode }) => (
	<div data-testid="convex-provider">{children}</div>
));
const mockConvexReactClient = vi.fn(
	class MockConvexReactClient {
		constructor(public url: string) {}
	},
);

vi.mock("@clerk/nextjs", () => ({
	useAuth: mockUseAuth,
}));

vi.mock("convex/react", () => ({
	ConvexReactClient: mockConvexReactClient,
}));

vi.mock("convex/react-clerk", () => ({
	ConvexProviderWithClerk: mockProvider,
}));

describe("ConvexClientProvider", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("creates a Convex client and renders the Clerk-aware provider", async () => {
		process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
		mockUseAuth.mockReturnValue({ getToken: vi.fn() });

		const { default: ConvexClientProvider } = await import(
			"./ConvexClientProvider"
		);

		render(
			<ConvexClientProvider>
				<span>child</span>
			</ConvexClientProvider>,
		);

		expect(mockConvexReactClient).toHaveBeenCalledWith(
			"https://example.convex.cloud",
		);
		expect(mockProvider).toHaveBeenCalled();
		expect(screen.getByTestId("convex-provider")).toHaveTextContent("child");
	});
});
