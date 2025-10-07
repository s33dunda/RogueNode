---
ssot-area: convex-patterns
owner: backend-team
derived-from: convex-best-practices, implementation-stories
---

# Convex Backend Patterns

Reusable patterns for Convex backend development. These HOWTOs teach general principles that apply across all features, not just game-specific commands.

## Core Patterns

### **[Transaction Atomicity](./transaction-atomicity.md)** ⚠️ CRITICAL

**When to read**: Before implementing ANY mutation with multiple database operations

**Teaches**:

- Why `ctx.runMutation` breaks atomicity
- How to inline operations correctly
- Cost/latency impact of sub-transactions
- Real-world examples from cache hit optimization

**Canonical examples**:

- `convex/gameActions.ts:107-152` (cache hit path)
- `convex/gameActions.ts:432-449` (async finalization)

**Key Principle**: All operations within a Convex mutation must be inlined directly to ensure true atomicity. Using `ctx.runMutation` or `ctx.runQuery` within a mutation creates sub-transactions that break atomicity guarantees.

---

### **[Batch Operations](./batch-operations.md)** 🚀 Performance

**When to use**: Multiple items need the same operation, performance matters

**Teaches**:

- Reducing O(N) queries to O(1)
- Pure function extraction
- In-memory validation patterns
- Maintaining atomicity while optimizing

**Canonical example**: `convex/missions.ts:138-188` (Story 1.3)
**Derived from**: `docs/feature-requests/1.3.optimize-cache-hit-mission-validation.md`

**Key Pattern**: Single query → in-memory processing → sequential patches (all in same transaction)

---

## Usage in Player Actions

These patterns are referenced by game-specific HOWTOs:

- `docs/player-action-howtos/sync-commands.md`
- `docs/player-action-howtos/async-commands.md`
- `docs/player-action-howtos/ai-commands.md`

## SSOT Metadata

All files in this directory use:

```yaml
ssot-area: convex-patterns
owner: backend-team
derived-from: <source>
canonical-examples: <code references>
```

## Why Separate from Player Actions?

**`convex-howtos/`** = Backend infrastructure patterns (reusable across any feature)
**`player-action-howtos/`** = Game domain patterns (specific to terminal commands)

This separation enables:

- Backend engineers to learn Convex patterns without game context
- Reuse across admin features, analytics, and other non-game code
- Clear SSOT ownership (backend-team vs. game-systems-team)
- Better derivation chains (Convex principles → patterns → applications)

## Contributing

When extracting a new pattern from an implementation story:

1. Create HOWTO in this directory with proper metadata
2. Link to canonical code examples
3. Reference the source story in `derived-from:`
4. Update this README with the new pattern
5. Update `docs/ssot/README.md` if adding a new pattern category
