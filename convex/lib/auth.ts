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
 * Ensures the request is authenticated and the authenticated user's subject equals the provided playerId.
 *
 * @param ctx - Convex context (QueryCtx, MutationCtx, or ActionCtx)
 * @param playerId - Player ID expected to match the authenticated user's subject
 * @returns The authenticated user's identity object
 * @throws Error if no authenticated user is present or if the authenticated user's subject does not match `playerId`
 * @example
 * // In a mutation or action:
 * // const identity = await requireAuthWithPlayerId(ctx, playerId);
 */
export async function requireAuthWithPlayerId(
	ctx: QueryCtx | MutationCtx | ActionCtx,
	playerId: string,
) {
	const identity = await requireAuth(ctx);

	// Ensure the playerId matches the authenticated user's subject
	if (identity.subject !== playerId) {
		throw new Error("Player ID does not match authenticated user");
	}

	return identity;
}

/**
 * Ensure the current request is made by an administrator and return the authenticated identity.
 *
 * Determines admin status by checking `identity.customClaims?.role === "admin"` or whether
 * `identity.subject` is included in the comma-separated `ADMIN_USER_IDS` environment variable.
 *
 * @param ctx - Convex context (`QueryCtx | MutationCtx | ActionCtx`)
 * @returns The authenticated user identity object
 * @throws Error if the request is not authenticated or the user is not an admin
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
