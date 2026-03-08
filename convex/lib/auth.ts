import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Ensure the request is authenticated and return the user's identity.
 *
 * @param ctx - Convex query, mutation, or action context
 * @returns The authenticated user's identity object
 * @throws Error if no authenticated user is found
 *
 * @example
 * // In a mutation or action: ensure caller is authenticated and get player id
 * const identity = await requireAuth(ctx);
 * const playerId = identity.subject;
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Authentication required");
	}
	return identity;
}

/**
 * Ensure the request is from an administrator and return the authenticated identity.
 *
 * Admin status is determined by whether the authenticated identity's `subject` is listed
 * in the comma-separated `ADMIN_USER_IDS` environment variable.
 *
 * @param ctx - Convex context (`QueryCtx | MutationCtx | ActionCtx`)
 * @returns The authenticated user identity object
 * @throws Error if there is no authenticated user or the user is not an admin
 *
 * @example
 * // In a mutation that requires admin privileges:
 * export default mutation(async (ctx, args) => {
 *   const identity = await requireAdmin(ctx);
 *   // perform admin-only action using identity.subject as the admin user id
 * });
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx | ActionCtx) {
	const identity = await requireAuth(ctx);

	const isAdmin =
		// TODO: Re-enable when Clerk roles are configured
		// identity.customClaims?.role === "admin" ||
		(process.env.ADMIN_USER_IDS ?? "")
			.split(",")
			.filter(Boolean)
			.includes(identity.subject);

	if (!isAdmin) {
		throw new Error("Admin privileges required");
	}

	return identity;
}
