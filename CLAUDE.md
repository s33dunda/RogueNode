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

### Project Structure

- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components for both game and topology features
- `convex/` - Backend functions, schema, and auth configuration
- `utils/` - Game logic, commands, and data structures

### Game System Components

- `GameTerminal.tsx` - Main terminal interface with retro CRT styling and command processing
- `GameCommands.ts` - Command parser with command-line tools simulation
- `GameData.ts` - Complete game world: rooms, items, enemies, and educational command-line tools

### Visual Topology Components

- `Canvas.tsx` - ReactFlow-based drag-and-drop service topology editor
- `ServiceNode.tsx` - Custom node types with status indicators and deployment info
- `ControlPanel.tsx` - Draggable service creation toolbar
- `ChatSidebar.tsx` - Team collaboration features for topology discussions
- `VersionHistory.tsx` - Infrastructure change tracking

## Development Commands

### Package Management

Use `pnpm` for all package operations:

- `pnpm install` - Install dependencies
- `pnpm dev` - Start development (runs both frontend and backend in parallel)
- `pnpm dev:frontend` - Next.js dev server only (localhost:3000)
- `pnpm dev:backend` - Convex dev server only

### Build and Quality

- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm start` - Start production server

### Convex Backend

- Convex automatically watches for changes and recompiles
- Do NOT run `npx convex dev` manually (handled by `pnpm dev`)
- Dashboard available during development

## Code Architecture Patterns

### Convex Integration Requirements

Follow the Cursor rules in `.cursor/rules/convex_rules.mdc` for all Convex development:

**New Function Syntax (Required)**:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const exampleQuery = query({
  args: { count: v.number() },
  returns: v.array(v.object({ _id: v.id("tableName"), value: v.string() })),
  handler: async (ctx, args) => {
    // Function implementation
  },
});
```

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
- Always include argument and return validators for ALL functions
- Use `internalQuery`, `internalMutation`, `internalAction` for private functions

## Convex Paradigm Shifts

> Critical concepts that prevent common anti-patterns when moving from traditional databases to Convex

### 1. Transaction Boundaries & Atomicity

```typescript
// ❌ Sequential calls break atomicity
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const owner = await ctx.runQuery(internal.teams.getOwner, { teamId });

// ✅ Single transaction ensures consistency
const { team, owner } = await ctx.runQuery(internal.teams.getTeamWithOwner, { teamId });
```

### 2. Internal vs Public Security

```typescript
// ❌ Never use api.* for Convex-to-Convex calls
crons.daily("reminder", { hourUTC: 17 }, api.messages.send, { body: "Update!" });

// ✅ Always use internal.* for internal operations
crons.daily("reminder", { hourUTC: 17 }, internal.messages.sendInternal, { body: "Update!" });
```

### 3. Data Fetching Performance

```typescript
// ❌ Unbounded queries and memory filtering
const allMovies = await ctx.db.query("movies").collect();
const byDirector = allMovies.filter(m => m.director === "Spielberg");

// ✅ Use indexes and pagination
const byDirector = await ctx.db
  .query("movies")
  .withIndex("by_director", q => q.eq("director", "Spielberg"))
  .take(50);
```

### 4. Action Orchestration

```typescript
// ❌ Sequential mutations lose transaction guarantees
for (const member of teamMembers) {
  await ctx.runMutation(internal.teams.insertUser, member);
}

// ✅ Single mutation with batch operation
await ctx.runMutation(internal.teams.insertUsers, { users: teamMembers });
```

### 5. Authentication by Default

```typescript
// ❌ Missing auth check
export const getSecretData = query({
  handler: async (ctx) => {
    return { secret: "exposed!" }; // 🚨 No auth check
  },
});

// ✅ Always verify authentication
export const getSecretData = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");
    return { secret: "protected" };
  },
});
```

### 6. **TypeScript Type Safety with Convex Exports** ⭐

