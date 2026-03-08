---
ssot-area: pddl-integration
owner: runtime-team
derived-from: planner-integration-plan
---

# PDDL Integration - Summary for Stakeholders

**Date**: 2025-10-03
**Status**: ✅ Ready for Development
**Effort**: 4-6 hours implementation

---

## What We're Building

A system that automatically validates player actions against AI-generated optimal solutions (PDDL plans), enabling:

1. **Automated Mission Validation**: Players get real-time feedback on whether their commands match the optimal solution
2. **Skill Progression**: Correct steps award skill points, incorrect steps provide hints
3. **Content Scalability**: Add new missions by editing data files and running a generator - no manual coding

---

## Documents Created

### 1. **Implementation Guide** (`pddl-integration-implementation.md`)

- **Audience**: Developer implementing the feature
- **Content**: Detailed code examples, function signatures, database schema
- **Length**: ~300 lines with complete TypeScript code

### 2. **Review Document** (`pddl-integration-review.md`)

- **Audience**: Technical reviewer / architect
- **Content**: Comparison of original plan vs. Convex-aligned refinements
- **Key Insights**: Anti-patterns avoided, best practices applied

### 3. **Quickstart Guide** (`pddl-integration-quickstart.md`)

- **Audience**: Developer starting implementation
- **Content**: Step-by-step checklist, testing instructions, troubleshooting
- **Format**: Quick reference card with time estimates

### 4. **Original POV Plan** (`pddl-game-integration-pov.md`)

- **Audience**: Product stakeholders
- **Content**: High-level feature overview, success criteria, out-of-scope items
- **Status**: Validated and refined (no changes to scope)

---

## Key Changes from Original Plan

### ✅ What Stayed the Same (Scope)

- Single source of truth for game data (`runtime.ts`)
- Missions include optimal plans from PDDL planner
- Real-time validation of player commands
- Skill point awards for correct steps
- POV scope: minimal, focused implementation

### 🔧 What Changed (Implementation Details)

1. **Added Database Schema**: `missionProgress` table for tracking player progress
2. **Separated Concerns**: Internal functions (logic) vs. public functions (auth)
3. **Type Safety**: Eliminated `v.any()`, added proper Convex validators
4. **Query Optimization**: Used indexed queries for performance
5. **Transaction Safety**: Batch operations for atomicity

**Why**: Align with Convex best practices for maintainability and performance

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│ convex/domainSpec/                                          │
│ ├── data.ts              (Mission definitions)              │
│ ├── schema.ts            (Zod validators)                   │
│ └── runtime.ts           (NEW: Shared runtime loader)       │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
┌──────────────────────────┐  ┌──────────────────────────┐
│ Convex Backend           │  │ Next.js Frontend         │
│ ├── missions.ts (NEW)    │  │ ├── GameData.ts          │
│ │   - Internal logic     │  │ │   - Uses runtime       │
│ ├── gameActions.ts       │  │ └── Components           │
│ │   - Public API         │  │     - Display progress   │
│ └── schema.ts            │  └──────────────────────────┘
│     - missionProgress    │
└──────────────────────────┘
```

---

## Implementation Steps (6 Steps)

| Step | File | Time | Risk | Description |
|------|------|------|------|-------------|
| 1 | `runtime.ts` | 30m | Low | Create shared runtime loader |
| 2 | `GameData.ts` | 15m | Low | Update to use runtime |
| 3 | `schema.ts` | 10m | Medium | Add `missionProgress` table |
| 4 | `missions.ts` | 2h | Medium | Internal mission logic |
| 5 | `gameActions.ts` | 1h | Low | Public API with auth |
| 6 | `gameActions.ts` | 1h | Low | Integrate validation |

**Total**: 4-6 hours (including testing)

---

## Testing Strategy

### Unit Tests

- Helper functions in `runtime.ts` (pure TypeScript)
- Command matching logic (`matchesStep`)

### Integration Tests

- Convex functions with test data
- Mission progress tracking
- Skill point awards

### E2E Tests

- Full mission flow: start → execute commands → complete
- Verify feedback messages
- Check database state

---

## Success Criteria

After implementation, the system should:

1. ✅ **Validate Commands**: Player runs `ping main-server` → sees mission feedback
2. ✅ **Track Progress**: `missionProgress` records created in database
3. ✅ **Award Points**: Correct steps increase skill points
4. ✅ **Provide Hints**: Incorrect steps show expected action
5. ✅ **Scale Content**: New missions added via `data.ts` + `pnpm planning:refresh`

---

## Risk Assessment

### Low Risk

- ✅ Pure TypeScript helpers (Step 1-2)
- ✅ Public API follows existing patterns (Step 5)
- ✅ Integration uses existing command flow (Step 6)

### Medium Risk

- ⚠️ Schema migration (Step 3) - test in dev first
- ⚠️ Internal functions (Step 4) - new Convex patterns

### Mitigation

- Incremental implementation (test each step)
- Convex dashboard for debugging
- Rollback plan: schema changes are additive (no breaking changes)

---

## POV Scope Boundaries

### ✅ In Scope (This Implementation)

- Single mission validation (`ping-tutorial`)
- Optimal plan checking
- Basic feedback (correct/incorrect)
- Skill point awards
- Database tracking

### ❌ Out of Scope (Future Enhancements)

- Multi-path solutions (only optimal plan validated)
- Partial credit for near-miss commands
- Advanced hint system
- Visual progress UI components
- Leaderboards / analytics

---

## Developer Handoff

### Required Knowledge

- TypeScript (intermediate)
- Convex basics (queries, mutations, schema)
- React (for future UI work)

### Getting Started

1. Read `pddl-integration-quickstart.md` (5 min)
2. Review `pddl-integration-implementation.md` (15 min)
3. Start with Step 1 (lowest risk)
4. Test each step before proceeding

### Support Resources

- **Convex Docs**: Use Context7 MCP tool (`llmstxt/convex_dev_llms_txt`)
- **Implementation Guide**: Complete code examples
- **Review Document**: Best practices and anti-patterns

---

## Timeline

### Phase 1: Core Implementation (4-6 hours)

- Steps 1-6 from quickstart guide
- Basic testing and validation

### Phase 2: Testing & Refinement (2-3 hours)

- E2E testing with real game flow
- Bug fixes and edge cases
- Documentation updates

### Phase 3: Content Expansion (ongoing)

- Add more missions to `data.ts`
- Run `pnpm planning:refresh`
- Test new mission flows

**Total**: ~1 day for complete POV implementation

---

## Next Steps

1. **Developer**: Review `pddl-integration-quickstart.md` and start Step 1
2. **Reviewer**: Check `pddl-integration-review.md` for architecture decisions
3. **Stakeholder**: Approve scope and timeline

---

## Questions?

- **Technical**: See `pddl-integration-implementation.md` for detailed code
- **Architecture**: See `pddl-integration-review.md` for design decisions
- **Process**: See `pddl-integration-quickstart.md` for step-by-step guide

---

## Approval Checklist

- [ ] Scope aligns with POV goals (minimal, focused)
- [ ] Timeline acceptable (4-6 hours core implementation)
- [ ] Risk level acceptable (low-medium, incremental approach)
- [ ] Documentation sufficient for developer handoff
- [ ] Testing strategy covers critical paths
- [ ] Future enhancements clearly deferred

**Status**: ✅ Ready for Development

**Approved By**: _________________
**Date**: _________________
