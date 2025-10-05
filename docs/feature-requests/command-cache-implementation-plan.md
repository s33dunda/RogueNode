# Command Line Agent Output Caching Implementation Plan

## 🎯 **Objective**

Implement intelligent caching for command line agent outputs to avoid regenerating responses when similar game states have executed the same command before.

## 📋 **Implementation Strategy**

### **1. Database Schema Updates**

Add new table `commandOutputCache` to `convex/schema.ts`:

```typescript
commandOutputCache: defineTable({
  // Cache key components
  command: v.string(),           // "ping", "ssh", "docker", etc.
  target: v.string(),            // Command target (e.g., "database-01")

  // Game state fingerprint for similarity matching
  gameStateHash: v.string(),     // Hashed combination of relevant state
  currentRoom: v.string(),       // Room where command was executed
  threatLevel: v.number(),       // Current threat level
  playerHealth: v.number(),      // Player health category (healthy/wounded/critical)
  activeThreatCount: v.number(),  // Number of active threats in room

  // Cached result
  output: v.array(v.string()),   // Agent-generated output
  skillGained: v.number(),       // Skill points gained
  success: v.boolean(),          // Command success status

  // Metadata
  playerId: v.string(),          // Original player who generated this
  timestamp: v.number(),         // When this was cached
  hitCount: v.number(),          // How many times this cache was used

}).index("by_command_target_hash", ["command", "target", "gameStateHash"])
  .index("by_timestamp", ["timestamp"])
  .index("by_hit_count", ["hitCount"]);
```

### **2. Game State Normalization**

Create `convex/utils/gameStateNormalizer.ts`:

- **Health categorization**: Convert exact health (87) → category ("healthy": 70-100, "wounded": 30-69, "critical": 0-29)
- **Threat analysis**: Count active threats in current room
- **State hashing**: Generate consistent hash from normalized state components
- **Cache key generation**: Combine command + target + normalized state

### **3. Cache Management System**

Create `convex/cache/commandCache.ts` with:

#### **Cache Lookup Logic**

1. Generate normalized game state hash
2. Query cache table by `command + target + gameStateHash`
3. Apply similarity scoring for near-matches
4. Return cached result if confidence > 85%

#### **Cache Storage Logic**

1. Store new agent outputs after generation
2. Implement TTL (time-to-live) cleanup for old entries
3. Track cache hit statistics for optimization

#### **Cache Invalidation**

- Remove entries older than 7 days
- Clean up entries with 0 hit count after 24 hours
- Respect player privacy (optional per-player caching)

### **4. Agent Integration**

Update `convex/agents/pingAgent.ts`:

#### **Pre-execution Cache Check**

```typescript
// 1. Generate cache key from normalized game state
const cacheKey = generateCacheKey(command, target, gameState);

// 2. Check for existing cached result
const cachedResult = await checkCache(ctx, cacheKey);

// 3. Return cached result if found
if (cachedResult && cachedResult.confidence > 0.85) {
  await incrementCacheHit(ctx, cachedResult.id);
  return {
    output: cachedResult.output,
    threadId: cachedResult.threadId || threadId,
    skillGained: cachedResult.skillGained,
    success: cachedResult.success,
    fromCache: true
  };
}
```

#### **Post-execution Cache Storage**

```typescript
// After AI generation, store in cache
await storeInCache(ctx, {
  cacheKey,
  output: result.output,
  skillGained,
  success: true,
  gameState: normalizedGameState
});
```

### **5. Performance Optimizations**

#### **Intelligent Caching Strategy**

- **Room-specific context**: Same command in same room with similar threats
- **Health brackets**: Group similar health levels (healthy/wounded/critical)
- **Threat patterns**: Cache based on number and type of active threats
- **Fuzzy matching**: 85%+ similarity threshold for cache hits

#### **Cache Analytics**

- Track cache hit/miss ratios
- Monitor most frequently cached commands
- Identify optimal cache lifetime settings
- Performance metrics for cache lookup speed

### **6. Configuration & Controls**

Add to `convex/config/cacheConfig.ts`:

```typescript
export const CACHE_CONFIG = {
  enabled: true,                    // Global cache toggle
  ttlHours: 168,                   // 7 days default TTL
  similarityThreshold: 0.85,       // 85% match required
  maxCacheSize: 10000,             // Prevent unlimited growth
  cleanupIntervalHours: 24,        // Daily cleanup job
  perPlayerCaching: true,          // Allow player-specific cache
  verboseLogging: false,           // Debug cache operations
};
```

