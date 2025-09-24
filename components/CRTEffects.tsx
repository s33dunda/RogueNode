import type React from "react";

const CRTEffects: React.FC = () => {
	return (
		<>
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
		</>
	);
};

export default CRTEffects;