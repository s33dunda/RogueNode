# Server-Side Game State Refactor Requirements

## Executive Summary

This document outlines the technical requirements and implementation strategy for migrating RogueNode's game state management from client-side to server-side architecture to address critical security vulnerabilities.

## Current Architecture Problems

### Client-Side State Management Issues

- **Security**: Complete game state stored and managed in browser
- **Persistence**: State lost on page refresh
- **Validation**: No server-side business logic enforcement
- **Integrity**: No protection against state manipulation
- **Scalability**: Cannot support multi-session or cross-device gameplay

### Impact on Core Features

- **Command Caching**: Cache keys based on client-provided game state
- **AI Agent Integration**: Thread context relies on unvalidated state
- **Progress Tracking**: No authoritative record of user advancement
- **Tool Usage Analytics**: Data integrity compromised

## Target Architecture

### Server-Side State Authority

```shell
Frontend (React) ←→ Convex Actions/Mutations ←→ Convex Database
    ↓ UI State Only        ↓ Game Logic             ↓ Authoritative State
    - Input handling       - State validation       - Game sessions
    - Display updates      - Business rules         - Player progress
    - UI feedback          - Command processing     - Tool usage logs
```

### State Ownership Model

- **Server**: Authoritative game state, validation, persistence
- **Client**: UI state, input handling, optimistic updates
- **Sync**: Real-time updates via Convex subscriptions

## Database Schema Changes

### New Tables Required

#### Game Sessions Table

```typescript
gameSessions: defineTable({
  playerId: v.string(),           // Clerk user ID
  sessionId: v.string(),          // Unique session identifier
  currentRoom: v.string(),        // Current room ID
  health: v.number(),             // Player health (0-100)
  inventory: v.array(v.string()), // Item IDs in inventory
  visitedRooms: v.array(v.string()), // Rooms explored
  skillPoints: v.number(),        // Accumulated skill points
  threatLevel: v.number(),        // Current threat level
  gameOver: v.boolean(),          // Game completion status
  lastActivity: v.number(),       // Timestamp of last action
  createdAt: v.number(),          // Session creation time
  metadata: v.object({            // Additional game context
    toolSessionId: v.optional(v.string()),
    achievements: v.optional(v.array(v.string())),
  })
})
.index("by_player", ["playerId"])
.index("by_session", ["sessionId"])
.index("by_activity", ["lastActivity"])
```

#### Player Progress Table

```typescript
playerProgress: defineTable({
  playerId: v.string(),           // Clerk user ID
  totalSessions: v.number(),      // Number of games played
  highestSkillPoints: v.number(), // Best performance
  roomsDiscovered: v.array(v.string()), // All rooms ever visited
  itemsCollected: v.array(v.string()),  // All items ever found
  enemiesDefeated: v.array(v.string()), // All threats overcome
  toolsProficiency: v.object({    // Command-line tool mastery
    ping: v.number(),             // Usage count and success rate
    ssh: v.number(),
    grep: v.number(),
    // ... other tools
  }),
  lastPlayed: v.number(),         // Most recent session
})
.index("by_player", ["playerId"])
.index("by_last_played", ["lastPlayed"])
```

#### Game State History (Audit Trail)

```typescript
gameStateHistory: defineTable({
  sessionId: v.string(),          // Associated game session
  playerId: v.string(),           // Player who made change
  action: v.string(),             // Command or action taken
  previousState: v.any(),         // State before change
  newState: v.any(),              // State after change
  timestamp: v.number(),          // When change occurred
  context: v.object({             // Additional context
    room: v.string(),             // Where action occurred
    target: v.optional(v.string()), // Target of action
    success: v.boolean(),         // Whether action succeeded
  }),
})
.index("by_session", ["sessionId"])
.index("by_player_time", ["playerId", "timestamp"])
```

## API Design

### Mutations (State Changes)

```typescript
// Create new game session
export const startGameSession = mutation({
  args: {},
  returns: v.object({
    sessionId: v.string(),
    gameState: gameStateValidator,
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    // Initialize new game session with default state
  }
});

// Execute game command with state validation
export const executeGameCommand = mutation({
  args: {
    sessionId: v.string(),
    command: v.string(),
    target: v.optional(v.string()),
  },
  returns: commandResult,
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    // Validate session ownership
    // Execute command with server-side validation
    // Update game state atomically
    // Return result with new state
  }
});

// Move player to new room (with validation)
export const movePlayer = mutation({
  args: {
    sessionId: v.string(),
    direction: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    newState: gameStateValidator,
    message: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // Validate movement is legal
    // Check room connections
    // Update player location
    // Trigger room entry events
  }
});
```

### Queries (State Access)

```typescript
// Get current game session
export const getCurrentGameSession = query({
  args: { sessionId: v.string() },
  returns: v.union(v.null(), gameSessionValidator),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    // Validate session ownership
    // Return current game state
  }
});

// Get player progress summary
export const getPlayerProgress = query({
  args: {},
  returns: playerProgressValidator,
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    // Return player's overall progress
  }
});
```

### Actions (External Integrations)

```typescript
// Execute AI agent commands with server state
export const executeAICommand = action({
  args: {
    sessionId: v.string(),
    command: v.string(),
    target: v.string(),
  },
  returns: commandResult,
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Get current game state from server
    const session = await ctx.runQuery(internal.game.getSession, {
      sessionId: args.sessionId,
      playerId: identity.subject,
    });

    // Execute AI agent with validated state
    // Update state via mutation
    // Return result
  }
});
```

