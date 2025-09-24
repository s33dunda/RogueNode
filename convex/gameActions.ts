import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Record tool usage for learning progression tracking
export const recordToolUsage = internalMutation({
  args: {
    playerId: v.string(),
    tool: v.string(),
    command: v.string(),
    room: v.string(),
    success: v.boolean(),
    context: v.object({
      networkState: v.optional(v.object({
        threatLevel: v.number(),
        latency: v.number(),
        packetLoss: v.number(),
      })),
      roomInfrastructure: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    // Create a unique session ID if one doesn't exist
    const sessionId = `${args.playerId}-${Date.now()}`;

    // Record the tool usage
    await ctx.db.insert("toolUsage", {
      playerId: args.playerId,
      sessionId,
      tool: args.tool,
      command: args.command,
      room: args.room,
      timestamp: Date.now(),
      success: args.success,
      context: args.context,
    });

    // Update or create game session tracking
    const existingSession = await ctx.db
      .query("gameSessions")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
      .order("desc")
      .first();

    if (existingSession) {
      await ctx.db.patch(existingSession._id, {
        currentRoom: args.room,
        lastActivity: Date.now(),
      });
    } else {
      await ctx.db.insert("gameSessions", {
        playerId: args.playerId,
        currentRoom: args.room,
        health: 100,
        skillLevel: 1,
        lastActivity: Date.now(),
      });
    }
  },
});