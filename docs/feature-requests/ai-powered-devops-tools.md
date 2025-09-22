# Feature Request: AI-Powered Command-Line Tool Simulation

## Problem Statement

Currently, RogueNode's DevOps education game uses static, generic responses for command-line tool commands like `ping`, `ssh`, `tail`, etc. When users run commands, they receive hardcoded messages that don't reflect realistic tool outputs or adapt to the game context.

### Current Implementation Issues

```typescript
// Current static response in GameCommands.ts
case "ping":
  response = [
    `You attempt to use the ${action} command...`,
    "This is a simulation - these commands won't actually execute.",
    `Type '${action} help' to learn more about this command.`,
  ];
```

**Problems:**

- Generic, non-educational responses
- No context awareness (room, game state, storyline)
- Missed opportunity for realistic command-line tool scenarios
- Limited educational value beyond basic command syntax

## Proposed Solution: Convex Agent-Powered Command-Line Tools

Enhance the existing `parseCommand` function by routing command-line tool commands to specialized Convex agents that generate realistic, contextual outputs, while maintaining all existing game logic for movement, inventory, and story progression.

## Architecture Overview

### Agent Paradigm Shift Application

#### 1. Thread-Centric State Management

```typescript
// ❌ Current: Stateless tool responses
export const parseCommand = (command: string, gameState: GameState) => {
  // Static response, no context persistence
  return { response: ["Generic ping output"], newState };
};

// ✅ Proposed: Thread-based command-line tool sessions with individual agents
export const executeCommandLineTool = action({
  args: {
    commandLineTool: v.string(),
    args: v.string(),
    gameState: v.object({...}),
    threadId: v.optional(v.string())
  },
  handler: async (ctx, { commandLineTool, args, gameState, threadId }) => {
    // Route to specific agent for this command-line tool
    const COMMAND_LINE_TOOL_AGENTS = {
      'ping': pingAgent,
      'ssh': sshAgent,
      'docker': dockerAgent,
      'tail': logAgent,
      'grep': logAgent,
      'netstat': networkAgent,
      'top': systemAgent,
      'kubectl': kubernetesAgent,
    };

    const agent = COMMAND_LINE_TOOL_AGENTS[commandLineTool];
    if (!agent) {
      throw new Error(`Unknown command-line tool: ${commandLineTool}`);
    }

    // Create or continue thread for this specific tool agent
    const { thread } = threadId
      ? await agent.continueThread(ctx, { threadId })
      : await agent.createThread(ctx, {
          userId: gameState.playerId,
          metadata: { commandLineTool, room: gameState.currentRoom }
        });

    const result = await thread.generateText({
      prompt: `${commandLineTool} ${args}`,
      metadata: { gameContext: gameState }
    });

    return { output: result.text, threadId: thread.threadId };
  },
});
```

#### 2. Command-Line Tool Architecture: Individual Agent Specialization

