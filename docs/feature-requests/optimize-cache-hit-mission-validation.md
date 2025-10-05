---
ssot-area: runtime-performance
owner: runtime-team
derived-from: docs/feature-requests/combine-mission-feedback-with-output.md
status: aligned-with-best-practices
last-reviewed: 2025-01-05
---

# Story: Optimize Cache Hit Mission Validation Performance

## 📋 Story Overview

**Status**: 📋 Backlog
**Priority**: P2 - Medium
**Effort**: Medium (2-3 days)
**Type**: Performance Optimization

> **✅ ALIGNED**: This optimization maintains transaction atomicity. All operations remain inlined within the parent mutation as documented in `docs/player-action-howtos/transaction-atomicity.md`.

### Problem Statement

On every cache hit, the system runs mission validation (query + mutation) even though the command output is cached. This results in O(N) database operations where N = number of active missions.

**Current Performance**:

- 0 missions: ~4 DB operations, 50-100ms
- 1-2 missions: ~6-8 DB operations, 100-200ms
- 10 missions: ~24 DB operations, 300-500ms

### Why This Matters

1. **User Experience**: Cache hits should be instant, but can take 300-500ms with many missions
2. **Scalability**: Performance degrades linearly with mission count
3. **Database Load**: Unnecessary queries/mutations on cache hits

### Why Mission Validation Can't Be Cached

Mission validation state **cannot** be cached because:

1. Mission progress is independent of game state (room, health, threats)
2. Mission validation has side effects (updates progress, awards points)
3. Same command can advance different missions at different times
4. Would require complex invalidation logic

**Current behavior is correct by design** - this story is about optimization, not fixing a bug.

### Design Principle: Minimize Cache Hit Side Effects

**Current cache hit operations** (`gameActions.ts:106-142`):

1. ✅ Mission validation - NECESSARY (game progression)
2. ✅ Terminal output insert - NECESSARY (player sees output)
3. ✅ Game state update - NECESSARY (skill points, session)
4. ⚠️ Cache hit counter - DEBATABLE (analytics only)

**Question**: Should we even increment the cache hit counter? It's a side effect that adds a mutation to every cache hit purely for analytics. Consider removing or making async.

---

## 🎯 Acceptance Criteria

- [ ] Cache hit latency reduced by 50% when 5+ missions are active
- [ ] Database operations reduced from O(N) to O(1) for mission validation
- [ ] All existing mission validation tests pass
- [ ] No regression in mission progression correctness
- [ ] Performance benchmarks documented

---

## 💡 Proposed Solution

### Option 1: Batch Mission Validation (Recommended)

> **✅ ATOMICITY COMPLIANT**: This optimization maintains atomicity by keeping all operations within the parent mutation. No `ctx.runMutation` calls are introduced.

**Current Implementation** (`convex/missions.ts:218-250`):

```typescript
// ✅ CORRECT - Already atomic (inline operations)
// N separate queries + N separate patches within same transaction
for (const missionId of missionIds) {
  const result = await validateMissionStepInternal(ctx, playerId, missionId, playerCommand);
}
```

**Optimized Implementation**:

```typescript
// ✅ CORRECT - Still atomic, just more efficient
// Single query + batch patch within same transaction
const allProgress = await ctx.db
  .query("missionProgress")
  .withIndex("by_player_status", (q) =>
    q.eq("playerId", playerId).eq("status", "in_progress"),
  )
  .collect();

// Validate all in memory (no DB operations)
const updates = allProgress.map(progress =>
  validateAndPrepareUpdate(progress, playerCommand)
);

// Single batch operation (still in same transaction)
await ctx.db.batchPatch(updates);
```

**Benefits**:

- ✅ Maintains true atomicity (all operations in same transaction)
- Reduces N queries to 1 query
- Reduces N patches to 1 batch operation
- Better Convex transaction semantics
- Maintains correctness

**Effort**: Medium - Requires refactoring `validateMissionStepInternal`

**Key Principle**: This is a **performance optimization within an atomic transaction**, not a change to transaction boundaries. All operations remain inline within the parent mutation.

---

## 🔧 Implementation Plan

### Phase 1: Refactor Validation Logic (Day 1)

1. **Extract pure validation function**
   - Create `checkMissionStep(progress, command)` - no DB access
   - Returns validation result without side effects
   - Unit testable

2. **Create batch validation function**
   - `validateAllMissionsInBatch(ctx, playerId, command)`
   - Single query for all active missions
   - Validate all in memory
   - Single batch patch

3. **Update tests**
   - Add tests for batch validation
   - Ensure correctness maintained

### Phase 2: Integration (Day 2)

1. **Update `collectMissionFeedback`** (`convex/gameActions.ts:540`)
   - Replace loop with batch validation call
   - Maintain same return signature

2. **Add performance logging**
   - Log operation count before/after
   - Track latency improvements

