/**
 * Agent Client Protocol (ACP) v1 type definitions.
 *
 * Reference: https://agentclientprotocol.com/protocol/v1/overview
 *
 * These types cover the full v1 surface: initialization, sessions, the prompt
 * turn lifecycle (including session/update variants), tool calls, permissions,
 * content blocks, plans, slash commands, modes, and the client-side filesystem
 * / terminal methods.
 */

/** Protocol (major) version negotiated during `initialize`. */
export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 envelope
// ---------------------------------------------------------------------------

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: T;
}

export interface JsonRpcNotification<T = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: T;
}

export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: JsonRpcError;
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

// ---------------------------------------------------------------------------
// Implementation info
// ---------------------------------------------------------------------------

export interface ImplementationInfo {
  /** Programmatic name; display fallback if `title` is absent. */
  name: string;
  /** Human-readable title optimized for UI display. */
  title?: string;
  /** Version of the implementation. */
  version?: string;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export interface ClientCapabilities {
  fs?: {
    readTextFile?: boolean;
    writeTextFile?: boolean;
  };
  terminal?: boolean;
}

export interface PromptCapabilities {
  image?: boolean;
  audio?: boolean;
  embeddedContext?: boolean;
}

export interface McpCapabilities {
  http?: boolean;
  sse?: boolean;
}

export interface AuthCapabilities {
  /** `logout` method availability. `{}` means supported. */
  logout?: Record<string, never> | null;
}

export interface SessionCapabilities {
  /** `session/delete` availability. */
  delete?: Record<string, never> | null;
  /** `additionalDirectories` support on lifecycle requests. */
  additionalDirectories?: Record<string, never> | null;
  /** `session/list` availability. */
  list?: Record<string, never> | null;
  /** `session/resume` availability. */
  resume?: Record<string, never> | null;
  /** `session/close` availability. */
  close?: Record<string, never> | null;
}

export interface AgentCapabilities {
  /** `session/load` method availability. */
  loadSession?: boolean;
  promptCapabilities?: PromptCapabilities;
  mcpCapabilities?: McpCapabilities;
  auth?: AuthCapabilities;
  sessionCapabilities?: SessionCapabilities;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export type AuthMethodType = "agent";

export interface AuthMethod {
  id: string;
  name: string;
  description?: string;
  /** Defaults to `"agent"` when omitted. */
  type?: AuthMethodType;
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

export interface InitializeParams {
  protocolVersion: number;
  clientCapabilities?: ClientCapabilities;
  clientInfo?: ImplementationInfo;
}

export interface InitializeResult {
  protocolVersion: number;
  agentCapabilities?: AgentCapabilities;
  agentInfo?: ImplementationInfo;
  authMethods?: AuthMethod[];
}

// ---------------------------------------------------------------------------
// MCP servers
// ---------------------------------------------------------------------------

export interface McpEnvVar {
  name: string;
  value: string;
}

export interface McpHttpHeader {
  name: string;
  value: string;
}

export interface StdioMcpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: McpEnvVar[];
}

export interface HttpMcpServerConfig {
  type: "http";
  name: string;
  url: string;
  headers?: McpHttpHeader[];
}

export interface SseMcpServerConfig {
  type: "sse";
  name: string;
  url: string;
  headers?: McpHttpHeader[];
}

export type McpServerConfig =
  | StdioMcpServerConfig
  | HttpMcpServerConfig
  | SseMcpServerConfig;

// ---------------------------------------------------------------------------
// session/new, session/load, session/resume
// ---------------------------------------------------------------------------

export interface SessionNewParams {
  cwd: string;
  mcpServers?: McpServerConfig[];
  /** Requires `sessionCapabilities.additionalDirectories`. */
  additionalDirectories?: string[];
}

export interface SessionLoadParams {
  sessionId: string;
  cwd: string;
  mcpServers?: McpServerConfig[];
  additionalDirectories?: string[];
}

export type SessionResumeParams = SessionLoadParams;

export interface SessionSetupResult {
  sessionId: string;
  /** Available operating modes (session-modes). */
  modes?: SessionModeState;
}

export interface SessionCloseParams {
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Session modes
// ---------------------------------------------------------------------------

export interface SessionMode {
  id: string;
  name: string;
  description?: string;
}

export interface SessionModeState {
  currentModeId: string;
  availableModes: SessionMode[];
}

export interface SessionSetModeParams {
  sessionId: string;
  modeId: string;
}

// ---------------------------------------------------------------------------
// session/list, session/delete
// ---------------------------------------------------------------------------

export interface SessionListParams {
  cwd?: string;
  cursor?: string;
}

export interface SessionInfo {
  sessionId: string;
  cwd: string;
  /** Requires `sessionCapabilities.additionalDirectories`. */
  additionalDirectories?: string[];
  title?: string | null;
  updatedAt?: string | null;
  _meta?: Record<string, unknown>;
}

export interface SessionListResult {
  sessions: SessionInfo[];
  nextCursor?: string;
}

export interface SessionDeleteParams {
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Content blocks
// ---------------------------------------------------------------------------

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface AudioContent {
  type: "audio";
  data: string;
  mimeType: string;
}

export interface TextResourceContents {
  uri: string;
  text: string;
  mimeType?: string;
}

export interface BlobResourceContents {
  uri: string;
  blob: string;
  mimeType?: string;
}

export type ResourceContents = TextResourceContents | BlobResourceContents;

export interface ResourceContent {
  type: "resource";
  resource: ResourceContents;
}

export interface ResourceLinkContent {
  type: "resource_link";
  uri: string;
  name: string;
  mimeType?: string;
  title?: string;
  description?: string;
  size?: number;
}

export type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceContent
  | ResourceLinkContent;

// ---------------------------------------------------------------------------
// session/prompt
// ---------------------------------------------------------------------------

export interface SessionPromptParams {
  sessionId: string;
  prompt: ContentBlock[];
}

export type StopReason =
  | "end_turn"
  | "max_tokens"
  | "max_turns"
  | "refusal"
  | "cancelled";

export interface SessionPromptResult {
  stopReason: StopReason;
}

// ---------------------------------------------------------------------------
// session/cancel
// ---------------------------------------------------------------------------

export interface SessionCancelParams {
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type PlanPriority = "high" | "medium" | "low";
export type PlanStatus = "pending" | "in_progress" | "completed";

export interface PlanEntry {
  content: string;
  priority?: PlanPriority;
  status?: PlanStatus;
}

// ---------------------------------------------------------------------------
// Tool calls
// ---------------------------------------------------------------------------

export type ToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "switch_mode"
  | "other";

export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

/** A file location the Agent is working with ("follow-along"). */
export interface ToolLocation {
  path: string;
  line?: number;
}

export type ToolCallContent =
  | { type: "content"; content: ContentBlock }
  | { type: "diff"; path: string; oldText: string | null; newText: string }
  | { type: "terminal"; terminalId: string };

// ---------------------------------------------------------------------------
// session/update notification variants
// ---------------------------------------------------------------------------

export interface AgentMessageChunkUpdate {
  sessionUpdate: "agent_message_chunk";
  messageId?: string;
  content: ContentBlock;
}

/**
 * Agent reasoning/thought streaming (used by e.g. Kimi Code).
 *
 * Not part of the original v1 overview doc set, but emitted by real agents as a
 * `session/update` variant. Treated like a message chunk but rendered as a
 * distinct "thought" block so it can be styled differently.
 */
export interface AgentThoughtChunkUpdate {
  sessionUpdate: "agent_thought_chunk";
  messageId?: string;
  content: ContentBlock;
}

export interface UserMessageChunkUpdate {
  sessionUpdate: "user_message_chunk";
  messageId?: string;
  content: ContentBlock;
}

export interface PlanUpdate {
  sessionUpdate: "plan";
  entries: PlanEntry[];
}

export interface ToolCallUpdate {
  sessionUpdate: "tool_call";
  toolCallId: string;
  title?: string;
  kind?: ToolKind;
  status?: ToolCallStatus;
  content?: ToolCallContent[];
  locations?: ToolLocation[];
  rawInput?: unknown;
  rawOutput?: unknown;
}

export interface ToolCallStatusUpdate {
  sessionUpdate: "tool_call_update";
  toolCallId: string;
  title?: string;
  kind?: ToolKind;
  status?: ToolCallStatus;
  content?: ToolCallContent[];
  locations?: ToolLocation[];
  rawInput?: unknown;
  rawOutput?: unknown;
}

export interface UsageUpdate {
  sessionUpdate: "usage_update";
  used: number;
  size: number;
  cost?: { amount: number; currency: string };
}

export interface AvailableCommandInput {
  hint?: string;
}

export interface AvailableCommand {
  name: string;
  description?: string;
  input?: AvailableCommandInput;
}

export interface AvailableCommandsUpdate {
  sessionUpdate: "available_commands_update";
  availableCommands: AvailableCommand[];
}

export interface CurrentModeUpdate {
  sessionUpdate: "current_mode_update";
  modeId: string;
}

export interface SessionInfoUpdate {
  sessionUpdate: "session_info_update";
  title?: string | null;
  updatedAt?: string | null;
  _meta?: Record<string, unknown>;
}

export type SessionUpdate =
  | AgentMessageChunkUpdate
  | AgentThoughtChunkUpdate
  | UserMessageChunkUpdate
  | PlanUpdate
  | ToolCallUpdate
  | ToolCallStatusUpdate
  | UsageUpdate
  | AvailableCommandsUpdate
  | CurrentModeUpdate
  | SessionInfoUpdate;

export interface SessionUpdateParams {
  sessionId: string;
  update: SessionUpdate;
}

// ---------------------------------------------------------------------------
// session/request_permission
// ---------------------------------------------------------------------------

export type PermissionOptionKind =
  | "allow_once"
  | "allow_always"
  | "reject_once"
  | "reject_always";

export interface PermissionOption {
  optionId: string;
  name: string;
  kind?: PermissionOptionKind;
}

export interface RequestPermissionParams {
  sessionId: string;
  toolCall: Partial<ToolCallUpdate> & { toolCallId: string };
  options: PermissionOption[];
}

export interface PermissionOutcome {
  outcome:
    | "cancelled"
    | "selected";
  optionId?: string;
}

export interface RequestPermissionResult {
  outcome: PermissionOutcome;
}

// ---------------------------------------------------------------------------
// Client filesystem methods
// ---------------------------------------------------------------------------

export interface FsReadTextFileParams {
  sessionId: string;
  path: string;
  line?: number;
  limit?: number;
}

export interface FsReadTextFileResult {
  content: string;
}

export interface FsWriteTextFileParams {
  sessionId: string;
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Client terminal methods
// ---------------------------------------------------------------------------

export interface TerminalCreateParams {
  sessionId: string;
  command: string;
  cwd: string;
}

export interface TerminalCreateResult {
  terminalId: string;
}

export interface TerminalOutputParams {
  sessionId: string;
  terminalId: string;
}

export interface TerminalOutputResult {
  output: string;
  exitStatus: number | null;
}

export interface TerminalWaitForExitParams {
  sessionId: string;
  terminalId: string;
}

export interface TerminalWaitForExitResult {
  exitStatus: number;
}

export interface TerminalReleaseParams {
  sessionId: string;
  terminalId: string;
}

export interface TerminalKillParams {
  sessionId: string;
  terminalId: string;
}

// ---------------------------------------------------------------------------
// ACP method / notification names
// ---------------------------------------------------------------------------

export const AcpMethod = {
  Initialize: "initialize",
  Authenticate: "authenticate",
  Logout: "logout",
  SessionNew: "session/new",
  SessionLoad: "session/load",
  SessionResume: "session/resume",
  SessionClose: "session/close",
  SessionPrompt: "session/prompt",
  SessionSetMode: "session/set_mode",
  SessionList: "session/list",
  SessionDelete: "session/delete",
} as const;

export const AcpNotification = {
  SessionCancel: "session/cancel",
  SessionUpdate: "session/update",
} as const;

/** Methods invoked by the Agent on the Client. */
export const AcpServerMethod = {
  SessionRequestPermission: "session/request_permission",
  FsReadTextFile: "fs/read_text_file",
  FsWriteTextFile: "fs/write_text_file",
  TerminalCreate: "terminal/create",
  TerminalOutput: "terminal/output",
  TerminalWaitForExit: "terminal/wait_for_exit",
  TerminalRelease: "terminal/release",
  TerminalKill: "terminal/kill",
} as const;