```typescript
// ✅ Individual agents per command-line tool for specialized expertise

// Network connectivity specialist
const pingAgent = new Agent(components.agent, {
  name: "Network Ping Specialist",
  chat: openai.chat("gpt-5-nano"),
  instructions: `You are a network engineer expert in ping/ICMP diagnostics.
                Generate authentic ping command outputs with realistic RTT, TTL,
                packet loss, and timing patterns based on network conditions.`,
  tools: {
    getNetworkContext: tool({
      description: "Get current network conditions for ping simulation",
      parameters: z.object({
        target: z.string(),
        sourceRoom: z.string(),
      }),
      handler: async (ctx, { target, sourceRoom }) => {
        const networkState = await getNetworkState(ctx, sourceRoom);
        const threatLevel = await getNetworkThreats(ctx, sourceRoom);

        return {
          baseLatency: calculateBaseLatency(sourceRoom, target),
          packetLossRate: threatLevel > 0 ? Math.random() * 0.1 : 0,
          jitter: networkState.congestion * 10,
          ttl: 64 - calculateHops(sourceRoom, target),
          reachable: await isTargetReachable(ctx, target, sourceRoom),
          threats: threatLevel > 0 ? ['network-breach', 'ddos'] : [],
        };
      },
    }),
  },
});

// Container platform specialist
const dockerAgent = new Agent(components.agent, {
  name: "Container Platform Expert",
  chat: openai.chat("gpt-5-nano"),
  instructions: `You are a Docker/container expert. Generate realistic
                docker command outputs including container states, resource usage,
                and orchestration details based on infrastructure context.`,
  tools: {
    getContainerContext: tool({
      description: "Get container and infrastructure state",
      parameters: z.object({
        command: z.string(),
        room: z.string(),
      }),
      handler: async (ctx, { command, room }) => {
        const containers = await getContainersInRoom(ctx, room);
        const resourceState = await getResourceMetrics(ctx, room);

        return {
          runningContainers: containers,
          systemResources: resourceState,
          healthStatus: calculateHealthStatus(containers, resourceState),
          threatImpact: await getContainerThreats(ctx, room),
        };
      },
    }),
  },
});

// Remote access specialist
const sshAgent = new Agent(components.agent, {
  name: "Remote Access Specialist",
  chat: openai.chat("gpt-5-nano"),
  instructions: `You are an SSH/remote access expert. Generate authentic SSH
                session outputs including connection attempts, authentication flows,
                and remote shell prompts based on target system context.`,
  tools: {
    getHostContext: tool({
      description: "Get target host information for SSH simulation",
      parameters: z.object({
        target: z.string(),
        sourceRoom: z.string(),
      }),
      handler: async (ctx, { target, sourceRoom }) => {
        return {
          hostReachability: await getHostStatus(ctx, target, sourceRoom),
          authMethods: await getAvailableAuthMethods(ctx, target),
          securityLevel: await getCurrentSecurityPosture(ctx, sourceRoom),
          knownHosts: await getKnownHostsForRoom(ctx, sourceRoom),
        };
      },
    }),
  },
});

// Log analysis specialist
const logAgent = new Agent(components.agent, {
  name: "Log Analysis Expert",
  chat: openai.chat("gpt-5-nano"),
  instructions: `You are a log analysis expert specializing in tail, grep, and
                log correlation. Generate realistic log outputs with contextual
                entries that reflect current system events and security incidents.`,
  tools: {
    getLogContext: tool({
      description: "Get log file context and recent events",
      parameters: z.object({
        logFile: z.string(),
        room: z.string(),
        command: z.string(), // tail, grep, etc.
      }),
      handler: async (ctx, { logFile, room, command }) => {
        const recentEvents = await getRecentEvents(ctx, room);
        const securityIncidents = await getActiveIncidents(ctx, room);

        return {
          logType: determineLogType(logFile),
          recentEvents,
          securityIncidents,
          systemHealth: await getSystemHealth(ctx, room),
          suspiciousActivity: securityIncidents.length > 0,
        };
      },
    }),
  },
});
```

#### 3. Context as First-Class Citizen

```typescript
// ✅ Rich context handler for command-line tool scenarios
const executeCommandLineToolWithContext = async (ctx, { commandLineTool, args, gameState }) => {
  // Route to appropriate specialized agent
  const COMMAND_LINE_TOOL_AGENTS = {
    'ping': pingAgent,
    'ssh': sshAgent,
    'docker': dockerAgent,
    'tail': logAgent,
    'grep': logAgent,
    'netstat': networkAgent,
    'top': systemAgent,
    'kubectl': kubernetesAgent,
  };

  const agent = COMMAND_LINE_TOOL_AGENTS[commandLineTool];
  if (!agent) {
    throw new Error(`Unknown command-line tool: ${commandLineTool}`);
  }

  const result = await agent.generateText(
    ctx,
    { threadId: gameState.toolSessionId },
    { prompt: `${commandLineTool} ${args}` },
    {
      contextHandler: async (ctx, agentArgs) => {
        // Game world context
        const roomContext = await getRoomInfrastructure(ctx, gameState.currentRoom);
        const threatContext = await getCurrentThreats(ctx, gameState.currentRoom);
        const playerProgress = await getPlayerProgress(ctx, gameState.playerId);

        // Educational context
        const toolLearningObjectives = await getCommandLineToolObjectives(ctx, commandLineTool);
        const previousToolUsage = await getPlayerCommandLineToolHistory(ctx, gameState.playerId, commandLineTool);

        // Scenario context
        const incidentContext = await getCurrentIncident(ctx, gameState.currentRoom);

        return [
          ...roomContext,      // Infrastructure state
          ...threatContext,    // Active security issues
          ...incidentContext,  // Current scenario details
          ...toolLearningObjectives, // What should the player learn?
          ...previousToolUsage,      // Adapt to skill level
          ...agentArgs.recent,       // Recent conversation
          ...agentArgs.inputPrompt,  // Current command
        ];
      },
    },
  );

  return result;
};
```

