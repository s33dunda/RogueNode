```App.tsx
import React, { useState } from 'react'
import GameTerminal from './components/GameTerminal'
export function App() {
  return (
    <div className="flex h-screen w-full bg-black text-green-500 overflow-hidden font-mono">
      <GameTerminal />
    </div>
  )
}

```

```AppRouter.tsx
import React from "react";
  import { BrowserRouter, Routes, Route } from "react-router-dom";
  import { App } from "./App";

  export function AppRouter() {
    return (
      <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
          </Routes>
      </BrowserRouter>
    );
  }
```

```components/Canvas.tsx
import React, { useCallback, useState, useRef } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ServiceNode from './ServiceNode'
import { initialNodes, initialEdges } from '../utils/mockData'
const nodeTypes = {
  serviceNode: ServiceNode,
}
interface CanvasProps {
  onNodeSelect: (nodeId: string | null) => void
}
const Canvas = ({ onNodeSelect }: CanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: {
              stroke: '#6366f1',
              strokeWidth: 2,
            },
          },
          eds,
        ),
      ),
    [setEdges],
  )
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
      const type = event.dataTransfer.getData('application/reactflow')
      if (
        typeof type === 'undefined' ||
        !type ||
        !reactFlowInstance ||
        !reactFlowBounds
      ) {
        return
      }
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })
      const newNode = {
        id: `service-${Date.now()}`,
        type: 'serviceNode',
        position,
        data: {
          label: `Service ${nodes.length + 1}`,
          status: 'healthy',
          deploymentStatus: 'deployed',
          type: type,
        },
      }
      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, nodes, setNodes],
  )
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: any) => {
      onNodeSelect(node.id)
    },
    [onNodeSelect],
  )
  return (
    <div className="w-full h-full" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultViewport={{
          x: 0,
          y: 0,
          zoom: 1.5,
        }}
      >
        <Controls className="bg-gray-800 border border-gray-700 rounded-md" />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            switch (node.data?.status) {
              case 'healthy':
                return '#10b981'
              case 'warning':
                return '#f59e0b'
              case 'error':
                return '#ef4444'
              default:
                return '#6366f1'
            }
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          className="bg-gray-800 border border-gray-700 rounded-md"
        />
        <Background color="#4b5563" gap={16} size={1} className="bg-gray-900" />
      </ReactFlow>
    </div>
  )
}
function CanvasWithProvider(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
export default CanvasWithProvider

```

```components/ChatSidebar.tsx
import React, { useEffect, useState } from 'react'
import { MessageSquare, X, Send, User } from 'lucide-react'
import { mockChatMessages } from '../utils/mockData'
interface ChatSidebarProps {
  isOpen: boolean
  onToggle: () => void
  selectedNode: string | null
}
const ChatSidebar = ({ isOpen, onToggle, selectedNode }: ChatSidebarProps) => {
  const [messages, setMessages] = useState(mockChatMessages)
  const [newMessage, setNewMessage] = useState('')
  const [filteredMessages, setFilteredMessages] = useState(mockChatMessages)
  useEffect(() => {
    if (selectedNode) {
      setFilteredMessages(
        messages.filter((msg) => msg.relatedNodes.includes(selectedNode)),
      )
    } else {
      setFilteredMessages(messages)
    }
  }, [selectedNode, messages])
  const handleSendMessage = () => {
    if (!newMessage.trim()) return
    const newMsg = {
      id: Date.now().toString(),
      user: {
        id: 'current-user',
        name: 'You',
        avatar: '',
      },
      text: newMessage,
      timestamp: new Date().toISOString(),
      relatedNodes: selectedNode ? [selectedNode] : [],
    }
    setMessages([...messages, newMsg])
    setNewMessage('')
  }
  return (
    <div
      className={`flex flex-col border-l border-gray-700 bg-gray-800 transition-all duration-300 ${isOpen ? 'w-80' : 'w-0'}`}
    >
      {isOpen && (
        <>
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="font-medium flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Team Chat
              {selectedNode && (
                <span className="ml-2 px-2 py-0.5 bg-indigo-900 text-indigo-300 text-xs rounded-full">
                  Filtered
                </span>
              )}
            </h2>
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredMessages.map((message) => (
              <div key={message.id} className="flex space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  {message.user.avatar ? (
                    <img
                      src={message.user.avatar}
                      alt={message.user.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <User className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline">
                    <span className="font-medium text-sm">
                      {message.user.name}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1">{message.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={
                  selectedNode
                    ? 'Discuss this component...'
                    : 'Type a message...'
                }
                className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSendMessage}
                className="bg-indigo-600 hover:bg-indigo-700 rounded-md p-2 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
export default ChatSidebar

```

