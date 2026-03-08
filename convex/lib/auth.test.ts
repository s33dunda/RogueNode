import { describe, expect, it } from "vitest";
import { requireAdmin, requireAuth } from "./auth";

describe("auth helpers", () => {
	it("requires an authenticated user", async () => {
		await expect(
			requireAuth({
				auth: { getUserIdentity: async () => null },
			} as never),
		).rejects.toThrow("Authentication required");
	});

	it("accepts an authenticated user", async () => {
		const identity = { subject: "user-1" };
		await expect(
			requireAuth({
				auth: { getUserIdentity: async () => identity },
			} as never),
		).resolves.toEqual(identity);
	});

	it("checks admin membership from ADMIN_USER_IDS", async () => {
		process.env.ADMIN_USER_IDS = "user-1,user-2";
		await expect(
			requireAdmin({
				auth: { getUserIdentity: async () => ({ subject: "user-1" }) },
			} as never),
		).resolves.toEqual({ subject: "user-1" });

		await expect(
			requireAdmin({
				auth: { getUserIdentity: async () => ({ subject: "user-3" }) },
			} as never),
		).rejects.toThrow("Admin privileges required");
	});
});
