import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
	test: {
		css: false,
		environment: "node",
		exclude: [".next/**", "node_modules/**", "convex/_generated/**"],
		setupFiles: ["./vitest.setup.ts"],
	},
});