3. **Integration testing**
   - Test with 0, 1, 5, 10 active missions
   - Verify mission progression still works
   - Check cache hit performance

### Phase 3: Benchmarking (Day 3)

1. **Performance benchmarks**
   - Measure cache hit latency with varying mission counts
   - Compare before/after metrics
   - Document improvements

2. **Load testing**
   - Simulate 100 concurrent players
   - Monitor database operation counts
   - Identify any remaining bottlenecks

3. **Documentation**
   - Update implementation notes
   - Document performance characteristics

---

## 📊 Expected Impact

### Performance Improvements

| Active Missions | Current Ops | Optimized Ops | Latency Improvement |
|----------------|-------------|---------------|---------------------|
| 0              | 4           | 4             | 0% (already fast)   |
| 1              | 6           | 5             | ~15%                |
| 2              | 8           | 5             | ~40%                |
| 5              | 14          | 5             | ~65%                |
| 10             | 24          | 5             | ~80%                |

### Database Load Reduction

- **Before**: 1 + N queries, 2 + N mutations per cache hit
- **After**: 2 queries, 3 mutations per cache hit (constant)
- **Savings**: O(N) → O(1) scaling

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe("Batch Mission Validation", () => {
  it("validates multiple missions in single transaction", async () => {
    // Setup: 3 active missions
    // Execute: batch validation
    // Assert: all missions updated correctly
  });

  it("handles no active missions efficiently", async () => {
    // Assert: early return, no DB operations
  });

  it("maintains correctness with mixed match/no-match", async () => {
    // Setup: 5 missions, 2 match, 3 don't
    // Assert: only matching missions advance
  });
});
```

### Integration Tests

```typescript
describe("Cache Hit Performance", () => {
  it("completes cache hit in <100ms with 5 missions", async () => {
    // Setup: 5 active missions, cached command
    // Execute: cache hit
    // Assert: latency < 100ms
  });
});
```

### Performance Benchmarks

- Measure cache hit latency: 0, 1, 2, 5, 10, 20 missions
- Compare against baseline (current implementation)
- Document in `docs/performance/benchmarks.md`

---

## 🚧 Risks & Mitigations

### Risk 1: Batch Operation Complexity

**Risk**: Batch validation logic more complex than sequential
**Mitigation**: Extensive unit tests, code review, gradual rollout

### Risk 2: Transaction Semantics

**Risk**: Batch operation might have different failure modes
**Mitigation**: Test error cases, ensure atomicity maintained

### Risk 3: Regression in Mission Progression

**Risk**: Refactoring breaks mission advancement logic
**Mitigation**: Comprehensive integration tests, manual QA

---

## 📚 Technical Context

### Current Implementation

- **Cache Hit Path**: `convex/gameActions.ts:106-142`
- **Mission Validation**: `convex/missions.ts:15-103`
- **Cache Key Generation**: `convex/utils/cacheUtils.ts:25-44`

### Key Insight

Cache key includes: `room`, `healthCategory`, `threatLevel`, `activeThreatCount`
Cache key does NOT include: mission state

This is why mission validation must run on every cache hit - mission progress changes independently of game state.

---

## 🔮 Future Enhancements (Out of Scope)

### Option 2: Command-Mission Matching Index

Pre-filter missions that could match the command:

```typescript
// Add to schema
missionProgress: defineTable({
  expectedCommands: v.array(v.string()), // ["ping", "ssh"]
}).index("by_player_command", ["playerId", "expectedCommands"])
```

**Benefits**: Only validate relevant missions (M << N)
**Effort**: High - Requires schema changes, mission metadata updates

### Option 3: Mission Count Limit

Limit concurrent active missions to 5 per player.

**Benefits**: Caps worst-case performance
**Effort**: Low - Product decision + validation logic

---

## ✅ Definition of Done

- [ ] Batch validation implemented and tested
- [ ] All existing tests pass
- [ ] Performance benchmarks show 50%+ improvement for 5+ missions
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Deployed to production
- [ ] Performance metrics monitored for 1 week

---

## 📝 Related Documents

**Transaction Atomicity**:

- `docs/player-action-howtos/transaction-atomicity.md` - Transaction atomicity best practices (CRITICAL)
- **CLAUDE.md:123-131** - Transaction Boundaries & Atomicity
- **CLAUDE.md:161-167** - Action Orchestration

**Implementation References**:

- `convex/gameActions.ts:106-164` - Cache hit path implementation
- `convex/missions.ts:218-250` - Current mission validation
- `docs/feature-requests/atomic-cache-hit-mutation.md` - Atomic cache hit pattern
- `docs/feature-requests/command-cache-implementation-plan.md` - Cache design
- `docs/player-action-howtos/ai-commands.md` - AI command implementation guide

---

**Created**: 2025-01-04
**Last Updated**: 2025-01-05
**Owner**: Backend Team
