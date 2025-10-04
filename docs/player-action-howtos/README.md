---
ssot-area: player-actions
owner: game-systems-team
derived-from: documentation-index-template
---

# Player Action Implementation HOWTOs

This directory collects task-focused guides for the different ways players interact with RogueNode's terminal. Each HOWTO highlights the Convex entry points, supporting utilities, and development checklists so new features can follow established patterns with minimal guesswork.

- [Synchronous Commands](./sync-commands.md) — Immediate responses handled completely inside the `sendCommand` mutation.
- [Async Commands](./async-commands.md) — Deferred operations that schedule background work before replying to the player.
- [AI-Driven Commands](./ai-commands.md) — Agent-backed command flows that integrate caching, threading, and mission validation.

Start with the guide that matches the behavior you need, then cross-reference the others for any shared utilities or follow-up steps (such as mission hooks or caching updates).
