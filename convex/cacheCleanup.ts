import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

// Return type for cache cleanup operation
const cleanupResult = v.object({
	deletedCount: v.number(),
	message: v.string(),
});

type CleanupResult = Infer<typeof cleanupResult>;

// Internal action for cache cleanup (used by cron jobs)
export const cleanupCacheEntriesInternal = internalAction({
	args: v.object({}),
	returns: cleanupResult,
	handler: async (ctx): Promise<CleanupResult> => {
		try {
			const deletedCount = await ctx.runMutation(
				internal.utils.cacheUtils.cleanupOldCacheEntries,
			);

			return {
				deletedCount,
				message: `Successfully deleted ${deletedCount} old cache entries`,
			};
		} catch (error) {
			console.error("Cache cleanup error:", error);
			return {
				deletedCount: 0,
				message: "Cache cleanup failed",
			};
		}
	},
});

// Return type for cache stats operation
const statsResult = v.object({
	totalEntries: v.number(),
	avgHitCount: v.number(),
	oldestEntry: v.optional(v.number()),
});

// Cache entry type for stats
const cacheEntry = v.object({
	_id: v.id("commandOutputCache"),
	command: v.string(),
	target: v.string(),
	hitCount: v.number(),
	timestamp: v.number(),
});

type CacheEntry = Infer<typeof cacheEntry>;
type StatsResult = Infer<typeof statsResult>;

// Admin-only action for cache cleanup (requires admin privileges)
export const cleanupCacheEntries = action({
	args: v.object({}),
	returns: cleanupResult,
	handler: async (ctx): Promise<CleanupResult> => {
		// Ensure user is an admin
		await requireAdmin(ctx);

		try {
			const deletedCount = await ctx.runMutation(
				internal.utils.cacheUtils.cleanupOldCacheEntries,
			);

			return {
				deletedCount,
				message: `Successfully deleted ${deletedCount} old cache entries`,
			};
		} catch (error) {
			console.error("Cache cleanup error:", error);
			return {
				deletedCount: 0,
				message: "Cache cleanup failed",
			};
		}
	},
});

// Admin-only action to get cache stats (for debugging)
export const getCacheStats = action({
	args: v.object({}),
	returns: statsResult,
	handler: async (ctx): Promise<StatsResult> => {
		// Ensure user is an admin
		await requireAdmin(ctx);

		try {
			// Get all cache entries for stats
			const entries: CacheEntry[] = await ctx.runQuery(
				internal.utils.cacheUtils.getAllCacheEntries,
			);

			if (entries.length === 0) {
				return {
					totalEntries: 0,
					avgHitCount: 0,
				};
			}

			const totalHits = entries.reduce(
				(sum: number, entry: CacheEntry) => sum + entry.hitCount,
				0,
			);
			const avgHitCount = Math.round((totalHits / entries.length) * 100) / 100;
			const oldestEntry = Math.min(
				...entries.map((e: CacheEntry) => e.timestamp),
			);

			return {
				totalEntries: entries.length,
				avgHitCount,
				oldestEntry,
			};
		} catch (error) {
			console.error("Cache stats error:", error);
			return {
				totalEntries: 0,
				avgHitCount: 0,
			};
		}
	},
});
