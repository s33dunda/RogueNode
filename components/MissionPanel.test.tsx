// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MissionPanel from "./MissionPanel";

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

const mockUseMutation = vi.mocked(useMutation);
const mockUseQuery = vi.mocked(useQuery);

describe("MissionPanel", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("does not render when hidden", () => {
		mockUseQuery.mockReturnValue([]);
		mockUseMutation.mockReturnValue(vi.fn());

		const { container } = render(
			<MissionPanel isVisible={false} onClose={vi.fn()} />,
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("starts an available mission", async () => {
		const startMission = vi.fn().mockResolvedValue(undefined);
		mockUseQuery.mockReturnValue([
			{
				id: "ping-tutorial",
				title: "Bring the server online",
				synopsis: "Ping the main server.",
				status: "available",
			},
		]);
		mockUseMutation.mockReturnValue(startMission);

		render(<MissionPanel isVisible onClose={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: "START MISSION" }));

		await waitFor(() =>
			expect(startMission).toHaveBeenCalledWith({
				missionId: "ping-tutorial",
			}),
		);
	});
});