```components/ControlPanel.tsx
import React from 'react'
import {
  Server,
  Database,
  Globe,
  Cloud,
  Plus,
  ZoomIn,
  ZoomOut,
  Save,
  GitBranch,
} from 'lucide-react'
const ControlPanel = () => {
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: string,
  ) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }
  return (
    <div className="absolute left-4 top-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-10">
      <div className="flex flex-col space-y-1">
        <div className="p-2 border-b border-gray-700 flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          <span className="text-xs font-medium">Add Services</span>
        </div>
        <div
          className="flex items-center p-2 hover:bg-gray-700 rounded cursor-grab transition-colors"
          draggable
          onDragStart={(e) => onDragStart(e, 'server')}
        >
          <Server className="w-5 h-5 mr-2 text-indigo-400" />
          <span className="text-sm">Server</span>
        </div>
        <div
          className="flex items-center p-2 hover:bg-gray-700 rounded cursor-grab transition-colors"
          draggable
          onDragStart={(e) => onDragStart(e, 'database')}
        >
          <Database className="w-5 h-5 mr-2 text-green-400" />
          <span className="text-sm">Database</span>
        </div>
        <div
          className="flex items-center p-2 hover:bg-gray-700 rounded cursor-grab transition-colors"
          draggable
          onDragStart={(e) => onDragStart(e, 'api')}
        >
          <Globe className="w-5 h-5 mr-2 text-blue-400" />
          <span className="text-sm">API</span>
        </div>
        <div
          className="flex items-center p-2 hover:bg-gray-700 rounded cursor-grab transition-colors"
          draggable
          onDragStart={(e) => onDragStart(e, 'cloud')}
        >
          <Cloud className="w-5 h-5 mr-2 text-purple-400" />
          <span className="text-sm">Cloud</span>
        </div>
        <div className="border-t border-gray-700 my-1"></div>
        <button className="flex items-center p-2 hover:bg-gray-700 rounded transition-colors">
          <Save className="w-4 h-4 mr-2" />
          <span className="text-sm">Save</span>
        </button>
        <button className="flex items-center p-2 hover:bg-gray-700 rounded transition-colors">
          <GitBranch className="w-4 h-4 mr-2" />
          <span className="text-sm">Branch</span>
        </button>
      </div>
    </div>
  )
}
export default ControlPanel

```