## Migration Strategy

### Phase 1: Database Schema Setup (Week 1)

- [ ] Add new tables to `convex/schema.ts`
- [ ] Create migration utilities for existing users
- [ ] Deploy database changes
- [ ] Test with development data

### Phase 2: Server-Side API Development (Week 2-3)

- [ ] Implement core mutations for state management
- [ ] Add queries for state access
- [ ] Create validation functions for all state transitions
- [ ] Add comprehensive error handling

### Phase 3: Client-Side Integration (Week 3-4)

- [ ] Refactor `GameTerminal.tsx` to use server state
- [ ] Replace local state with Convex subscriptions
- [ ] Add optimistic updates for better UX
- [ ] Handle offline/connectivity scenarios

### Phase 4: AI Agent Integration (Week 4)

- [ ] Update ping agent to use server-side state
- [ ] Modify cache utilities for validated state
- [ ] Update all command processors
- [ ] Test AI agent thread management

### Phase 5: Testing & Validation (Week 5)

- [ ] Unit tests for all mutations and queries
- [ ] Integration tests for game scenarios
- [ ] Security testing for state manipulation attempts
- [ ] Performance testing under load

### Phase 6: Deployment & Monitoring (Week 6)

- [ ] Staged rollout to production
- [ ] Monitor for errors and performance issues
- [ ] User acceptance testing
- [ ] Documentation updates

## Breaking Changes

### Frontend Component Changes

- `GameTerminal.tsx`: Remove local state management
- `useCommandProcessor.ts`: Use server mutations instead of local logic
- Game data structures: Server-provided instead of local imports

### API Changes

- All game commands become async operations
- State updates require network round-trips
- Real-time updates via Convex subscriptions
- Error handling for network failures

### Cache System Changes

- Cache keys validated against server state
- Cache storage includes session validation
- Cleanup processes account for session expiry

## Backward Compatibility

### User Experience Preservation

- Maintain existing command syntax
- Preserve game progression (migrate existing progress)
- Keep identical UI/UX during transition
- Graceful fallback for network issues

### Data Migration

```typescript
// Migration utility to preserve existing progress
export const migrateClientStateToServer = action({
  args: {
    clientGameState: gameStateValidator,
    preserveProgress: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Create server session from client state
    // Preserve legitimate progress
    // Validate state integrity
    // Return new session ID
  }
});
```

## Performance Considerations

### Network Optimization

- Batch state updates where possible
- Use optimistic updates for immediate feedback
- Implement state delta updates (not full state)
- Cache frequently accessed read-only data

### Database Performance

- Index all query patterns
- Use pagination for large datasets
- Implement proper query optimization
- Monitor database performance metrics

### Real-Time Updates

- Use Convex subscriptions efficiently
- Minimize subscription scope to reduce bandwidth
- Implement reconnection logic
- Handle concurrent state changes

## Security Enhancements

### Input Validation

- Validate all command parameters server-side
- Sanitize all user input
- Rate limit command execution
- Implement CSRF protection

### Authorization

- Verify session ownership on every request
- Implement role-based access where needed
- Log all state-changing operations
- Add admin controls for monitoring

### Audit Trail

- Track all game state changes
- Include context for each action
- Enable forensic analysis of suspicious activity
- Implement retention policies

## Testing Strategy

### Unit Tests

- All mutations and queries
- State validation functions
- Business logic components
- Error handling scenarios

### Integration Tests

- End-to-end game scenarios
- Multi-user session management
- AI agent integration
- Cache system integration

### Security Tests

- State manipulation attempts
- Session hijacking prevention
- Input validation bypass attempts
- Authorization boundary testing

### Performance Tests

- Concurrent user load testing
- Database query performance
- Real-time update scalability
- Network failure recovery

## Rollback Plan

### Immediate Rollback Triggers

- Critical security vulnerabilities discovered
- Significant performance degradation
- Data corruption or loss
- User experience severely impacted

### Rollback Procedure

1. Disable new server-side features
2. Restore client-side state management
3. Migrate critical user data back
4. Restore previous deployment
5. Investigate and address issues
6. Plan corrective actions

## Success Metrics

### Security Goals

- [ ] Zero client-side state manipulation possible
- [ ] Complete audit trail for all game actions
- [ ] Server-side validation for all state changes
- [ ] Authenticated access to all game functions

### Performance Goals

- [ ] <200ms response time for game commands
- [ ] Support 1000+ concurrent users
- [ ] 99.9% uptime for game sessions
- [ ] Zero data loss during state transitions

### User Experience Goals

- [ ] Identical gameplay experience
- [ ] Progress preserved across sessions
- [ ] Seamless offline/online transitions
- [ ] No additional user friction

## Resource Requirements

### Development Time

- **Estimated effort**: 6 weeks (1 senior developer)
- **Critical path**: Database design → API development → Frontend integration
- **Risk factors**: AI agent integration complexity, real-time state synchronization

### Infrastructure

- **Database**: Additional Convex tables and indexes
- **Compute**: Increased server-side processing
- **Network**: Real-time subscription overhead
- **Monitoring**: Enhanced logging and analytics

## Conclusion

This refactor represents a fundamental architectural shift from client-trust to server-authority model. While complex, it's essential for game integrity, user trust, and long-term scalability.

The phased approach minimizes risk while ensuring thorough testing at each stage. The success of this refactor will establish a secure foundation for future RogueNode features and educational content.
