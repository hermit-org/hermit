import * as React from "react";
import { useTranslation } from "react-i18next";
import { TerminalSquare, MessageSquare, Columns2, Rows2 } from "lucide-react";
import { ChatArea } from "@/components/organisms/chat-area";
import { TerminalPanel } from "@/components/organisms/terminal-panel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MOCK_CHAT_ITEMS, MOCK_TERMINAL } from "./mock-data";

export interface SplitLayoutProps {
  /** Split orientation. Defaults to "horizontal" (side by side). */
  orientation?: "horizontal" | "vertical";
  /** Children to render in the chat pane instead of mock data. */
  children?: React.ReactNode;
  /** Terminal children to render instead of mock data. */
  terminal?: React.ReactNode;
  /** Initial split percentage for the first pane (0..100). */
  split?: number;
  className?: string;
}

/**
 * Split layout template: chat area + terminal panel arranged side by side or
 * stacked, with a draggable divider placeholder and orientation toggle.
 *
 * @example
 * <SplitLayout orientation="horizontal" />
 */
export function SplitLayout({
  orientation = "horizontal",
  children,
  terminal,
  split = 60,
  className,
}: SplitLayoutProps): React.JSX.Element {
  const { t } = useTranslation();
  const [orient, setOrient] = React.useState(orientation);
  const [pct, setPct] = React.useState(split);
  const draggingRef = React.useRef(false);

  const onPointerDown = React.useCallback(() => {
    draggingRef.current = true;
    document.body.style.cursor =
      orient === "horizontal" ? "col-resize" : "row-resize";
  }, [orient]);

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const parent = dividerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const ratio =
        orient === "horizontal"
          ? ((e.clientX - rect.left) / rect.width) * 100
          : ((e.clientY - rect.top) / rect.height) * 100;
      setPct(Math.min(85, Math.max(15, ratio)));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [orient]);

  const dividerRef = React.useRef<HTMLDivElement>(null);

  const isH = orient === "horizontal";

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">{t("layout.chat")}</span>
        <TerminalSquare className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">{t("layout.terminal")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto h-6 w-6"
              aria-label={t("layout.toggleOrientation")}
              onClick={() => setOrient((o) => (o === "horizontal" ? "vertical" : "horizontal"))}
            >
              {isH ? <Rows2 className="h-3.5 w-3.5" /> : <Columns2 className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(isH ? "layout.stacked" : "layout.sideBySide")}
          </TooltipContent>
        </Tooltip>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1",
          !isH && "flex-col",
        )}
      >
        <div
          style={isH ? { width: `${pct}%` } : { height: `${pct}%` }}
          className="min-h-0 min-w-0"
        >
          {children ?? <ChatArea items={MOCK_CHAT_ITEMS} />}
        </div>

        <div
          ref={dividerRef}
          onPointerDown={onPointerDown}
          className={cn(
            "group relative shrink-0 bg-border",
            isH ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
          )}
        >
          <div
            className={cn(
              "absolute bg-primary/0 transition-colors group-hover:bg-primary/20",
              isH
                ? "inset-y-0 -left-1 -right-1"
                : "inset-x-0 -top-1 -bottom-1",
            )}
          />
        </div>

        <div
          style={isH ? { width: `${100 - pct}%` } : { height: `${100 - pct}%` }}
          className="min-h-0 min-w-0"
        >
          {terminal ?? <TerminalPanel session={MOCK_TERMINAL} />}
        </div>
      </div>
    </div>
  );
}
