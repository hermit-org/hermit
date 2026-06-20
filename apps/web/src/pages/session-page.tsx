import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { ChatArea, type ChatItem } from "@/components/organisms/chat-area";
import { MessageComposerPanel } from "@/components/organisms/message-composer-panel";
import { SessionInfoBar } from "@/components/molecules/session-info-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/atoms";
import type { AvailableCommand } from "@hermit/acp";
import type { SessionTag, UsageStats } from "@/components/domain";

export interface SessionPageProps {
  /** Session id (route param). */
  sessionId: string;
  /** Loading state while the session history loads. */
  loading?: boolean;
  /** Error message if loading failed. */
  error?: string | null;
  /** Session title. */
  title?: string;
  /** Session tags. */
  tags?: SessionTag[];
  /** Ordered transcript items. */
  items: ChatItem[];
  /** Current draft text. */
  draft: string;
  /** Available slash commands. */
  commands?: AvailableCommand[];
  /** Whether a turn is streaming. */
  busy?: boolean;
  /** Latest usage stats. */
  usage?: UsageStats;
  /** Agent display name. */
  assistantName?: string;
  /** Update the draft. */
  onDraftChange: (value: string) => void;
  /** Submit a prompt. */
  onPrompt: (value: string) => void;
  /** Cancel the current turn. */
  onCancel?: () => void;
  /** Rename the session. */
  onRename?: (title: string) => void;
  /** Quick-command handler. */
  onQuickCommand?: (command: AvailableCommand) => void;
  /** Navigate back to the session list. */
  onBack?: () => void;
}

/**
 * Single-session page: loads the session history, renders the transcript and
 * composer, and handles prompt / cancel / turn lifecycle. Handles loading,
 * error, and empty states.
 *
 * @example
 * <SessionPage sessionId="s1" items={items} draft={draft} onDraftChange={setDraft} onPrompt={prompt} />
 */
export function SessionPage({
  sessionId,
  loading,
  error,
  title = "New session",
  tags = [],
  items,
  draft,
  commands = [],
  busy,
  usage,
  assistantName,
  onDraftChange,
  onPrompt,
  onCancel,
  onRename,
  onQuickCommand,
  onBack,
}: SessionPageProps): React.JSX.Element {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center gap-1">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back to sessions"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <SessionInfoBar title={title} tags={tags} onRename={onRename} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {loading ? (
          <EmptyState title="Loading session…" />
        ) : error ? (
          <EmptyState
            title="Failed to load session"
            description={error}
            action={
              onBack ? (
                <Button variant="outline" onClick={onBack}>
                  Back
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ChatArea items={items} assistantName={assistantName} />
        )}
      </div>

      <MessageComposerPanel
        value={draft}
        onChange={onDraftChange}
        onSubmit={onPrompt}
        onCancel={onCancel}
        busy={busy}
        disabled={loading || !!error}
        commands={commands}
        onQuickCommand={onQuickCommand}
      />
    </div>
  );
}
