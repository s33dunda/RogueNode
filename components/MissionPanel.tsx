import { useMutation, useQuery } from "convex/react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";

interface MissionPanelProps {
	isVisible: boolean;
	onClose: () => void;
}

const MissionPanel: React.FC<MissionPanelProps> = ({ isVisible, onClose }) => {
	const [selectedMission, setSelectedMission] = useState<string | null>(null);
	const [isStarting, setIsStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Query available missions
	const missions = useQuery(api.gameActions.getActiveMissions, {});
	const startMission = useMutation(api.gameActions.startMission);

	// Handle ESC key to close panel
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isVisible) {
				onClose();
			}
		};

		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [isVisible, onClose]);

	const handleStartMission = async (missionId: string) => {
		setIsStarting(true);
		setError(null);
		try {
			await startMission({ missionId });
			setSelectedMission(null);
			// Show success feedback
			setTimeout(() => {
				onClose();
			}, 1000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start mission");
		} finally {
			setIsStarting(false);
		}
	};

	if (!isVisible) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
			<div className="relative w-full max-w-2xl mx-4 bg-black border-2 border-green-500 rounded-lg shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b-2 border-green-500">
					<h2 className="text-xl font-bold text-green-500 font-mono">
						AVAILABLE MISSIONS
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-green-500 hover:text-green-300 transition-colors"
						aria-label="Close mission panel"
					>
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>Close</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* Content */}
				<div className="p-6 max-h-[60vh] overflow-y-auto">
					{error && (
						<div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-red-400 font-mono text-sm">
							ERROR: {error}
						</div>
					)}

					{!missions ? (
						<div className="text-green-500 font-mono text-center py-8">
							Loading missions...
						</div>
					) : missions.length === 0 ? (
						<div className="text-green-500 font-mono text-center py-8">
							No missions available in this room.
							<br />
							Explore other areas to find missions.
						</div>
					) : (
						<div className="space-y-4">
							{missions.map((mission) => (
								<div
									key={mission.id}
									className={`border-2 rounded-lg p-4 transition-all ${
										selectedMission === mission.id
											? "border-green-300 bg-green-900/20"
											: "border-green-700 hover:border-green-500"
									}`}
								>
									<div className="flex items-start justify-between mb-2">
										<h3 className="text-lg font-bold text-green-400 font-mono">
											{mission.title}
										</h3>
										<span
											className={`px-2 py-1 text-xs font-mono rounded ${
												mission.status === "completed"
													? "bg-blue-900/50 text-blue-400 border border-blue-500"
													: mission.status === "in_progress"
														? "bg-yellow-900/50 text-yellow-400 border border-yellow-500"
														: "bg-gray-900/50 text-gray-400 border border-gray-500"
											}`}
										>
											{mission.status === "completed"
												? "COMPLETED"
												: mission.status === "in_progress"
													? "IN PROGRESS"
													: "AVAILABLE"}
										</span>
									</div>

									<p className="text-green-500 font-mono text-sm mb-4">
										{mission.synopsis}
									</p>

									{mission.status === "available" && (
										<button
											type="button"
											onClick={() => handleStartMission(mission.id)}
											disabled={isStarting}
											className="w-full px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-mono font-bold rounded transition-colors"
										>
											{isStarting ? "STARTING..." : "START MISSION"}
										</button>
									)}

									{mission.status === "in_progress" && (
										<div className="text-yellow-400 font-mono text-sm text-center">
											Mission in progress. Complete objectives to finish.
										</div>
									)}

									{mission.status === "completed" && (
										<div className="text-blue-400 font-mono text-sm text-center">
											✓ Mission completed successfully!
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="p-4 border-t-2 border-green-500 text-green-500 font-mono text-xs text-center">
					Press ESC or click X to close
				</div>
			</div>
		</div>
	);
};

export default MissionPanel;