```components/GameTerminal.tsx
import React, { useEffect, useState, useRef } from 'react'
import { gameMap, initialRoom, rooms, items, enemies } from '../utils/GameData'
import { parseCommand } from '../utils/GameCommands'
import { HelpCircle, RefreshCw, Terminal, Info } from 'lucide-react'
const GameTerminal = () => {
  const [output, setOutput] = useState<string[]>([
    'RogueNode v0.1 - DevOps Rogue Training Ground',
    '© 1977 TERMINAL INDUSTRIES',
    '---------------------------------------',
    'You awaken in a dimly lit server room. The hum of machines surrounds you.',
    "Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
    '',
    "Type 'help' for available commands or 'tools' to see DevOps commands.",
    '> ',
  ])
  const [input, setInput] = useState('')
  const [isNavVisible, setIsNavVisible] = useState(false)
  const [gameState, setGameState] = useState({
    currentRoom: initialRoom,
    inventory: [],
    health: 100,
    visited: [initialRoom],
    enemies: [...enemies],
    gameOver: false,
  })
  const terminalRef = useRef<HTMLDivElement>(null)
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Add user command to output
    const newOutput = [...output.slice(0, -1), `> ${input}`, '']
    if (input.trim() !== '') {
      // Process command and get response
      const { response, newState } = parseCommand(
        input.toLowerCase(),
        gameState,
      )
      // Add response to output
      newOutput.push(...response, '> ')
      // Update game state if command changed it
      if (newState) {
        setGameState(newState)
      }
    } else {
      newOutput.push('> ')
    }
    setOutput(newOutput)
    setInput('')
  }
  const executeCommand = (command: string) => {
    // Simulate typing a command through the navbar
    const newOutput = [...output.slice(0, -1), `> ${command}`, '']
    const { response, newState } = parseCommand(command, gameState)
    newOutput.push(...response, '> ')
    if (newState) {
      setGameState(newState)
    }
    setOutput(newOutput)
  }
  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [output])
  return (
    <div
      className="flex flex-col h-full w-full bg-black text-green-500 overflow-hidden font-mono relative"
      onMouseMove={(e) => {
        // Show nav when mouse is near the top of the screen
        if (e.clientY < 50) {
          setIsNavVisible(true)
        } else if (e.clientY > 100) {
          setIsNavVisible(false)
        }
      }}
    >
      {/* Terminal navigation bar */}
      <div
        className={`transition-all duration-300 ease-in-out border-b border-green-800 bg-black ${isNavVisible ? 'h-12 opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}
      >
        <div className="flex items-center justify-between px-4 h-full">
          <div className="text-green-500 font-bold tracking-wider">
            CYBERDUNGEON v0.1
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => executeCommand('help')}
              className="flex items-center text-green-500 hover:text-green-400 transition"
            >
              <HelpCircle className="w-4 h-4 mr-1" />
              <span className="text-sm">Help</span>
            </button>
            <button
              onClick={() => executeCommand('tools')}
              className="flex items-center text-green-500 hover:text-green-400 transition"
            >
              <Terminal className="w-4 h-4 mr-1" />
              <span className="text-sm">Tools</span>
            </button>
            <button
              onClick={() => executeCommand('restart')}
              className="flex items-center text-green-500 hover:text-green-400 transition"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              <span className="text-sm">Restart</span>
            </button>
            <button
              onClick={() => executeCommand('status')}
              className="flex items-center text-green-500 hover:text-green-400 transition"
            >
              <Info className="w-4 h-4 mr-1" />
              <span className="text-sm">Status</span>
            </button>
          </div>
        </div>
      </div>
      {/* Terminal output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto whitespace-pre-wrap p-4"
        style={{
          textShadow: '0 0 5px rgba(0, 255, 0, 0.5)',
          lineHeight: '1.3',
        }}
      >
        {output.map((line, i) => {
          const isCommand = line.startsWith('>')
          const isHeading = line.match(/^[A-Z]+:$/)
          const className = `${isCommand ? 'text-yellow-500' : ''} ${isHeading ? 'font-bold text-green-400' : ''}`
          return (
            <div key={i} className={className}>
              {line}
            </div>
          )
        })}
      </div>
      {/* Input form */}
      <form
        onSubmit={handleSubmit}
        className="flex border-t border-green-800 p-4"
      >
        <div className="text-yellow-500 mr-2">&gt;</div>
        <input
          type="text"
          value={input}
          onChange={handleInput}
          className="flex-1 bg-transparent border-none outline-none text-green-500 caret-green-500"
          autoFocus
          disabled={gameState.gameOver}
          spellCheck="false"
        />
      </form>
      {/* CRT effect overlays */}
      <div className="fixed inset-0 pointer-events-none bg-green-900 opacity-[0.03] z-10"></div>
      <div
        className="fixed inset-0 pointer-events-none z-20"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.2) 50%, transparent 100%)',
          backgroundSize: '100% 4px',
          animation: 'scanline 10s linear infinite',
        }}
      ></div>
      <style>{`
        @keyframes scanline {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }
      `}</style>
    </div>
  )
}
export default GameTerminal

