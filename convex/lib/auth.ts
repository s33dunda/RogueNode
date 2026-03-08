import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Authentication required");
	}
	return identity;
}

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
