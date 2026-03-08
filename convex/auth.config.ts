import { buildAuthConfig } from "./lib/authConfig";

// Convex loads this file as the auth bootstrap boundary.
const authConfig = buildAuthConfig();

export { buildAuthConfig };
export default authConfig;