```

```components/ServiceNode.tsx
import '@xyflow/react/dist/style.css'
import React, { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import {
  Server,
  Database,
  Globe,
  Cloud,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react'
const ServiceNode = ({ data }: NodeProps) => {
  const getIcon = () => {
    switch (data.type) {
      case 'database':
        return <Database className="w-5 h-5 mr-2" />
      case 'api':
        return <Globe className="w-5 h-5 mr-2" />
      case 'cloud':
        return <Cloud className="w-5 h-5 mr-2" />
      default:
        return <Server className="w-5 h-5 mr-2" />
    }
  }
  const getStatusColor = () => {
    switch (data.status) {
      case 'healthy':
        return 'bg-green-500'
      case 'warning':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }
  const getDeploymentIcon = () => {
    switch (data.deploymentStatus) {
      case 'deployed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }
  return (
    <div
      className={`px-4 py-3 rounded-lg border shadow-lg transition-all ${data.selected ? 'border-indigo-500 shadow-indigo-500/30' : 'border-gray-700'} bg-gray-800 min-w-[180px]`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 border-2 border-gray-700 bg-gray-900"
      />
      <div className="flex items-center mb-2">
        {getIcon()}
        <div className="font-medium truncate">{data.label}</div>
        <div className={`ml-auto w-3 h-3 rounded-full ${getStatusColor()}`} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-700 pt-2 mt-1">
        <div className="flex items-center">
          {getDeploymentIcon()}
          <span className="ml-1">{data.deploymentStatus}</span>
        </div>
        <div>v1.2.4</div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 border-2 border-gray-700 bg-gray-900"
      />
    </div>
  )
}
export default memo(ServiceNode)

```

```components/VersionHistory.tsx
import React, { useState } from 'react'
import { History, ChevronUp } from 'lucide-react'
const VersionHistory = () => {
  const [isExpanded, setIsExpanded] = useState(false)
  return (
    <div
      className={`bg-gray-800 border-t border-gray-700 transition-all duration-300 ${isExpanded ? 'h-64' : 'h-10'}`}
    >
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <History className="w-4 h-4 mr-2" />
          <h3 className="text-sm font-medium">Version History</h3>
        </div>
        <ChevronUp
          className={`w-4 h-4 transition-transform ${isExpanded ? '' : 'transform rotate-180'}`}
        />
      </div>
      {isExpanded && (
        <div className="p-4 overflow-y-auto h-[calc(100%-2.5rem)]">
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-700"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="mb-4 pl-8 relative">
                <div className="absolute left-2 w-4 h-4 rounded-full bg-indigo-600 border-2 border-gray-800 -ml-2"></div>
                <div className="bg-gray-750 p-3 rounded border border-gray-700">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">
                      {i === 0 ? 'Current version' : `Version ${5 - i}`}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(Date.now() - i * 3600000).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {i === 0 &&
                      'Added new API gateway and connected to auth service'}
                    {i === 1 && 'Updated database cluster configuration'}
                    {i === 2 && 'Connected payment service to user database'}
                    {i === 3 && 'Added CDN nodes for static assets'}
                    {i === 4 && 'Initial infrastructure setup'}
                  </p>
                  {i === 0 && (
                    <div className="flex items-center mt-2 text-xs text-indigo-400">
                      <span>By: Alex Lee</span>
                    </div>
                  )}
                  {i !== 0 && (
                    <button className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">
                      Restore this version
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
export default VersionHistory

```

```index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 47.4% 11.2%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 47.4% 11.2%;

    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 100% 50%;
    --destructive-foreground: 210 40% 98%;

    --ring: 215 20.2% 65.1%;

    --radius: 0.5rem;
  }

  :root[class~="dark"] {
    --background: 224 71% 4%;
    --foreground: 213 31% 91%;

    --muted: 223 47% 11%;
    --muted-foreground: 215.4 16.3% 56.9%;

    --accent: 216 34% 17%;
    --accent-foreground: 210 40% 98%;

    --popover: 224 71% 4%;
    --popover-foreground: 215 20.2% 65.1%;

    --border: 216 34% 17%;
    --input: 216 34% 17%;

    --card: 224 71% 4%;
    --card-foreground: 213 31% 91%;

    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 1.2%;

    --secondary: 222.2 47.4% 11.2%;
    --secondary-foreground: 210 40% 98%;

    --destructive: 0 63% 31%;
    --destructive-foreground: 210 40% 98%;

    --ring: 216 34% 17%;

    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

```index.tsx
import './index.css'
import React from "react";
import { render } from "react-dom";
import { App } from "./App";

render(<App />, document.getElementById("root"));

```

```tailwind.config.js
module.exports = {
  darkMode: "selector",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
}
```

```utils/GameCommands.ts
import { rooms, items, enemies, devopsTools } from './GameData'
// Process player commands and return response text and updated game state
export const parseCommand = (command: string, gameState: any) => {
  const words = command.trim().toLowerCase().split(' ')
  const action = words[0]
  const target = words.slice(1).join(' ')
  let response: string[] = []
  let newState = { ...gameState }
  // Handle commands
  switch (action) {
    case 'help':
      response = [
        'Available commands:',
        '- look: Examine your surroundings',
        '- move [north|south|east|west]: Move in a direction',
        '- examine [object]: Look at something specific',
        '- take [item]: Pick up an item',
        '- use [item]: Use an item in your inventory',
        "- inventory: Check what you're carrying",
        '- status: Check your system status',
        '- fix [target]: Attempt to repair a broken system',
        '- tools: List available DevOps tools',
        "- [toolname] help: Get help on a specific tool (e.g. 'ping help')",
        "- restart: Restart the game (if you're stuck)",
        '- help: Show this help text',
      ]
      break
    case 'look':
      const room = rooms[gameState.currentRoom]
      response = [`[${room.name}]`, room.description]
      // List exits
      const exits = Object.entries(room.exits)
        .filter(([_, roomId]) => roomId !== null)
        .map(([direction, _]) => direction)
      if (exits.length > 0) {
        response.push('', `Exits: ${exits.join(', ')}`)
      } else {
        response.push('', 'There are no visible exits.')
      }
      // List items
      const roomItems = items.filter(
        (item) => item.location === gameState.currentRoom && !item.taken,
      )
      if (roomItems.length > 0) {
        response.push('', 'You see:')
        roomItems.forEach((item) => {
          response.push(`- ${item.name}: ${item.description}`)
        })
      }
      // List enemies
      const roomEnemies = gameState.enemies.filter(
        (enemy) => enemy.location === gameState.currentRoom && !enemy.defeated,
      )
      if (roomEnemies.length > 0) {
        response.push('', 'ALERT! System threats detected:')
        roomEnemies.forEach((enemy) => {
          response.push(`- ${enemy.name}: ${enemy.description}`)
        })
      }
      break
    case 'move':
    case 'go':
      const direction = target.toLowerCase()
      const currentRoom = rooms[gameState.currentRoom]
      if (['north', 'south', 'east', 'west'].includes(direction)) {
        const nextRoomId = currentRoom.exits[direction]
        if (nextRoomId) {
          const nextRoom = rooms[nextRoomId]
          newState.currentRoom = nextRoomId
          // Add room to visited list if first time
          if (!newState.visited.includes(nextRoomId)) {
            newState.visited.push(nextRoomId)
            response = [
              `You move ${direction} to ${nextRoom.name}.`,
              '',
              nextRoom.description,
            ]
          } else {
            response = [`You move ${direction} to ${nextRoom.name}.`]
          }
          // Check if room has enemies
          const roomEnemies = newState.enemies.filter(
            (enemy) => enemy.location === nextRoomId && !enemy.defeated,
          )
          if (roomEnemies.length > 0) {
            response.push('', 'ALERT! System threats detected!')
          }
        } else {
          response = [`You cannot move ${direction} from here.`]
        }
      } else {
        response = [
          "Invalid direction. Try 'north', 'south', 'east', or 'west'.",
        ]
      }
      break
    case 'inventory':
    case 'inv':
      const inventoryItems = items.filter((item) => item.taken)
      if (inventoryItems.length > 0) {
        response = ['Your inventory contains:']
        inventoryItems.forEach((item) => {
          response.push(`- ${item.name}: ${item.description}`)
        })
      } else {
        response = ['Your inventory is empty.']
      }
      break
    case 'take':
    case 'pickup':
    case 'get':
      if (!target) {
        response = ['What do you want to take?']
        break
      }
      const itemToTake = items.find(
        (item) =>
          item.location === gameState.currentRoom &&
          !item.taken &&
          (item.name.toLowerCase() === target ||
            item.aliases?.includes(target)),
      )
      if (itemToTake) {
        itemToTake.taken = true
        response = [`You take the ${itemToTake.name}.`]
        if (itemToTake.onTake) {
          response.push(itemToTake.onTake)
        }
      } else {
        response = ["You don't see that here."]
      }
      break
    case 'use':
      if (!target) {
        response = ['What do you want to use?']
        break
      }
      const itemToUse = items.find(
        (item) =>
          item.taken &&
          (item.name.toLowerCase() === target ||
            item.aliases?.includes(target)),
      )
      if (itemToUse) {
        if (itemToUse.use) {
          const useResult = itemToUse.use(gameState)
          response = useResult.message
          if (useResult.updateState) {
            newState = { ...newState, ...useResult.updateState }
          }
        } else {
          response = [`You're not sure how to use the ${itemToUse.name} here.`]
        }
      } else {
        response = ["You don't have that item."]
      }
      break
    case 'status':
      response = [
        'SYSTEM STATUS:',
        `Health: ${gameState.health}%`,
        `Visited nodes: ${gameState.visited.length}/${Object.keys(rooms).length}`,
        `Threats neutralized: ${gameState.enemies.filter((e) => e.defeated).length}/${gameState.enemies.length}`,
      ]
      break
    case 'tools':
      response = ['available devops tools:', '-------------------']
      devopsTools.forEach((tool) => {
        response.push(`- ${tool.name}: ${tool.description}`)
      })
      response.push('')
      response.push("Type '[toolname] help' for detailed usage information.")
      break
    case 'ping':
    case 'ssh':
    case 'tail':
    case 'grep':
    case 'netstat':
    case 'docker':
    case 'kubectl':
    case 'top':
      // Check if this is a help request for a tool
      if (target === 'help') {
        const tool = devopsTools.find((t) => t.name === action)
        if (tool) {
          response = [
            `${tool.name.toUpperCase()}:`,
            `Syntax: ${tool.syntax}`,
            `Description: ${tool.description}`,
            `Example: ${tool.example}`,
            `${tool.explanation}`,
          ]
        } else {
          response = ["Unknown tool. Type 'tools' to see available tools."]
        }
      } else {
        response = [
          `You attempt to use the ${action} command...`,
          "This is a simulation - these commands won't actually execute.",
          `Type '${action} help' to learn more about this command.`,
        ]
      }
      break
    case 'fix':
    case 'repair':
    case 'debug':
      if (!target) {
        response = ['What do you want to fix?']
        break
      }
      const enemyToFix = gameState.enemies.find(
        (enemy) =>
          enemy.location === gameState.currentRoom &&
          !enemy.defeated &&
          (enemy.name.toLowerCase() === target ||
            enemy.aliases?.includes(target)),
      )
      if (enemyToFix) {
        const requiredItem = items.find(
          (item) => item.id === enemyToFix.requiredItemId && item.taken,
        )
        if (requiredItem) {
          enemyToFix.defeated = true
          response = [
            `You use the ${requiredItem.name} to fix the ${enemyToFix.name}.`,
            enemyToFix.defeatMessage,
          ]
          // Check if all enemies are defeated
          if (gameState.enemies.every((e) => e.defeated)) {
            response.push(
              '',
              'CONGRATULATIONS! All system threats have been neutralized.',
              'The datacenter is secure once again thanks to your DevOps skills!',
              '',
              "Game Complete - Type 'restart' to play again.",
            )
            newState.gameOver = true
          }
        } else {
          response = [
            `You attempt to fix the ${enemyToFix.name} but lack the proper tools.`,
            enemyToFix.failMessage ||
              'You need to find the right tool for this job.',
          ]
          // Take damage
          newState.health -= 10
          response.push(`You take damage! Health: ${newState.health}%`)
          if (newState.health <= 0) {
            response.push(
              '',
              'CRITICAL SYSTEM FAILURE',
              'Your connection has been terminated.',
              '',
              "Game Over - Type 'restart' to try again.",
            )
            newState.gameOver = true
          }
        }
      } else {
        response = ["There's nothing like that to fix here."]
      }
      break
    case 'examine':
    case 'inspect':
    case 'check':
      if (!target) {
        response = ['What do you want to examine?']
        break
      }
      // Check for items in room
      const itemToExamine = items.find(
        (item) =>
          ((item.location === gameState.currentRoom && !item.taken) ||
            item.taken) &&
          (item.name.toLowerCase() === target ||
            item.aliases?.includes(target)),
      )
      if (itemToExamine) {
        response = [
          `${itemToExamine.name}: ${itemToExamine.description}`,
          itemToExamine.examineText || 'Nothing unusual about it.',
        ]
        break
      }
      // Check for enemies
      const enemyToExamine = gameState.enemies.find(
        (enemy) =>
          enemy.location === gameState.currentRoom &&
          (enemy.name.toLowerCase() === target ||
            enemy.aliases?.includes(target)),
      )
      if (enemyToExamine) {
        response = [
          `${enemyToExamine.name}: ${enemyToExamine.description}`,
          enemyToExamine.examineText ||
            "You'll need the right tools to fix this issue.",
        ]
        break
      }
      // Default response
      response = ["You don't see anything like that here."]
      break
    case 'restart':
      newState = {
        currentRoom: initialRoom,
        inventory: [],
        health: 100,
        visited: [initialRoom],
        enemies: [...enemies],
        gameOver: false,
      }
      // Reset all items
      items.forEach((item) => {
        item.taken = false
      })
      response = [
        'Game restarted.',
        '',
        'You awaken in a dimly lit server room. The hum of machines surrounds you.',
        "Your terminal flickers with an urgent message: 'SYSTEM COMPROMISED'",
        '',
        "Type 'help' for available commands.",
      ]
      break
    default:
      response = ["Unknown command. Type 'help' for a list of commands."]
  }
  return { response, newState }
}

```

```utils/GameData.ts
// Map of the dungeon
export const gameMap = {
  width: 5,
  height: 5,
}
// Starting room
export const initialRoom = 'server-room'
// Rooms in the dungeon
export const rooms = {
  'server-room': {
    id: 'server-room',
    name: 'Server Room',
    description:
      'A chilly room filled with racks of humming servers. Blinking lights cast an eerie glow on the walls. The main terminal shows critical errors.',
    exits: {
      north: null,
      south: 'corridor-1',
      east: null,
      west: null,
    },
  },
  'corridor-1': {
    id: 'corridor-1',
    name: 'Main Corridor',
    description:
      'A long corridor with exposed cables running along the ceiling. Emergency lights flash intermittently, bathing the area in red.',
    exits: {
      north: 'server-room',
      south: 'network-hub',
      east: 'storage-room',
      west: 'monitoring-station',
    },
  },
  'network-hub': {
    id: 'network-hub',
    name: 'Network Hub',
    description:
      'The central networking hub with dozens of interconnected switches and routers. Many of the connection lights are dark or flashing in error patterns.',
    exits: {
      north: 'corridor-1',
      south: 'datacenter-core',
      east: null,
      west: null,
    },
  },
  'storage-room': {
    id: 'storage-room',
    name: 'Storage Room',
    description:
      'A cluttered storage area filled with old equipment, spare parts, and maintenance tools. Dust covers most surfaces, suggesting infrequent visits.',
    exits: {
      north: null,
      south: null,
      east: null,
      west: 'corridor-1',
    },
  },
  'monitoring-station': {
    id: 'monitoring-station',
    name: 'Monitoring Station',
    description:
      'A small room with multiple monitors showing system statistics. Most displays are showing critical alerts and error messages.',
    exits: {
      north: null,
      south: null,
      east: 'corridor-1',
      west: null,
    },
  },
  'datacenter-core': {
    id: 'datacenter-core',
    name: 'Datacenter Core',
    description:
      'The heart of the datacenter. Massive cooling systems struggle to maintain temperature. The central mainframe appears to be in lockdown mode.',
    exits: {
      north: 'network-hub',
      south: 'backup-facility',
      east: 'security-office',
      west: null,
    },
  },
  'security-office': {
    id: 'security-office',
    name: 'Security Office',
    description:
      'The datacenter security room. Monitors show camera feeds from throughout the facility. The intrusion detection system is flashing warnings.',
    exits: {
      north: null,
      south: null,
      east: null,
      west: 'datacenter-core',
    },
  },
  'backup-facility': {
    id: 'backup-facility',
    name: 'Backup Facility',
    description:
      'A separate room housing backup systems and tape drives. The automated backup process appears to have failed mid-cycle.',
    exits: {
      north: 'datacenter-core',
      south: null,
      east: null,
      west: null,
    },
  },
}
// Items that can be found
export const items = [
  {
    id: 'debug-tool',
    name: 'Debug Tool',
    description: 'A specialized diagnostic tool for identifying network issues',
    location: 'storage-room',
    taken: false,
    aliases: ['tool', 'debugger', 'diagnostic'],
    examineText:
      "A professional-grade network diagnostic tool. The display shows it's charged and ready to use.",
    onTake:
      'The tool lights up as you pick it up, ready to diagnose network problems.',
  },
  {
    id: 'admin-keycard',
    name: 'Admin Keycard',
    description: 'A high-level access card for secured systems',
    location: 'monitoring-station',
    taken: false,
    aliases: ['card', 'keycard', 'access card'],
    examineText:
      'The keycard belongs to the lead system administrator. It has access to all secure areas.',
  },
  {
    id: 'backup-drive',
    name: 'Backup Drive',
    description: 'An external drive containing clean system backups',
    location: 'backup-facility',
    taken: false,
    aliases: ['drive', 'backup', 'external drive'],
    examineText:
      'A high-capacity drive containing verified clean backups of critical systems.',
  },
  {
    id: 'security-patch',
    name: 'Security Patch',
    description: 'A USB drive containing the latest security patches',
    location: 'security-office',
    taken: false,
    aliases: ['patch', 'usb', 'drive'],
    examineText:
      "The USB contains critical security patches that haven't been applied yet.",
  },
]
// Enemies (system problems to fix)
export const enemies = [
  {
    id: 'malware-infection',
    name: 'Malware Infection',
    description: 'A critical system infected with ransomware',
    location: 'server-room',
    defeated: false,
    requiredItemId: 'security-patch',
    aliases: ['malware', 'virus', 'infection', 'ransomware'],
    examineText:
      "The system is locked by ransomware. You'll need security patches to clean this infection.",
    failMessage:
      'Your attempt to manually remove the malware fails. You need proper security patches.',
    defeatMessage:
      'You successfully deploy the security patch, neutralizing the ransomware and restoring system access.',
  },
  {
    id: 'network-breach',
    name: 'Network Breach',
    description: 'An ongoing network intrusion from an unknown source',
    location: 'network-hub',
    defeated: false,
    requiredItemId: 'debug-tool',
    aliases: ['breach', 'intrusion', 'network'],
    examineText:
      'Active network intrusion in progress. The attack is coming from multiple vectors.',
    failMessage:
      "Without proper diagnostics, you can't identify all intrusion points.",
    defeatMessage:
      'Using the debug tool, you identify and block all intrusion points, securing the network.',
  },
  {
    id: 'corrupted-database',
    name: 'Corrupted Database',
    description: 'The main database cluster has become corrupted',
    location: 'datacenter-core',
    defeated: false,
    requiredItemId: 'backup-drive',
    aliases: ['database', 'db', 'corruption', 'corrupted'],
    examineText:
      'The database shows significant corruption. Records are being lost by the minute.',
    failMessage: 'Manual database repair attempts only worsen the corruption.',
    defeatMessage:
      'You restore the database from the clean backup, bringing the system back online.',
  },
  {
    id: 'locked-mainframe',
    name: 'Locked Mainframe',
    description: 'The central mainframe is in security lockdown',
    location: 'datacenter-core',
    defeated: false,
    requiredItemId: 'admin-keycard',
    aliases: ['mainframe', 'lockdown', 'locked'],
    examineText:
      'The mainframe entered emergency lockdown. Only admin access can override this.',
    failMessage: 'Security protocols prevent unauthorized access attempts.',
    defeatMessage:
      'You use the admin keycard to authenticate and successfully override the lockdown.',
  },
]
// DevOps/SRE tools available in the game
export const devopsTools = [
  {
    name: 'ping',
    syntax: 'ping [system]',
    description: 'Checks connectivity to a specified system or service',
    example: 'ping auth-service',
    explanation:
      'Sends ICMP echo requests to verify if a system is reachable on the network.',
  },
  {
    name: 'ssh',
    syntax: 'ssh [system]',
    description: 'Securely connects to a remote system for administration',
    example: 'ssh database-01',
    explanation:
      'Establishes an encrypted shell connection to access and control remote systems.',
  },
  {
    name: 'tail',
    syntax: 'tail -f [logfile]',
    description: 'Displays the end of a log file in real-time',
    example: 'tail -f system.log',
    explanation:
      'Continuously monitors log files for new entries, essential for real-time troubleshooting.',
  },
  {
    name: 'grep',
    syntax: 'grep [pattern] [file]',
    description: 'Searches for specific patterns in files',
    example: 'grep ERROR system.log',
    explanation:
      'Filters text to find specific error messages or patterns in log files and outputs.',
  },
  {
    name: 'netstat',
    syntax: 'netstat -tuln',
    description: 'Displays network connections and listening ports',
    example: 'netstat -tuln',
    explanation:
      'Shows active connections and open ports, helping identify unexpected network activity.',
  },
  {
    name: 'docker',
    syntax: 'docker [command]',
    description: 'Manages containerized applications',
    example: 'docker ps',
    explanation:
      'Controls container lifecycle, allowing deployment and management of isolated services.',
  },
  {
    name: 'kubectl',
    syntax: 'kubectl [command]',
    description: 'Controls Kubernetes clusters',
    example: 'kubectl get pods',
    explanation:
      'Orchestrates containerized applications across multiple hosts in a cluster environment.',
  },
  {
    name: 'top',
    syntax: 'top',
    description: 'Monitors system resource usage in real-time',
    example: 'top',
    explanation:
      'Displays CPU, memory, and process information to identify performance bottlenecks.',
  },
]

```
