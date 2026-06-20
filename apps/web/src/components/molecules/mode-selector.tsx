import * as React from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle, Compass, Code2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionMode } from "@/components/domain";

export interface ModeSelectorProps {
  /** Available operating modes (from session setup). */
  modes: SessionMode[];
  /** Currently selected mode id. */
  value: string;
  /** Fired when the user picks a different mode. */
  onChange: (modeId: string) => void;
  /** Disable the selector. */
  disabled?: boolean;
  /** Layout: segmented control or dropdown. Defaults to "segmented". */
  variant?: "segmented" | "dropdown";
  className?: string;
}

const MODE_ICON: Record<string, LucideIcon> = {
  ask: HelpCircle,
  architect: Compass,
  code: Code2,
};

/**
 * Mode selector (Ask / Architect / Code) backed by the ACP `session/setMode`.
 *
 * @example
 * <ModeSelector modes={modes} value="code" onChange={setMode} />
 */
export function ModeSelector({
  modes,
  value,
  onChange,
  disabled,
  variant = "segmented",
  className,
}: ModeSelectorProps): React.JSX.Element {
  const { t } = useTranslation();
  const ariaLabel = t("mode.sessionMode");
  if (variant === "dropdown") {
    return (
      <div className={cn("inline-flex", className)}>
        <select
          aria-label={ariaLabel}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {modes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5",
        disabled && "opacity-50",
        className,
      )}
    >
      {modes.map((m) => {
        const Icon = MODE_ICON[m.id];
        const selected = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={m.description ?? m.name}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
