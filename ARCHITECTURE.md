# Next.js + Convex + Clerk Architecture

## Clear Boundaries

### Next.js Responsibilities
- **Initial Data Loading**: Use `preloadQuery` in Server Components for SEO and fast initial renders
- **UI Components**: All components in `app/` and `components/` directories
- **Routing**: App Router handles all page routing and navigation
- **Static Assets**: Images, styles, and public files

### Convex Responsibilities  
- **Real-time Data**: Use `useQuery` for live data updates
- **Database Operations**: All queries, mutations, and actions in `convex/` directory
- **Authentication**: User identity and permissions
- **Backend Logic**: Business logic, validation, and data processing

## Naming Conventions

### Files
- Next.js pages: `app/**/{page,layout,loading,error}.tsx`
- UI components: `components/**/*.tsx`
- Convex functions: `convex/**/*.ts`

### Functions
- Convex queries: `get*`, `list*` (e.g., `getUser`, `listNumbers`)
- Convex mutations: `add*`, `update*`, `delete*` (e.g., `addNumber`, `updateUser`)
- Convex actions: `*Action` (e.g., `sendEmailAction`)

## Integration Patterns

### Server Components (Initial Load)
```typescript
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function Page() {
  const preloadedData = await preloadQuery(api.myFunctions.listNumbers, { count: 10 });
  return <ClientComponent preloadedData={preloadedData} />;
}
```

### Client Components (Real-time Updates)
```typescript
"use client";
import { useQuery, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ClientComponent({ preloadedData }) {
  const data = usePreloadedQuery(preloadedData);
  // Real-time updates automatically applied
}
```

## Key Rules
1. **Never** put database queries directly in Next.js components
2. **Always** use Convex functions for data operations
3. **Prefer** Server Components with preloadQuery for initial data
4. **Use** Client Components with useQuery only when real-time updates are needed