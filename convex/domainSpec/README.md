# Domain Spec - Consolidated Backend Schema

## Overview

This directory contains the **authoritative source** for all game domain logic, mission definitions, PDDL artifacts, and runtime utilities used by Convex backend functions.

**Why in convex/?** This is the consolidated, security-hardened schema location. All backend code imports directly from here.

## Files

- `data.ts` - Game data (rooms, enemies, missions, tools)
- `schema.ts` - Zod validators and TypeScript types
- `runtime.ts` - Runtime utilities (getMissionById, matchesStep, etc.)
- `index.ts` - Barrel exports
- `pddl/` - PDDL planning artifacts

## Architecture

```shell
convex/domainSpec/             # Single source of truth
├── data.ts                    # Game domain definitions
├── schema.ts                  # Type validators
├── runtime.ts                 # Runtime helpers
├── index.ts                   # Barrel exports
└── pddl/                      # PDDL planning artifacts
    └── problems/
```

All Convex functions import from this location:

```typescript
import { getMissionById } from "./domainSpec/runtime";
import { missions } from "./domainSpec/data";
```
