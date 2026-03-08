export function buildAuthConfig(env: NodeJS.ProcessEnv = process.env) {
	const domain = env.CLERK_JWT_ISSUER_DOMAIN;
	if (!domain) {
		throw new Error("CLERK_JWT_ISSUER_DOMAIN must be set for Convex auth");
	}

	return {
		providers: [
			{
				domain,
				applicationID: "convex",
			},
		],
	};
}

export default buildAuthConfig();
