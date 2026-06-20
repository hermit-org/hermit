/**
 * UI-layer domain types for the ACP client.
 *
 * These extend / re-export the protocol types from `@hermit/acp` with the
 * small amount of view-model state the components need (tags, connection
 * states, accumulated tool-call state, etc.). Keeping them here avoids a
 * circular dependency between `@hermit/acp` and the web UI.
 */

import type {
  ToolCallUpdate,
  ToolCallStatusUpdate,
  ToolCallContent,
  ToolCallStatus,
  ToolKind,
  McpServerConfig,
  SessionMode,
  ContentBlock,
  PermissionOption,
  PlanEntry,
  PlanStatus,
} from "@hermit/acp";

/** Re-exported so components import a single source of truth. */
export type {
  ToolCallStatus,
  ToolKind,
  ToolCallContent,
  ContentBlock,
  McpServerConfig,
  SessionMode,
  PermissionOption,
  PlanEntry,
  PlanStatus,
};

/** Connection lifecycle for the gateway/ACP transport. */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "negotiating"
  | "connected"
  | "error";

/** ACP session operating mode, normalized to a stable id set. */
export type SessionModeId = string;

/** A label attached to a session for filtering and color coding. */
export interface SessionTag {
  id: string;
  name: string;
  /** Tailwind text color token, e.g. "blue" | "green" | "amber" | "rose". */
  color: TagColor;
}

export type TagColor =
  | "blue"
  | "green"
  | "amber"
  | "rose"
  | "violet"
  | "slate";

/** A logical tool call accumulated from `tool_call` + `tool_call_update`. */
export interface ToolCallState {
  toolCallId: string;
  title?: string;
  kind?: ToolKind;
  status?: ToolCallStatus;
  content: ToolCallContent[];
  rawInput?: unknown;
  rawOutput?: unknown;
  locations: { path: string; line?: number }[];
}

/** A file/directory node in the file tree. */
export interface FileNode {
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  children?: FileNode[];
}

/** A running terminal session. */
export interface TerminalSession {
  id: string;
  command: string;
  cwd: string;
  /** Combined stdout/stderr output lines. */
  output: string;
  exitStatus: number | null;
  running: boolean;
}

/** Connection state of an MCP server as seen by the UI. */
export type McpConnectionState =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error";

/** A configured MCP server with UI-side connection state. */
export interface McpServerEntry {
  config: McpServerConfig;
  state: McpConnectionState;
  lastError?: string;
}

/** A pending permission request awaiting a user decision. */
export interface PendingPermission {
  id: string;
  sessionId: string;
  toolCall: Partial<ToolCallUpdate> & { toolCallId: string };
  options: PermissionOption[];
  createdAt: number;
}

/** A previously-answered permission request, for history display. */
export interface AnsweredPermissionView {
  id: string;
  question: string;
  answer: string;
  note?: string;
  at: number;
}

/** Token usage stats for a turn / session. */
export interface UsageStats {
  used: number;
  size: number;
  cost?: { amount: number; currency: string };
}

/**
 * Merge a tool_call / tool_call_update into accumulated state.
 *
 * Per the ACP spec, `content` items in updates are additive. However, some
 * agents stream the raw tool input as a growing text string, re-sending the
 * full accumulated value in each update. Text content blocks that are a
 * prefix-extension of the trailing text block replace it instead of
 * duplicating; everything else is appended.
 */
export function mergeToolCall(
  prev: ToolCallState | undefined,
  update: ToolCallUpdate | ToolCallStatusUpdate,
): ToolCallState {
  const base: ToolCallState = prev ?? {
    toolCallId: update.toolCallId,
    content: [],
    locations: [],
  };

  let content = base.content;
  if (update.content && update.content.length > 0) {
    content = [...base.content];
    for (const item of update.content) {
      const last = content[content.length - 1];
      if (
        item.type === "content" &&
        item.content.type === "text" &&
        last?.type === "content" &&
        last.content.type === "text"
      ) {
        const oldText = last.content.text;
        const newText = (item.content as { text: string }).text;
        if (
          newText.length >= oldText.length &&
          newText.startsWith(oldText)
        ) {
          content[content.length - 1] = item;
          continue;
        }
        if (
          oldText.length > newText.length &&
          oldText.startsWith(newText)
        ) {
          continue;
        }
      }
      content.push(item);
    }
  }

  return {
    toolCallId: update.toolCallId,
    title: update.title ?? base.title,
    kind: update.kind ?? base.kind,
    status: update.status ?? base.status,
    content,
    rawInput: update.rawInput ?? base.rawInput,
    rawOutput: update.rawOutput ?? base.rawOutput,
    locations: update.locations
      ? [...base.locations, ...update.locations]
      : base.locations,
  };
}
