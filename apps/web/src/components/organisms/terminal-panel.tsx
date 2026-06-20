import * as React from "react";
import { TerminalSquare } from "lucide-react";
import { TerminalHeader } from "@/components/molecules";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TerminalSession } from "@/components/domain";

export interface TerminalPanelProps {
  /** The terminal session to display. */
  session: TerminalSession;
  /** Auto-scroll to bottom on new output (default true). */
  autoScroll?: boolean;
  /** Send raw input to the terminal stdin. */
  onInput?: (terminalId: string, data: string) => void;
  /** Kill the process. */
  onKill?: (terminalId: string) => void;
  /** Close / release the terminal. */
  onClose?: (terminalId: string) => void;
  className?: string;
}

/**
 * Terminal panel: header with process status, an auto-scrolling output stream
 * (scrolling up pauses auto-scroll), and a stdin input box.
 *
 * @example
 * <TerminalPanel session={term} onInput={send} onKill={kill} onClose={close} />
 */
export function TerminalPanel({
  session,
  autoScroll: autoScrollProp = true,
  onInput,
  onKill,
  onClose,
  className,
}: TerminalPanelProps): React.JSX.Element {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(autoScrollProp);
  const [draft, setDraft] = React.useState("");

  // Auto-scroll to the bottom whenever output grows, unless the user has
  // scrolled up (which sets autoScroll=false).
  React.useEffect(() => {
    if (!autoScroll) return;
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [session.output, autoScroll]);

  const handleScroll = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const threshold = 24;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAutoScroll(atBottom);
  }, []);

  const submitInput = React.useCallback(() => {
    const text = draft;
    if (!text) return;
    onInput?.(session.id, text.endsWith("\n") ? text : `${text}\n`);
    setDraft("");
  }, [draft, session.id, onInput]);

  return (
    <div className={cn("flex h-full flex-col bg-zinc-950", className)}>
      <TerminalHeader
        title={session.command}
        cwd={session.cwd}
        running={session.running}
        exitStatus={session.exitStatus}
        onKill={() => onKill?.(session.id)}
        onClose={() => onClose?.(session.id)}
      />
      <ScrollArea
        className="relative flex-1"
        viewportRef={viewportRef}
      >
        <pre
          onWheel={handleScroll}
          onTouchMove={handleScroll}
          className="whitespace-pre-wrap break-words p-2 font-mono text-xs leading-relaxed text-zinc-200"
        >
          {session.output || ""}
          {!session.output ? (
            <span className="text-zinc-500">
              Waiting for output…
            </span>
          ) : null}
        </pre>
      </ScrollArea>
      {!autoScroll ? (
        <div className="border-t border-zinc-800 bg-zinc-900 px-2 py-0.5 text-center text-[10px] text-zinc-500">
          Auto-scroll paused — scroll to bottom to resume
        </div>
      ) : null}
      {session.running && onInput ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitInput();
          }}
          className="flex items-center gap-1.5 border-t border-zinc-800 bg-zinc-900 p-1.5"
        >
          <TerminalSquare className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type and press Enter to send…"
            className="h-7 border-zinc-700 bg-zinc-950 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-600"
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      ) : null}
    </div>
  );
}
