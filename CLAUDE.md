# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RogueNode is a Next.js + Convex + Clerk application combining two distinct experiences:
1. A DevOps/SRE text-based adventure game (terminal interface)
2. A visual service topology manager (ReactFlow-based canvas)

## Architecture

### Technology Stack
- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **Backend**: Convex (real-time database and serverless functions)
- **Authentication**: Clerk integration (partially configured)
- **Styling**: Tailwind CSS v4 with custom design system
- **UI Libraries**: @xyflow/react for visual topology, lucide-react for icons

### Key Components
- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components
- `convex/` - Backend functions, schema, and auth configuration
- `utils/` - Game logic, commands, and data structures

### Game Components
- `GameTerminal.tsx` - Main terminal interface with retro CRT styling
- `GameCommands.ts` - Command parser and game logic
- `GameData.ts` - Room definitions, items, enemies, and DevOps tools

### Visual Components  
- `ServiceNode.tsx` - Draggable service nodes for topology view
- `Canvas.tsx` - ReactFlow-based visual editor
- `ControlPanel.tsx` - Service creation toolbar

## Development Commands

### Package Management
Use `pnpm` for all package operations:
- `pnpm install` - Install dependencies
- `pnpm dev` - Start development (runs both frontend and backend)
- `pnpm dev:frontend` - Next.js dev server only
- `pnpm dev:backend` - Convex dev server only

### Build and Quality
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm start` - Start production server

### Convex Backend
- Convex automatically watches for changes and recompiles
- Do NOT run `npx convex dev` manually (it's handled by npm scripts)
- Dashboard available during development

## Code Architecture Patterns

### Convex Integration
Follow the established patterns in ARCHITECTURE.md:

**Server Components (Initial Load)**:
```typescript
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function Page() {
  const preloadedData = await preloadQuery(api.myFunctions.listNumbers, { count: 10 });
  return <ClientComponent preloadedData={preloadedData} />;
}
```

**Client Components (Real-time)**:
```typescript
"use client";
import { useQuery, usePreloadedQuery } from "convex/react";

export function ClientComponent({ preloadedData }) {
  const data = usePreloadedQuery(preloadedData);
  // Real-time updates automatically applied
}
```

### Function Naming Conventions
- Convex queries: `get*`, `list*` (e.g., `getUser`, `listNumbers`)
- Convex mutations: `add*`, `update*`, `delete*` (e.g., `addNumber`)
- Convex actions: `*Action` (e.g., `sendEmailAction`)

## Key Rules
1. **Never** put database queries directly in Next.js components
2. **Always** use Convex functions for data operations
3. **Prefer** Server Components with preloadQuery for initial data
4. **Use** Client Components with useQuery only when real-time updates needed
5. Use TypeScript strictly - avoid `any` types
6. Follow existing game command structure when adding new commands
7. Maintain retro terminal aesthetic for game components

## Current State
- Basic Convex setup with sample functions in `myFunctions.ts`
- Game terminal fully functional with navigation and DevOps tools
- Visual topology editor with drag-and-drop service creation
- Authentication configured but not fully integrated
- Components use mock data for demonstration

## Testing
- No test framework currently configured
- Verify functionality through browser testing at localhost:3000