```typescript
// ❌ Using 'any' or 'unknown' for ANY Convex function
interface MyHookProps {
  executeAction: (args: any) => Promise<any>; // Type safety lost
  runQuery: (args: any) => Promise<any>; // Type safety lost
  runMutation: (args: any) => Promise<any>; // Type safety lost
}

// ✅ Use Convex's exported utility types for ALL function types
import type { FunctionReturnType, OptionalRestArgs } from "convex/server";
import type { api, internal } from "../convex/_generated/api";

// Extract exact types from generated API for ANY Convex function
type PingActionType = typeof api.agents.pingAgent.executePingCommand;
type CreateTaskMutationType = typeof api.tasks.createTask;  
type GetTasksQueryType = typeof api.tasks.getAllTasks;
type InternalHelperType = typeof internal.helpers.processData;

// Agent-related functions (workflows, threads, etc.)
type CreateThreadMutationType = typeof api.agents.support.createThread;
type WorkflowType = typeof api.workflows.supportWorkflow;

interface MyHookProps {
  // Actions
  executeAction: (...args: OptionalRestArgs<PingActionType>) => Promise<FunctionReturnType<PingActionType>>;
  
  // Mutations  
  createTask: (...args: OptionalRestArgs<CreateTaskMutationType>) => Promise<FunctionReturnType<CreateTaskMutationType>>;
  
  // Queries
  getTasks: (...args: OptionalRestArgs<GetTasksQueryType>) => Promise<FunctionReturnType<GetTasksQueryType>>;
  
  // Internal functions
  processData: (...args: OptionalRestArgs<InternalHelperType>) => Promise<FunctionReturnType<InternalHelperType>>;
  
  // Agent functions
  createThread: (...args: OptionalRestArgs<CreateThreadMutationType>) => Promise<FunctionReturnType<CreateThreadMutationType>>;
}
```

**Convex Function Types This Pattern Covers:**

- **Queries**: `query()` - Read-only database access
- **Mutations**: `mutation()` - Read/write database access  
- **Actions**: `action()` - Third-party APIs, no direct DB access
- **Internal Functions**: `internalQuery()`, `internalMutation()`, `internalAction()`
- **HTTP Actions**: `httpAction()` - HTTP endpoints
- **Agent Functions**: `agent.createThreadMutation()`, `agent.generateTextAction()`
- **Workflows**: `workflow.define()` - Multi-step orchestration
- **Crons**: `crons.interval()` - Scheduled functions

**Key Convex Type Utilities:**

- `FunctionReturnType<T>` - Extracts return type from ANY Convex function
- `OptionalRestArgs<T>` - Extracts parameter types with proper optional handling
- `typeof api.module.function` - Gets exact function reference type for public functions
- `typeof internal.module.function` - Gets exact function reference type for internal functions
- Never use `any` or overly broad `unknown` - Convex provides precise types for EVERYTHING!

## Convex Agent Paradigm Shifts

> Critical concepts for working with Convex's agent framework and AI orchestration

### 1. Thread-Centric State Management

```typescript
// ❌ Manual conversation state tracking
let conversationHistory = [];
conversationHistory.push({ role: "user", content: prompt });
const response = await llm.generate(conversationHistory);

// ✅ Thread-based persistent conversations
const { thread } = await agent.createThread(ctx, { userId });
const result = await thread.generateText({ prompt }); // History automatic

// ✅ Agent handoffs with shared context
const { thread } = await supportAgent.continueThread(ctx, { threadId });
const escalated = await managerAgent.continueThread(ctx, { threadId });
```

### 2. Tool-First Architecture

```typescript
// ❌ Direct function calls from agents
export const helpUser = action({
  handler: async (ctx, { question }) => {
    const answer = await lookupAnswer(question); // Direct call
    return answer;
  },
});

// ✅ Tool-based agent capabilities
const supportAgent = new Agent(components.agent, {
  tools: {
    lookupAnswer: tool({
      description: "Look up answers in knowledge base",
      parameters: z.object({ question: z.string() }),
      handler: async (ctx, { question }) => lookupAnswer(question),
    }),
    askHuman: tool({
      description: "Escalate to human agent",
      parameters: z.object({ issue: z.string() }),
    }),
  },
});
```

### 3. Context as First-Class Citizen