#### 4. Agent Composition Patterns

```typescript
// ✅ Clean tool-to-agent routing system
export const executeCommandLineTool = action({
  args: {
    commandLineTool: v.string(),
    args: v.string(),
    gameState: v.object({...}),
    threadId: v.optional(v.string())
  },
  handler: async (ctx, { commandLineTool, args, gameState, threadId }) => {
    // Map command-line tools to their specialized agents
    const COMMAND_LINE_TOOL_AGENTS = {
      'ping': pingAgent,
      'ssh': sshAgent,
      'docker': dockerAgent,
      'tail': logAgent,
      'grep': logAgent, // Shared for related log analysis tools
      'netstat': networkAgent,
      'top': systemAgent,
      'kubectl': kubernetesAgent,
    };

    const agent = COMMAND_LINE_TOOL_AGENTS[commandLineTool];
    if (!agent) {
      throw new Error(`Unknown command-line tool: ${commandLineTool}`);
    }

    // Create or continue thread for this tool session
    const { thread } = threadId
      ? await agent.continueThread(ctx, { threadId })
      : await agent.createThread(ctx, {
          userId: gameState.playerId,
          metadata: { commandLineTool, room: gameState.currentRoom }
        });

    // Agent uses its tools to gather context, then generates realistic output
    const result = await thread.generateText({
      prompt: `${commandLineTool} ${args}`,
      metadata: { gameContext: gameState }
    });

    return { output: result.text, threadId: thread.threadId };
  },
});

// Additional specialized agents for comprehensive tool coverage
const networkAgent = new Agent(components.agent, {
  name: "Network Analysis Expert",
  chat: openai.chat("gpt-5-nano"),
  instructions: "Specialize in network monitoring tools like netstat, ss, lsof",
  tools: { getNetworkConnections, getPortUsage },
});

const systemAgent = new Agent(components.agent, {
  name: "System Monitoring Expert",
  chat: openai.chat("gpt-5-nano"),
  instructions: "Specialize in system monitoring tools like top, ps, htop",
  tools: { getProcessList, getResourceUsage },
});

const kubernetesAgent = new Agent(components.agent, {
  name: "Kubernetes Platform Expert",
  chat: openai.chat("gpt-5-nano"),
  instructions: "Specialize in kubectl and Kubernetes cluster management",
  tools: { getClusterState, getPodStatus },
});
```

#### 5. Message Storage vs Generation

**Key Insight**: Manual `saveMessage()` and automatic `generateText()` create **different messages** for different purposes.

```typescript
// ✅ Creates multiple messages in the conversation thread
export const processGameCommand = action({
  args: { command: v.string(), gameState: v.object({...}) },
  handler: async (ctx, { command, gameState }) => {
    // Message #1: Raw player command (manual save)
    await saveMessage(ctx, components.agent, {
      threadId: gameState.sessionThreadId,
      agentName: "Player",
      message: {
        role: "user",
        content: `> ${command}` // Exact player input with shell prompt
      },
      metadata: {
        commandType: "command-line-tool",
        room: gameState.currentRoom,
        playerSkillLevel: gameState.skillLevel,
        timestamp: Date.now(),
      },
    });

    // Messages #2 & #3: Contextual prompt + LLM response (automatic save)
    const commandLineTool = parseCommandLineToolFromCommand(command);
    const agent = getCommandLineToolAgent(commandLineTool);

    const result = await agent.generateText(
      ctx,
      { threadId: gameState.sessionThreadId },
      {
        // This creates a DIFFERENT message with enriched context
        prompt: `Process command: ${command} in ${gameState.currentRoom} with current threats: ${gameState.activeThreats}`,
      }
    );

    // Message #4: Game state change (manual save)
    await saveMessage(ctx, components.agent, {
      threadId: gameState.sessionThreadId,
      agentName: "GameSystem",
      message: {
        role: "system",
        content: JSON.stringify({
          type: "state_change",
          commandExecuted: command,
          roomChanged: result.roomChanged,
          skillsLearned: result.skillsLearned,
          threatsResolved: result.threatsResolved,
        }),
      },
    });

    return result;
  },
});
```

