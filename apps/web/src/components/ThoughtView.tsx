import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrainCog } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface ThoughtViewProps {
  content: string;
  /** When true (a prompt turn is in flight) the thought shows a line-clamped
   * preview. When false it collapses to the header bar by default. */
  busy: boolean;
  /** Max lines shown in the busy preview. Default 4. */
  maxLines?: number;
}

type ViewMode = "preview" | "collapsed" | "expanded";

/**
 * Renders an agent "thought" / reasoning block.
 *
 * Display rules:
 *  - While the turn is busy: show up to `maxLines` lines (default 4) as a
 *    preview so the user can follow along without the block dominating the
 *    view.
 *  - Once the turn completes: collapse to just the header bar.
 *  - The user can always toggle between collapsed / expanded manually; the
 *    auto state resets whenever `busy` transitions.
 */
export function ThoughtView({
  content,
  busy,
  maxLines = 4,
}: ThoughtViewProps): React.JSX.Element {
  const { t } = useTranslation();
  // Auto mode follows busy; a non-null `manual` overrides it until busy
  // changes again.
  const [manual, setManual] = useState<ViewMode | null>(null);

  const autoMode: ViewMode = busy ? "preview" : "collapsed";
  const mode: ViewMode = manual ?? autoMode;

  // Reset manual override whenever the busy state flips.
  useEffect(() => {
    setManual(null);
  }, [busy]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(22);
  const [overflows, setOverflows] = useState(false);
  const previewHeight = lineHeight * maxLines;

  // Measure rendered line-height for an accurate clamp, and re-measure on
  // resize / theme / font changes so the preview height stays accurate.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      const lh = parseFloat(window.getComputedStyle(el).lineHeight);
      if (Number.isFinite(lh) && lh > 0) setLineHeight(lh);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  // Detect whether content exceeds the preview height.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > previewHeight + 1);
  }, [content, previewHeight]);

  const showToggle = overflows || mode !== "collapsed";
  const maxHeight =
    mode === "expanded" ? undefined : mode === "preview" ? previewHeight : 0;

  return (
    <div style={styles.thought}>
      <div style={styles.header}>
        <BrainCog size={14} style={styles.icon} />
        <span style={styles.label}>{t("common.thinking")}</span>
        {busy && <span style={styles.dots}>…</span>}
      </div>
      <div
        ref={bodyRef}
        style={{ maxHeight, overflow: "hidden" }}
        aria-hidden={mode === "collapsed"}
      >
        <MarkdownRenderer content={content} />
      </div>
      {showToggle && (
        <button
          style={styles.toggle}
          onClick={() =>
            setManual((m) =>
              m === "expanded" ? "collapsed" : "expanded",
            )
          }
        >
          {mode === "expanded" ? t("common.collapse") : t("common.expand")}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  thought: {
    margin: "6px 12px",
    padding: "8px 12px",
    backgroundColor: "#f6f7f9",
    borderLeft: "3px solid #c8c8d0",
    borderRadius: "0 8px 8px 0",
    color: "#777",
    fontSize: 13,
    opacity: 0.9,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  icon: {
    color: "#8a8a94",
    flexShrink: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#8a8a94",
  },
  dots: {
    color: "#007AFF",
    fontWeight: 700,
  },
  toggle: {
    marginTop: 4,
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12,
    color: "#007AFF",
    cursor: "pointer",
    fontWeight: 600,
  },
};
