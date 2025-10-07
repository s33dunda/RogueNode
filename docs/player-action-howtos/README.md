---
ssot-area: player-actions
owner: game-systems-team
derived-from: documentation-index-template
---

# Player Action Implementation HOWTOs

This directory collects task-focused guides for the different ways players interact with RogueNode's terminal. Each HOWTO highlights the Convex entry points, supporting utilities, and development checklists so new features can follow established patterns with minimal guesswork.

## Command Implementation Patterns

- [Synchronous Commands](./sync-commands.md) — Immediate responses handled completely inside the `sendCommand` mutation.
- [Async Commands](./async-commands.md) — Deferred operations that schedule background work before replying to the player.
- [AI-Driven Commands](./ai-commands.md) — Agent-backed command flows that integrate caching, threading, and mission validation.

## Backend Patterns

These player action HOWTOs reference general Convex backend patterns:

- **[Transaction Atomicity](../convex-howtos/transaction-atomicity.md)** — **CRITICAL**: How to ensure true atomicity in mutations. This is a core Convex pattern that applies to all backend development. Required reading before implementing any command with multiple database operations.
- **[Batch Operations](../convex-howtos/batch-operations.md)** — Performance optimization pattern for processing multiple items efficiently while maintaining atomicity.

See `docs/convex-howtos/` for all backend patterns.

## Getting Started

Start with the guide that matches the behavior you need, then cross-reference the others for any shared utilities or follow-up steps (such as mission hooks or caching updates).

**⚠️ Important**: All command implementations with multiple database operations must follow the transaction atomicity guidelines to ensure data consistency and optimal performance.