**Example Thread Timeline** (what gets saved):
```
1. [Player] "> ping 192.168.1.1"
2. [User] "Process command: ping 192.168.1.1 in ServerRoom with current threats: firewall_misconfigured"  
3. [Assistant] "🔍 Executing ping to 192.168.1.1... PING failed: Network unreachable. This suggests the firewall is blocking ICMP traffic. Try: sudo iptables -L to examine firewall rules..."
4. [GameSystem] {"type": "state_change", "commandExecuted": "ping 192.168.1.1", "skillsLearned": ["firewall_troubleshooting"], "threatsResolved": []}
```

**Why Both Matter**:
- **Manual messages**: Audit trail, game analytics, player progress tracking, metadata-rich context
- **Auto messages**: Natural LLM conversation flow with contextual prompts and educational responses
- **Context retrieval**: Future `generateText()` calls search ALL messages for relevant educational content and game state

## Technical Implementation

### Phase 1: Core Agent Infrastructure

1. **Individual Agent Definitions**

   ```typescript
   // convex/agents/network/ping.ts
   export const pingAgent = new Agent(components.agent, {
     name: "Network Ping Specialist",
     chat: openai.chat("gpt-5-nano"),
     instructions: PING_SPECIALIST_INSTRUCTIONS,
     tools: { getNetworkContext },
   });

   // convex/agents/containers/docker.ts
   export const dockerAgent = new Agent(components.agent, {
     name: "Container Platform Expert",
     chat: openai.chat("gpt-5-nano"),
     instructions: DOCKER_SPECIALIST_INSTRUCTIONS,
     tools: { getContainerContext },
   });

   // convex/agents/logs/tail.ts
   export const logAgent = new Agent(components.agent, {
     name: "Log Analysis Expert",
     chat: openai.chat("gpt-5-nano"),
     instructions: LOG_ANALYSIS_INSTRUCTIONS,
     tools: { getLogContext },
   });
   ```

2. **Tool Routing System**

   ```typescript
   // convex/game/commands.ts
   const TOOL_AGENT_MAP = {
     'ping': () => import('../agents/network/ping').then(m => m.pingAgent),
     'ssh': () => import('../agents/network/ssh').then(m => m.sshAgent),
     'docker': () => import('../agents/containers/docker').then(m => m.dockerAgent),
     'tail': () => import('../agents/logs/tail').then(m => m.logAgent),
     'grep': () => import('../agents/logs/grep').then(m => m.logAgent),
     'netstat': () => import('../agents/network/netstat').then(m => m.networkAgent),
     'top': () => import('../agents/system/top').then(m => m.systemAgent),
     'kubectl': () => import('../agents/containers/kubectl').then(m => m.kubernetesAgent),
   };

   export const executeCommandLineTool = action({
     args: {
       tool: v.string(),
       args: v.string(),
       gameState: gameStateValidator
     },
     handler: async (ctx, { tool, args, gameState }) => {
       const agentLoader = TOOL_AGENT_MAP[tool];
       if (!agentLoader) {
         throw new Error(`Unknown command-line tool: ${tool}`);
       }

       const agent = await agentLoader();
       const { thread } = await agent.createThread(ctx, {
         userId: gameState.playerId,
         metadata: { tool, room: gameState.currentRoom }
       });

       return await thread.generateText({
         prompt: `${tool} ${args}`,
         metadata: { gameContext: gameState }
       });
     },
   });
   ```