## 🔄 **Implementation Phases**

### **Phase 1: Foundation** (Day 1)

- Update database schema
- Implement game state normalization
- Create basic cache storage/retrieval functions

### **Phase 2: Integration** (Day 2)

- Integrate cache checks into pingAgent
- Add cache storage after AI generation
- Implement basic similarity matching

### **Phase 3: Optimization** (Day 3)

- Add cache cleanup jobs
- Implement performance monitoring
- Fine-tune similarity thresholds
- Add cache hit/miss analytics

### **Phase 4: Extension** (Day 4)

- Extend to other command agents (SSH, Docker, etc.)
- Add advanced fuzzy matching
- Implement cache warming strategies
- Add admin dashboard for cache management

## 📊 **Expected Benefits**

- **⚡ 80%+ faster response** for repeated similar scenarios
- **💰 Reduced AI API costs** by avoiding redundant generations
- **🎮 Better game experience** with instant familiar command responses
- **📈 Scalable system** that improves with usage
- **🔧 Configurable caching** for different game scenarios

## 🧪 **Testing Strategy**

- Unit tests for state normalization logic
- Integration tests for cache hit/miss scenarios
- Performance benchmarks for cache lookup speed
- Game simulation tests with various state combinations
- Cache invalidation and cleanup testing

## 🔧 **Technical Implementation Details**

### **Game State Normalization Algorithm**

```typescript
function normalizeGameState(gameState: GameState): NormalizedGameState {
  return {
    room: gameState.currentRoom,
    healthCategory: categorizeHealth(gameState.health),
    threatLevel: gameState.threatLevel,
    activeThreatCount: gameState.enemies.filter(e =>
      e.location === gameState.currentRoom && !e.defeated
    ).length,
    playerExperience: categorizeSkillLevel(gameState.skillPoints)
  };
}

function categorizeHealth(health: number): string {
  if (health >= 70) return "healthy";
  if (health >= 30) return "wounded";
  return "critical";
}
```

### **Cache Key Generation**

```typescript
function generateCacheKey(
  command: string,
  target: string,
  normalizedState: NormalizedGameState
): string {
  const stateString = JSON.stringify(normalizedState, Object.keys(normalizedState).sort());
  return `${command}:${target}:${hashString(stateString)}`;
}
```

### **Similarity Scoring**

```typescript
function calculateSimilarity(state1: NormalizedGameState, state2: NormalizedGameState): number {
  let score = 0;
  let totalWeight = 0;

  // Room match (weight: 40%)
  if (state1.room === state2.room) score += 0.4;
  totalWeight += 0.4;

  // Health category (weight: 20%)
  if (state1.healthCategory === state2.healthCategory) score += 0.2;
  totalWeight += 0.2;

  // Threat count similarity (weight: 30%)
  const threatDiff = Math.abs(state1.activeThreatCount - state2.activeThreatCount);
  const threatSimilarity = Math.max(0, 1 - threatDiff / 5); // Allow up to 5 threat difference
  score += 0.3 * threatSimilarity;
  totalWeight += 0.3;

  // Threat level (weight: 10%)
  const levelDiff = Math.abs(state1.threatLevel - state2.threatLevel);
  const levelSimilarity = Math.max(0, 1 - levelDiff / 10); // Allow up to 10 level difference
  score += 0.1 * levelSimilarity;
  totalWeight += 0.1;

  return score / totalWeight;
}
```

## 🚀 **Future Enhancements**

### **Machine Learning Integration**

- **Pattern recognition**: Learn which cache hits are most valuable
- **Predictive caching**: Pre-generate likely command outputs
- **Dynamic similarity thresholds**: Adjust based on success rates

### **Advanced Features**

- **Contextual variations**: Different outputs based on player skill level
- **Seasonal/event caching**: Special responses for game events
- **Multi-language support**: Cache outputs in different languages
- **Voice synthesis caching**: Cache audio versions of text outputs

### **Analytics Dashboard**

- Real-time cache performance metrics
- Most popular command/room combinations
- Player-specific caching effectiveness
- Cost savings from reduced AI API calls

This comprehensive plan provides a robust foundation for implementing intelligent caching while maintaining the dynamic nature of the game experience.
