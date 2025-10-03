---
ssot-area: pddl-integration
owner: runtime-team
derived-from: planner-integration-plan
---

# PDDL Integration Documentation

**Last Updated**: 2025-10-03
**Status**: ✅ Ready for Implementation

---

## 🎯 Quick Navigation

### For Developers (Implementation)

👉 **START HERE**: [Quickstart Guide](./pddl-integration-quickstart.md)

- 6 steps, 4-6 hours total
- Step-by-step checklist with code snippets
- Testing instructions and troubleshooting

### For Architects (Technical Review)

📐 [Implementation Guide](./pddl-integration-implementation.md)

- Complete code examples
- Database schema
- Function signatures and validators

📋 [Review Document](./pddl-integration-review.md)

- Convex best practices analysis
- Anti-patterns avoided
- Original plan vs. refined implementation

### For Stakeholders (Overview)

📊 [Summary Document](./pddl-integration-summary.md)

- Executive overview
- Timeline and effort estimates
- Risk assessment
- Approval checklist

### Original Plan

📝 [POV Plan](./pddl-game-integration-pov.md)

- High-level feature overview
- Success criteria
- Out-of-scope items

---

## 📖 What This Is

A system that automatically validates player actions against AI-generated optimal solutions (PDDL plans).

**Example Flow**:

1. Player starts mission: "Bring the server online"
2. PDDL planner generates optimal solution: `["ping main-server"]`
3. Player runs command: `ping main-server`
4. System validates: ✅ Correct! Awards skill points
5. Player runs wrong command: `ssh main-server`
6. System provides hint: ❌ Expected: `ping main-server`

---

## 🏗️ Architecture

```text
packages/domain-spec/
├── data.ts              # Mission definitions
├── schema.ts            # Zod validators
└── runtime.ts           # NEW: Shared runtime loader
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
        Convex Backend          Next.js Frontend
        ├── missions.ts         ├── GameData.ts
        │   (Internal logic)    │   (Uses runtime)
        ├── gameActions.ts      └── Components
        │   (Public API)            (Display progress)
        └── schema.ts
            (missionProgress)
```

---

## 🚀 Implementation Steps

| # | File | Time | Description |
|---|------|------|-------------|
| 1 | `runtime.ts` | 30m | Create shared runtime loader |
| 2 | `GameData.ts` | 15m | Update to use runtime |
| 3 | `schema.ts` | 10m | Add `missionProgress` table |
| 4 | `missions.ts` | 2h | Internal mission logic |
| 5 | `gameActions.ts` | 1h | Public API with auth |
| 6 | `gameActions.ts` | 1h | Integrate validation |

**Total**: 4-6 hours (including testing)

---

## ✅ Success Criteria

After implementation:

- ✅ Player runs `ping main-server` → sees mission feedback
- ✅ `missionProgress` records created in database
- ✅ Correct steps increase skill points
- ✅ Incorrect steps show hints
- ✅ New missions added via `data.ts` + `pnpm planning:refresh`

---

## 📋 POV Scope

### ✅ In Scope

- Single mission validation (`ping-tutorial`)
- Optimal plan checking
- Basic feedback (correct/incorrect)
- Skill point awards

### ❌ Out of Scope (Future)

- Multi-path solutions
- Partial credit for near-miss commands
- Advanced hint system
- Visual progress UI
- Leaderboards

---

## 🧪 Testing

### Quick Test (After Implementation)

```bash
# 1. Start game
pnpm dev

# 2. In game terminal:
> ping main-server

# 3. Expected output:
✓ Correct! Auto-generated step: ping main-server
Next step: Mission complete! Well done.
[+10 skill points]

# 4. Check Convex dashboard:
# - missionProgress table has new record
# - status: "completed"
# - skillPoints increased
```

---

## 🔧 Key Technologies

- **PDDL**: Planning Domain Definition Language (AI planning)
- **Convex**: Backend database and serverless functions
- **Zod**: TypeScript schema validation
- **Next.js**: Frontend framework

---

## 📚 Related Documentation

### Convex Best Practices

Use Context7 MCP tool to search: `llmstxt/convex_dev_llms_txt`

Key patterns used:

- Helper functions first (logic in `runtime.ts`)
- Internal functions for Convex-to-Convex calls
- Public functions for auth-protected API
- Indexed queries for performance
- Batch operations for atomicity

### PDDL Planning

- Domain files: `packages/domain-spec/generated/domains/`
- Problem files: `packages/domain-spec/generated/problems/`
- Plan JSON: `packages/domain-spec/generated/problems/*/plan.json`

---

## 🆘 Troubleshooting

### Issue: Import errors in Convex

**Fix**: Check `convex/tsconfig.json` paths configuration

### Issue: Schema validation errors

**Fix**: Verify status values match schema union exactly

### Issue: Mission not found

**Fix**: Check mission ID in `data.ts` matches exactly

**Full troubleshooting guide**: See [Quickstart](./pddl-integration-quickstart.md) → "Common Issues"

---

## 🎓 Learning Resources

### For Developers New to Convex

1. Read [Convex Docs](https://docs.convex.dev/understanding)
2. Review [Review Document](./pddl-integration-review.md) → "Convex Anti-Patterns Avoided"
3. Study existing code in `convex/gameActions.ts`

### For Developers New to PDDL

1. Review `packages/domain-spec/generated/domains/*.pddl`
2. Check `packages/domain-spec/generated/problems/*/problem.pddl`
3. Understand plan JSON structure in `plan.json` files

---

## 📊 Timeline

### Phase 1: Core Implementation (4-6 hours)

- Steps 1-6 from quickstart
- Basic testing

### Phase 2: Testing & Refinement (2-3 hours)

- E2E testing
- Bug fixes
- Documentation updates

### Phase 3: Content Expansion (ongoing)

- Add more missions
- Run `pnpm planning:refresh`
- Test new flows

**Total**: ~1 day for complete POV

---

## 🤝 Contributing

### Adding New Missions

1. Edit `packages/domain-spec/data.ts`
2. Add mission object with `optimalPlan` and `problemRef`
3. Run `pnpm planning:refresh` to generate plan JSON
4. Test mission flow in game

### Modifying Validation Logic

1. Update `packages/domain-spec/runtime.ts` → `matchesStep` function
2. Test with existing missions
3. Update tests if needed

---

## 📝 Document History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-03 | 1.0 | Initial POV plan |
| 2025-10-03 | 2.0 | Reviewed against Convex best practices |
| 2025-10-03 | 2.1 | Added detailed implementation guides |

---

## ✅ Approval Status

- [x] POV scope defined
- [x] Convex best practices reviewed
- [x] Implementation guide created
- [x] Testing strategy defined
- [x] Documentation complete
- [ ] Developer assigned
- [ ] Implementation started
- [ ] Testing complete
- [ ] POV deployed

---

## 📞 Contact

**Questions about**:

- **Implementation**: See [Quickstart Guide](./pddl-integration-quickstart.md)
- **Architecture**: See [Review Document](./pddl-integration-review.md)
- **Scope**: See [Summary Document](./pddl-integration-summary.md)

---

**Ready to start?** → [Quickstart Guide](./pddl-integration-quickstart.md)
