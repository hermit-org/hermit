import React, { useEffect, useRef, useState } from "react";
import type { AvailableCommand } from "@hermit/acp";

interface CommandSuggestProps {
  commands: AvailableCommand[];
  /** The current input value, used to detect the `/`-triggered query. */
  input: string;
  /** Called when the user picks a command; receives the completed `/name ` */
  onPick: (text: string) => void;
}

/**
 * Slash-command autocomplete that appears above the input box when the user
 * types `/`. The list is filtered by the partial token after `/`, and the user
 * can navigate with ArrowUp/ArrowDown and confirm with Tab/Enter.
 *
 * The component is purely presentational + keyboard handling; it renders
 * `null` when there is nothing to suggest.
 */
export function CommandSuggest({
  commands,
  input,
  onPick,
}: CommandSuggestProps): React.JSX.Element | null {
  const { active, query } = parseSlashInput(input);
  const filtered = active
    ? commands.filter((cmd) =>
        query.length === 0
          ? true
          : cmd.name.toLowerCase().startsWith(query.toLowerCase()),
      )
    : [];

  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset highlight whenever the filtered set changes.
  useEffect(() => {
    setHighlight(0);
  }, [query, commands.length]);

  // Keyboard handling is delegated from the textarea via a window listener,
  // but only while the popover is open to avoid stealing unrelated keys.
  useEffect(() => {
    if (filtered.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Tab") {
        // Tab confirms the highlighted command; Enter is left to the textarea
        // so users can still send a `/cmd` message with the return key.
        e.preventDefault();
        const cmd = filtered[highlight];
        if (cmd) onPick(`/${cmd.name} `);
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Closing is implicit: the caller can clear by appending a space.
        onPick(`${input} `);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [filtered, highlight, input, onPick]);

  if (filtered.length === 0) return null;

  return (
    <div ref={containerRef} style={styles.container}>
      <div style={styles.header}>Commands</div>
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          style={{
            ...styles.item,
            ...(i === highlight ? styles.itemActive : {}),
          }}
          onMouseEnter={() => setHighlight(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(`/${cmd.name} `);
          }}
          title={cmd.description}
        >
          <span style={styles.cmdName}>/{cmd.name}</span>
          {cmd.description && (
            <span style={styles.cmdDesc}>{cmd.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Detect whether the input is currently in a `/command`-completion context.
 * We treat the input as "active" when it starts with `/` and contains no
 * whitespace yet (i.e. the user is still typing the command name).
 */
function parseSlashInput(
  input: string,
): { active: boolean; query: string } {
  const match = input.match(/^\/(\S*)$/);
  if (match) return { active: true, query: match[1] };
  return { active: false, query: "" };
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    bottom: "100%",
    left: 12,
    right: 12,
    marginBottom: 4,
    backgroundColor: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    maxHeight: 220,
    overflowY: "auto",
    zIndex: 50,
  },
  header: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#999",
    padding: "6px 12px",
    borderBottom: "1px solid #f0f0f0",
  },
  item: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    width: "100%",
    padding: "8px 12px",
    border: "none",
    background: "none",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  itemActive: {
    backgroundColor: "#eef4ff",
  },
  cmdName: {
    fontSize: 14,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "#0066cc",
    fontWeight: 600,
  },
  cmdDesc: {
    fontSize: 12,
    color: "#888",
  },
};