3. **Context Builders**

   ```typescript
   // utils/gameContext.ts
   export const buildGameContext = (gameState: GameState) => {
     return {
       currentRoom: rooms[gameState.currentRoom],
       activeThreats: getActiveThreats(gameState),
       availableTools: getAvailableTools(gameState),
       playerSkillLevel: getPlayerSkillLevel(gameState),
       scenarioObjectives: getScenarioObjectives(gameState),
     };
   };
   ```

### Phase 2: Individual Command-Line Tool Agents

1. **Network Connectivity (ping)**
   - Realistic RTT, TTL, packet loss based on room threats
   - Network topology awareness for hop calculations
   - Suspicious latency patterns during breaches

2. **Remote Access (ssh)**
   - Authentication flows and connection attempts
   - Host key verification based on known_hosts
   - Access denied scenarios for compromised systems

3. **Container Management (docker)**
   - Container states reflecting room infrastructure
   - Resource usage based on system load
   - Security vulnerabilities in container images

4. **Log Analysis (tail/grep)**
   - Contextual log entries reflecting recent game events
   - Security incident patterns in log outputs
   - Realistic log formats for different services

5. **System Monitoring (top/ps)**
   - Process lists showing suspicious activity during threats
   - Resource usage reflecting system compromise
   - Hidden processes during advanced persistent threats

6. **Network Analysis (netstat)**
   - Suspicious connections during network breaches
   - Port usage reflecting room's infrastructure
   - Listening services based on deployed applications

7. **Kubernetes Management (kubectl)**
   - Pod states reflecting deployment health
   - Cluster resource availability
   - Security policy violations and misconfigurations

### Phase 3: Educational Enhancement

1. **Adaptive Learning**
   - Track player tool usage patterns
   - Adjust difficulty based on skill progression
   - Provide hints and explanations

2. **Scenario-Driven Outputs**
   - Outputs that advance the storyline
   - Clues hidden in realistic tool outputs
   - Progressive difficulty scaling

3. **Real-World Correlation**
   - Outputs based on actual tool behavior
   - Industry-standard formats and patterns
   - Common troubleshooting scenarios

## Game Integration Points

### Command Processing Flow

`parseCommand` remains the **main command router** - we're enhancing it with agent routing for command-line tools while keeping existing game logic intact.

```typescript
// Enhanced GameCommands.ts - parseCommand as the central router
export const parseCommand = async (command: string, gameState: GameState) => {
  const words = command.trim().toLowerCase().split(" ");
  const commandWord = words[0];
  const target = words.slice(1).join(" ");

  // NEW: Route command-line tools to specialized agents
  if (COMMAND_LINE_TOOLS.includes(commandWord)) {
    const agentResponse = await executeCommandLineTool({
      commandLineTool: commandWord,
      args: target,
      gameState,
      threadId: gameState.toolSessionId, // Continue existing session
    });

    return {
      response: agentResponse.output.split('\n'),
      newState: {
        ...gameState,
        toolSessionId: agentResponse.threadId,
        lastCommandLineToolUsed: commandWord,
        skillPoints: gameState.skillPoints + calculateSkillGain(commandWord),
        commandLineToolUsageHistory: [...gameState.commandLineToolUsageHistory, {
          commandLineTool: commandWord,
          args: target,
          timestamp: Date.now(),
        }],
      },
    };
  }

  // UNCHANGED: Existing static game command handling
  switch (commandWord) {
    case "help":
      return {
        response: [
          "Available commands:",
          "- look: Examine your surroundings",
          "- move [direction]: Move in a direction",
          "- take [item]: Pick up an item",
          "- use [item]: Use an item",
          "- inventory: Check what you're carrying",
          "- tools: List available command-line tools",
          "- [toolname]: Execute command-line tool (AI-powered)",
        ],
        newState: gameState,
      };

    case "look":
      // Existing room examination logic
      return handleLookCommand(gameState);

    case "move":
    case "go":
      // Existing movement logic
      return handleMovementCommand(target, gameState);

    case "take":
    case "pickup":
      // Existing item collection logic
      return handleTakeCommand(target, gameState);

    case "inventory":
      // Existing inventory display
      return handleInventoryCommand(gameState);

    // ... other existing game commands

    default:
      return {
        response: ["Unknown command. Type 'help' for available commands."],
        newState: gameState,
      };
  }
};

// Existing game command handlers remain unchanged
function handleLookCommand(gameState: GameState) {
  // Current room examination logic
}

function handleMovementCommand(direction: string, gameState: GameState) {
  // Current movement logic
}

// etc...
```

