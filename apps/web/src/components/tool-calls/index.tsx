import * as React from "react";
import type { ToolCallState, ToolKind } from "@/components/domain";
import { ReadTool } from "./ReadTool";
import { EditTool } from "./EditTool";
import { DeleteTool } from "./DeleteTool";
import { MoveTool } from "./MoveTool";
import { SearchTool } from "./SearchTool";
import { ExecuteTool } from "./ExecuteTool";
import { ThinkTool } from "./ThinkTool";
import { FetchTool } from "./FetchTool";
import { SwitchModeTool } from "./SwitchModeTool";
import { OtherTool } from "./OtherTool";

export { TOOL_KIND_META, getKindMeta, type ToolKindMeta } from "./meta";
export { ToolCallShell, type ToolCallShellProps } from "./Shell";
export {
  DiffView,
  CodeBlock,
  RawBlock,
  ContentBlockView,
  ToolCallContentItem,
  MetaRow,
} from "./Parts";

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
