import * as React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./shell";
import { CodeBlock, RawBlock } from "./parts";
import { asObject, firstString, getNumber, renderRaw } from "./helpers";

/** Reconstruct a command string from rawInput { command, args } or rawInput.command. */
function buildCommand(input: Record<string, unknown> | null): string | undefined {
  const cmd = firstString(input, "command", "cmd", "tool");
  if (!cmd) return firstString(input, "shellCommand", "script");
  const args = input?.args;
  if (Array.isArray(args)) {
    const joined = args
      .map((a) => (typeof a === "string" ? a : String(a)))
      .join(" ");
    return joined ? `${cmd} ${joined}` : cmd;
  }
  return cmd;
}

/**
 * Specialized renderer for `execute` tool calls. Shows the command in the
 * header; reveals the command line, terminal output, and an exit-code badge.
 */
export function ExecuteTool({
  call,
}: {
  call: ToolCallState;
}): React.JSX.Element {
  const { t } = useTranslation();
  const input = asObject(call.rawInput);
  const output = asObject(call.rawOutput);
  const command = buildCommand(input);
  const cwd = firstString(input, "cwd", "workingDirectory", "dir");
  const exitCode = getNumber(output, "exitCode");
  const outputText =
    firstString(output, "output", "stdout", "result", "text") ??
    renderRaw(call.rawOutput);

  // Terminal content blocks reference a live terminal; surface its id.
  const terminalIds = call.content
    .filter(
      (c): c is Extract<typeof c, { type: "terminal" }> => c.type === "terminal",
    )
    .map((c) => c.terminalId);

  // Plain text output from content blocks.
  const textOutput = call.content
    .filter(
      (c): c is Extract<typeof c, { type: "content" }> =>
        c.type === "content" && c.content.type === "text",
    )
    .map((c) => (c.content as { text: string }).text)
    .join("\n");

  const rawInput = renderRaw(call.rawInput);
  const rawOutput = renderRaw(call.rawOutput);
  const hasBody =
    !!command ||
    !!outputText ||
    !!textOutput ||
    terminalIds.length > 0 ||
    !!rawInput ||
    !!rawOutput ||
    call.content.length > 0;

  const exitBadge =
    exitCode !== undefined ? (
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 border-transparent px-1.5 py-0 text-[10px] font-semibold",
          exitCode === 0
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/10 text-rose-700 dark:text-rose-300",
        )}
      >
        {t("tool.execute.exitCode")} {exitCode}
      </Badge>
    ) : null;

  const summary = (
    <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
      {command ? (
        <code className="max-w-[16rem] truncate rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
          {command}
        </code>
      ) : null}
      {exitBadge}
    </span>
  );

  return (
    <ToolCallShell call={call} summary={summary} hasBody={hasBody}>
      {command ? (
        <div className="overflow-hidden rounded-md border border-border bg-secondary/60">
          <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2 py-1">
            <span className="select-none font-mono text-xs text-emerald-600 dark:text-emerald-400">
              $
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs">
              {command}
            </code>
          </div>
          {cwd ? (
            <div className="px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {cwd}
            </div>
          ) : null}
        </div>
      ) : null}
      {terminalIds.length > 0 ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          {terminalIds.map((id) => (
            <div key={id}>
              {t("terminal.idLabel", { id })}
            </div>
          ))}
        </div>
      ) : null}
      {textOutput ? (
        <CodeBlock value={textOutput} label={t("tool.execute.output")} />
      ) : null}
      {outputText && !textOutput ? (
        <CodeBlock value={outputText} label={t("tool.execute.output")} />
      ) : null}
      {rawInput ? <RawBlock label={t("tool.input")} value={rawInput} /> : null}
      {rawOutput ? <RawBlock label={t("tool.output")} value={rawOutput} /> : null}
    </ToolCallShell>
  );
}