### Context Integration

```typescript
// Enhanced game state for AI context
interface EnhancedGameState extends GameState {
  toolSessionId?: string;
  recentCommands: string[];
  discoveredClues: string[];
  skillLevels: Record<string, number>;
  currentIncident?: {
    type: string;
    severity: "low" | "medium" | "high";
    affectedSystems: string[];
    timeline: Array<{ timestamp: number; event: string }>;
  };
}
```

## Educational Benefits

### 1. Realistic Experience

- Authentic tool outputs that mirror real command-line tool environments
- Context-sensitive responses that change based on system state
- Progressive complexity matching real-world scenarios

### 2. Adaptive Learning

- AI adjusts explanations based on player skill level
- Personalized hints and guidance
- Tracking of learning objectives completion

### 3. Scenario-Based Learning

- Tools reveal information that advances the story
- Outputs contain clues for puzzle-solving
- Multiple solution paths for different skill levels

### 4. Industry Relevance

- Outputs formatted like real tools
- Common troubleshooting patterns
- Best practices embedded in responses

## Implementation Timeline

### Week 1-2: Foundation

- [ ] Set up Convex agent infrastructure
- [ ] Create tool routing system with agent mapping
- [ ] Implement basic ping agent as POC
- [ ] Test agent integration with game commands

### Week 3-4: Core Network Tools

- [ ] Complete ping agent with realistic network simulation
- [ ] Implement ssh agent for remote access scenarios
- [ ] Add netstat agent for network connection analysis
- [ ] Create network context providers for room-based infrastructure

### Week 5-6: System & Container Tools

- [ ] Implement docker agent for container management
- [ ] Add top/ps agent for system monitoring
- [ ] Create kubectl agent for Kubernetes scenarios
- [ ] Build resource and process context providers

### Week 5-6: Context & Integration

- [ ] Build game context handlers
- [ ] Integrate with existing game state
- [ ] Add thread management for tool sessions

### Week 7-8: Log Analysis & Enhancement

- [ ] Implement tail/grep agent for log analysis
- [ ] Add contextual log generation based on game events
- [ ] Create adaptive difficulty based on player tool usage
- [ ] Implement cross-tool context sharing (e.g., ping results inform netstat output)

### Week 9-10: Polish & Testing

- [ ] Educational content review
- [ ] Performance optimization
- [ ] User testing and feedback integration

## Success Metrics

1. **Educational Effectiveness**
   - Player skill progression tracking
   - Learning objective completion rates
   - Retention of DevOps concepts

2. **Engagement**
   - Time spent with tool commands
   - Variety of tools explored
   - Return engagement rates

3. **Realism**
   - Accuracy of tool output formats
   - Relevance to real-world scenarios
   - Expert validation of content

4. **Technical Performance**
   - Agent response times
   - Context accuracy
   - Thread management efficiency

## Conclusion

This feature transforms RogueNode from a simple text adventure with DevOps themes into a sophisticated, AI-powered learning environment. By applying Convex agent paradigm shifts with individual tool specialization, we create:

- **Specialized tool expertise** through individual agents per command-line tool
- **Realistic command outputs** that adapt to game context and threats
- **Incremental development** allowing POC with single tools (ping → ssh → docker)
- **Clean architecture** with simple tool-to-agent routing
- **Context injection pattern** where tools provide game context, agents generate authentic outputs
- **Educational progression** through tool-specific learning objectives

### Key Architectural Benefits

1. **POC-Friendly**: Start with one tool agent (ping) and expand incrementally
2. **Specialized Expertise**: Each agent focuses on authentic tool behavior
3. **Context Separation**: Tools inject game context, agents generate realistic outputs
4. **Easy Testing**: Individual agents can be tested and refined independently
5. **Clean Routing**: Simple mapping system routes tools to appropriate agents

The result is a more engaging, educational, and realistic DevOps training experience where each tool provides authentic, context-aware outputs that adapt to the player's journey through cybersecurity scenarios.
