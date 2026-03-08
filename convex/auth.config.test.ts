import { describe, expect, it } from "vitest";
import { buildAuthConfig } from "./lib/authConfig";

describe("buildAuthConfig", () => {
	it("builds the Convex auth provider from the supplied env", () => {
		expect(
			buildAuthConfig({
				CLERK_JWT_ISSUER_DOMAIN: "https://example.clerk.accounts.dev",
			} as NodeJS.ProcessEnv),
		).toEqual({
			providers: [
				{
					domain: "https://example.clerk.accounts.dev",
					applicationID: "convex",
				},
			],
		});
	});

	it("fails fast when the Clerk issuer domain is missing", () => {
		expect(() => buildAuthConfig({} as NodeJS.ProcessEnv)).toThrow(
			"CLERK_JWT_ISSUER_DOMAIN must be set for Convex auth",
		);
	});
});
