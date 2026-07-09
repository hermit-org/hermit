/**
 * UI-layer domain types for the ACP client.
 *
 * These extend / re-export the protocol types from `@hermit-org/acp` with the
 * small amount of view-model state the components need (tags, connection
 * states, accumulated tool-call state, etc.). Keeping them here avoids a
 * circular dependency between `@hermit-org/acp` and platform UIs.
 */

import type {
  ToolCallUpdate,
  ToolCallStatusUpdate,
  ToolCallContent,
  ToolCallStatus,
  ToolKind,
  SessionMode,
  ContentBlock,
  PermissionOption,
  PlanEntry,
  PlanStatus,
} from "@hermit-org/acp";

/** Re-exported so components import a single source of truth. */
export type {
  ToolCallStatus,
  ToolKind,
  ToolCallContent,
  ContentBlock,
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
  /** Color token, e.g. "blue" | "green" | "amber" | "rose". */
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

/** A pending permission request awaiting a user decision. */
export interface PendingPermission {
  id: string;
  sessionId: string | null;
  toolCall: Partial<ToolCallUpdate> & { toolCallId: string };
  options: PermissionOption[];
  createdAt: number;
}

/** A previously-answered permission request, for history display. */
export interface AnsweredPermissionView {
  id: string;
  question: string;
  /** The selected option's display name. `undefined` when the user skipped/cancelled. */
  answer?: string;
  note?: string;
  /** Whether the user dismissed the question without answering. */
  cancelled?: boolean;
  at: number;
}

/** Token usage stats for a turn / session. */
export interface UsageStats {
  used: number;
  size: number;
  cost?: { amount: number; currency: string };
}

/** A renderable item in the chat transcript. */
export type ChatItem =
  | {
      kind: "message";
      key: string;
      role: "user" | "assistant" | "system";
      content: string;
      streaming?: boolean;
      pending?: boolean;
      authorName?: string;
      createdAt: number;
      /** ACP messageId — used to merge consecutive chunks of the same message. */
      messageId?: string;
      /** Images attached to a user message (base64 + mimeType, no preview URL). */
      images?: { data: string; mimeType: string }[];
    }
  | {
      kind: "tool_call";
      key: string;
      call: ToolCallState;
      createdAt: number;
    }
  | {
      kind: "thought";
      key: string;
      content: string;
      streaming?: boolean;
      messageId?: string;
    }
  | {
      kind: "divider";
      key: string;
      /** Label text for the divider (e.g. "Switched to Agent B"). */
      label: string;
      createdAt: number;
    };

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
