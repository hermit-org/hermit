import * as React from "react";
import type { ToolCallState, ToolKind } from "@/components/domain";
import { ReadTool } from "./read-tool";
import { EditTool } from "./edit-tool";
import { DeleteTool } from "./delete-tool";
import { MoveTool } from "./move-tool";
import { SearchTool } from "./search-tool";
import { ExecuteTool } from "./execute-tool";
import { ThinkTool } from "./think-tool";
import { FetchTool } from "./fetch-tool";
import { SwitchModeTool } from "./switch-mode-tool";
import { OtherTool } from "./other-tool";

export { TOOL_KIND_META, getKindMeta, type ToolKindMeta } from "./meta";
export {
  ToolCallShell,
  TimelineContext,
  type ToolCallShellProps,
} from "./shell";
export {
  DiffView,
  CodeBlock,
  RawBlock,
  ContentBlockView,
  ToolCallContentItem,
  MetaRow,
} from "./parts";

/** Maps each `ToolKind` to its specialized renderer component. */
export const TOOL_KIND_COMPONENTS: Record<
  ToolKind,
  React.ComponentType<{ call: ToolCallState }>
> = {
  read: ReadTool,
  edit: EditTool,
  delete: DeleteTool,
  move: MoveTool,
  search: SearchTool,
  execute: ExecuteTool,
  think: ThinkTool,
  fetch: FetchTool,
  switch_mode: SwitchModeTool,
  other: OtherTool,
};

export interface ToolCallRendererProps {
  /** Accumulated tool-call state. */
  call: ToolCallState;
  className?: string;
}

/**
 * Dispatch a `ToolCallState` to its specialized renderer based on `kind`.
 * Falls back to the generic `OtherTool` when the kind is missing or unknown.
 *
 * @example
 * <ToolCallRenderer call={item.call} />
 */
export function ToolCallRenderer({
  call,
  className,
}: ToolCallRendererProps): React.JSX.Element {
  const kind = call.kind;
  const Component =
    kind && kind in TOOL_KIND_COMPONENTS
      ? TOOL_KIND_COMPONENTS[kind as ToolKind]
      : OtherTool;
  return (
    <div className={className}>
      <Component call={call} />
    </div>
  );
}
