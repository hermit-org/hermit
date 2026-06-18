import React, { useEffect, useRef, useState } from "react";
import type { ConfigOption } from "@hermit/acp";

interface ConfigChipProps {
  option: ConfigOption;
  icon: React.ReactNode;
  /** Called when the user picks a value; returns a promise so the chip can
   * show a transient "applying" state. */
  onSelect: (value: string) => Promise<void>;
}

/**
 * A status-bar chip for a `select`-type config option (model, mode,
 * thinking, …). Clicking it opens a small dropdown listing the available
 * choices; selecting one calls `onSelect`.
 *
 * For non-select options or options without a choices list, the chip is
 * purely informational (not clickable).
 */
export function ConfigChip({
  option,
  icon,
  onSelect,
}: ConfigChipProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const choices = option.type === "select" ? option.options ?? [] : [];
  const clickable = choices.length > 1;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = async (value: string) => {
    setOpen(false);
    if (value === option.currentValue) return;
    setApplying(true);
    try {
      await onSelect(value);
    } catch {
      // ignore — the value just won't update
    } finally {
      setApplying(false);
    }
  };

  return (
    <span ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          ...styles.chip,
          ...(clickable ? styles.chipClickable : {}),
        }}
        onClick={() => clickable && setOpen((o) => !o)}
        disabled={!clickable || applying}
        title={option.description ?? option.name}
      >
        {icon}
        <span style={styles.chipValue}>
          {applying ? "…" : formatValue(option.currentValue)}
        </span>
        {clickable && !applying && (
          <span style={styles.chevron}>{open ? "▴" : "▾"}</span>
        )}
      </button>

      {open && choices.length > 0 && (
        <div style={styles.dropdown}>
          {choices.map((choice) => {
            const active = choice.value === option.currentValue;
            return (
              <button
                key={choice.value}
                type="button"
                style={{
                  ...styles.option,
                  ...(active ? styles.optionActive : {}),
                }}
                onClick={() => handleSelect(choice.value)}
                title={choice.description}
              >
                <span style={styles.optionLabel}>
                  {choice.name ?? formatValue(choice.value)}
                </span>
                {active && <span style={styles.check}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

/** Shorten long model-style values like `kimi-code/kimi-for-coding`. */
function formatValue(value: string): string {
  const slashIndex = value.lastIndexOf("/");
  if (slashIndex >= 0 && slashIndex < value.length - 1) {
    return value.slice(slashIndex + 1);
  }
  return value;
}

const styles: Record<string, React.CSSProperties> = {
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#888",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    backgroundColor: "#f4f4f5",
    padding: "2px 8px",
    borderRadius: 10,
    border: "none",
    cursor: "default",
    maxWidth: "100%",
  },
  chipClickable: {
    cursor: "pointer",
    backgroundColor: "#eef4ff",
    color: "#0066cc",
  },
  chipValue: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chevron: {
    fontSize: 8,
    opacity: 0.6,
  },
  dropdown: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    marginBottom: 4,
    minWidth: 140,
    maxWidth: 260,
    backgroundColor: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    maxHeight: 240,
    overflowY: "auto",
    zIndex: 100,
  },
  option: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    padding: "7px 10px",
    border: "none",
    background: "none",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
    color: "#333",
  },
  optionActive: {
    backgroundColor: "#eef4ff",
    color: "#0066cc",
    fontWeight: 600,
  },
  optionLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  check: {
    color: "#007AFF",
    flexShrink: 0,
  },
};
