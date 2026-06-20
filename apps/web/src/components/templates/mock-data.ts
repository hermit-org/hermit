/**
 * Mock data used by Templates to demonstrate layout with placeholder content.
 * Pages replace this with real state.
 */
import type {
  SessionMode,
  ContentBlock,
} from "@hermit/acp";
import type {
  ConnectionStatus,
  SessionTag,
  ToolCallState,
  FileNode,
  TerminalSession,
  McpServerEntry,
  PendingPermission,
  UsageStats,
} from "@/components/domain";
import type { SessionSummary } from "@/components/organisms/session-sidebar";
import type { ChatItem } from "@/components/organisms/chat-area";

export const MOCK_MODES: SessionMode[] = [
  { id: "ask", name: "Ask", description: "Q&A, no file changes" },
  { id: "architect", name: "Architect", description: "Plan before acting" },
  { id: "code", name: "Code", description: "Full write access" },
];

export const MOCK_TAGS: SessionTag[] = [
  { id: "bug", name: "bug", color: "rose" },
  { id: "feature", name: "feature", color: "green" },
  { id: "research", name: "research", color: "blue" },
];

export const MOCK_SESSIONS: SessionSummary[] = [
  {
    id: "s1",
    title: "Refactor parser module",
    updatedAt: Date.now() - 1000 * 60 * 5,
    modeId: "code",
    tags: [MOCK_TAGS[1]],
  },
  {
    id: "s2",
    title: "Investigate SSE reconnect bug",
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    modeId: "ask",
    tags: [MOCK_TAGS[0]],
  },
  {
    id: "s3",
    title: "Compare auth strategies",
    updatedAt: Date.now() - 1000 * 60 * 60 * 26,
    modeId: "architect",
    tags: [MOCK_TAGS[2]],
    closed: true,
  },
];

export const MOCK_CONNECTION: ConnectionStatus = "connected";

export const MOCK_USAGE: UsageStats = {
  used: 48213,
  size: 200000,
  cost: { amount: 0.142, currency: "USD" },
};

const text = (t: string): ContentBlock => ({ type: "text", text: t });

export const MOCK_CHAT_ITEMS: ChatItem[] = [
  {
    kind: "message",
    key: "m1",
    role: "user",
    content: "Can you refactor the parser to use a state machine?",
    createdAt: Date.now() - 1000 * 60 * 5,
  },
  {
    kind: "message",
    key: "m2",
    role: "assistant",
    content:
      "I'll start by reading the current parser implementation, then sketch a state-machine design.\n\n```ts\nconst states = [\"idle\", \"reading\", \"done\"] as const;\n```",
    createdAt: Date.now() - 1000 * 60 * 4,
  },
  {
    kind: "tool_call",
    key: "tc1",
    call: {
      toolCallId: "tc_1",
      title: "read_file parser.ts",
      kind: "read",
      status: "completed",
      content: [
        {
          type: "content",
          content: text("Read 248 lines from `src/parser.ts`."),
        },
      ],
      locations: [{ path: "src/parser.ts", line: 1 }],
      rawInput: { path: "src/parser.ts" },
      rawOutput: "248 lines",
    } satisfies ToolCallState,
  },
  {
    kind: "message",
    key: "m3",
    role: "assistant",
    content:
      "Here's the proposed state machine. It splits tokenization into distinct states for clarity.",
    streaming: true,
    createdAt: Date.now() - 1000 * 60 * 1,
  },
];

export const MOCK_TOOL_CALLS: ToolCallState[] = MOCK_CHAT_ITEMS.filter(
  (i): i is Extract<ChatItem, { kind: "tool_call" }> => i.kind === "tool_call",
).map((i) => i.call);

export const MOCK_FILE_TREE: FileNode[] = [
  {
    path: "src",
    name: "src",
    isDirectory: true,
    children: [
      {
        path: "src/parser.ts",
        name: "parser.ts",
        isDirectory: false,
        size: 4821,
      },
      {
        path: "src/index.ts",
        name: "index.ts",
        isDirectory: false,
        size: 932,
      },
      {
        path: "src/README.md",
        name: "README.md",
        isDirectory: false,
        size: 1204,
      },
    ],
  },
  {
    path: "package.json",
    name: "package.json",
    isDirectory: false,
    size: 612,
  },
];

export const MOCK_FILE_CONTENT = `export function parse(input: string): Token[] {
  // TODO: replace with state machine
  return [];
}
`;

export const MOCK_TERMINAL: TerminalSession = {
  id: "t1",
  command: "npm run test",
  cwd: "/home/user/project",
  output:
    "\n> hermit@0.0.1 test\n> bun test\n\nparser.test.ts:\n✓ tokenizes identifiers (2ms)\n✓ tokenizes strings (1ms)\n✗ handles nested braces (5ms)\n\n1 fail | 2 pass | 3 expect\n",
  exitStatus: 1,
  running: false,
};

export const MOCK_MCP_SERVERS: McpServerEntry[] = [
  {
    config: {
      name: "filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    },
    state: "connected",
  },
  {
    config: {
      type: "http",
      name: "github",
      url: "https://mcp.github.example.com/sse",
    },
    state: "disconnected",
  },
  {
    config: {
      type: "sse",
      name: "memory",
      url: "https://mcp.memory.example.com",
    },
    state: "error",
    lastError: "Connection refused",
  },
];

export const MOCK_PERMISSIONS: PendingPermission[] = [
  {
    id: "p1",
    sessionId: "s1",
    createdAt: Date.now(),
    toolCall: {
      toolCallId: "tc_99",
      title: "write_file src/parser.ts",
      kind: "edit",
    },
    options: [
      { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
      { optionId: "allow_always", name: "Always allow", kind: "allow_always" },
      { optionId: "reject_once", name: "Deny", kind: "reject_once" },
    ],
  },
];

export const MOCK_COMMANDS = [
  {
    name: "compact",
    description: "Compact the conversation context",
  },
  { name: "clear", description: "Clear the transcript" },
  { name: "mode", description: "Switch operating mode", input: { hint: "mode id" } },
  { name: "help", description: "Show available commands" },
];
