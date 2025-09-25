import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Authentication helper that ensures a user is logged in
 * @param ctx - Convex context (query, mutation, or action)
 * @returns User identity object
 * @throws Error if user is not authenticated
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Authentication required");
	}
	return identity;
}

/**
 * Authentication helper that ensures a user is logged in and matches the provided playerId
 * @param ctx - Convex context (query, mutation, or action)
 * @param playerId - Player ID to validate against authenticated user
 * @returns User identity object
 * @throws Error if user is not authenticated or playerId doesn't match
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
 * Authentication helper that ensures a user is an admin.
 * Validates Clerk custom claims and the optional ADMIN_USER_IDS safelist.
 * @param ctx - Convex context (query, mutation, or action)
 * @returns User identity object
 * @throws Error if user is not authenticated or not an admin
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx | ActionCtx) {
	const identity = await requireAuth(ctx);

	const isAdmin =
		identity.customClaims?.role === "admin" ||
		(process.env.ADMIN_USER_IDS ?? "")
			.split(",")
			.filter(Boolean)
			.includes(identity.subject);

	if (!isAdmin) {
		throw new Error("Admin privileges required");
	}

	return identity;
}