```typescript
// ❌ Only using recent message history
const result = await agent.generateText(ctx, { threadId }, { prompt });

// ✅ Rich context with search, memories, and related threads
const result = await agent.generateText(
  ctx,
  { threadId },
  { prompt },
  {
    contextHandler: async (ctx, args) => {
      const userMemories = await getUserMemories(ctx, args.userId);
      const relatedThreads = await getRelatedThreads(ctx, args.threadId);
      return [
        ...relatedThreads,
        ...args.search, // Vector/text search results
        ...userMemories,
        ...args.recent, // Recent conversation
        ...args.inputPrompt,
      ];
    },
  },
);
```

### 4. Agent Composition Patterns

```typescript
// ❌ Monolithic agent handling everything
const result = await megaAgent.generateText(ctx, { threadId }, {
  prompt: "Research topic, write report, and send email"
});

// ✅ Specialized agents with delegation
export const handleComplexTask = action({
  handler: async (ctx, { threadId, topic }) => {
    // Research specialist
    await researchAgent.generateText(ctx, { threadId }, {
      prompt: `Research ${topic}`
    });

    // Writing specialist (continues same thread)
    await writerAgent.generateText(ctx, { threadId }, {
      prompt: "Write a report based on the research"
    });

    // Communication specialist
    await emailAgent.generateText(ctx, { threadId }, {
      prompt: "Send the report via email"
    });
  },
});
```

### 5. Message Storage vs Generation

```typescript
// ❌ Confusion between storage and generation
await agent.generateText(ctx, { threadId }, {
  prompt: userInput // This will be stored automatically
});
// Manually storing what's already stored

// ✅ Explicit storage for non-LLM messages
// Human/system messages
await saveMessage(ctx, components.agent, {
  threadId,
  agentName: "Human",
  message: { role: "user", content: userInput },
});

// LLM generation (automatic storage)
const result = await agent.generateText(ctx, { threadId }, {
  prompt: "Respond to the user"
}); // Stores both prompt and response

// Tool call results (explicit storage)
await saveMessage(ctx, components.agent, {
  threadId,
  message: {
    role: "tool",
    content: [{ type: "tool-result", result: data, toolCallId }],
  },
});
```

## Key Rules

1. **Never** put database queries directly in Next.js components
2. **Always** use Convex functions for data operations
3. **Always** use new Convex function syntax with args/returns validators
4. **Prefer** Server Components with preloadQuery for initial data
5. **Use** Client Components with useQuery only when real-time updates needed
6. Use TypeScript strictly - avoid `any` types, use `Id<"tableName">` for document IDs
7. Follow existing game command structure when adding new commands
8. Maintain retro terminal aesthetic for game components
9. Use `pnpm` for all package operations
10. Never manually run `npx convex dev` - use `pnpm dev` instead

## Game System Architecture

### Command System

- `GameCommands.ts` contains the main `parseCommand` function
- Commands return `{ response: string[], newState?: GameState }`
- Game state includes: currentRoom, inventory, health, visited rooms, enemies
- command-line tools in `GameData.ts` provide educational command help

### Game Data Structure

- **Rooms**: Connected via exits (north/south/east/west)
- **Items**: Can be taken, used, examined; some required for enemy defeat
- **Enemies**: System problems requiring specific tools to fix
- **Tools**: Educational DevOps commands with syntax, examples, explanations

### Visual Topology System

- ReactFlow-based canvas with custom ServiceNode components
- Drag-and-drop service creation from ControlPanel
- Node status indicators: healthy (green), warning (yellow), error (red)
- Deployment status tracking and version history

## Current State

- Basic Convex setup with sample functions in `myFunctions.ts`
- Game terminal fully functional with complete adventure game mechanics
- Visual topology editor with drag-and-drop service creation
- Clerk authentication partially integrated (login/signup working)
- Mock data used for topology demonstrations
- Tailwind CSS v4 with custom design system for retro/modern hybrid styling

## Testing

- No test framework currently configured
- Verify functionality through browser testing at localhost:3000
- Game commands can be tested directly in terminal interface
- Topology features testable via drag-and-drop interactions
