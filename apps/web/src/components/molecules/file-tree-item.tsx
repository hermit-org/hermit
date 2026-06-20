import * as React from "react";
import { ChevronRight, MoreHorizontal, FileEdit, Download } from "lucide-react";
import { FileIcon } from "@/components/atoms";
import { cn, formatBytes } from "@/lib/utils";
import type { FileNode } from "@/components/domain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FileTreeItemProps {
  /** The file/directory node. */
  node: FileNode;
  /** Current depth (controls indentation). */
  depth?: number;
  /** Whether a directory is expanded. */
  expanded?: boolean;
  /** Whether this node is selected. */
  selected?: boolean;
  /** Toggle directory expansion. */
  onToggle?: (node: FileNode) => void;
  /** Select / open a file. */
  onSelect?: (node: FileNode) => void;
  /** Edit a file. */
  onEdit?: (node: FileNode) => void;
  /** Download a file. */
  onDownload?: (node: FileNode) => void;
  className?: string;
}

/**
 * A single file-tree row (directory toggle or file open) with a kebab menu.
 *
 * @example
 * <FileTreeItem node={node} depth={0} expanded onSelect={open} />
 */
export function FileTreeItem({
  node,
  depth = 0,
  expanded,
  selected,
  onToggle,
  onSelect,
  onEdit,
  onDownload,
  className,
}: FileTreeItemProps): React.JSX.Element {
  const isDir = node.isDirectory;
  return (
    <div
      role="treeitem"
      aria-expanded={isDir ? expanded : undefined}
      aria-selected={selected}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      className={cn(
        "group flex items-center gap-1.5 rounded-sm py-1 pr-1.5 text-sm",
        "hover:bg-accent focus-within:bg-accent",
        selected && "bg-accent",
        className,
      )}
    >
      {isDir ? (
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => onToggle?.(node)}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <button
        type="button"
        onClick={() => (isDir ? onToggle?.(node) : onSelect?.(node))}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <FileIcon
          name={node.name}
          isDirectory={isDir}
          expanded={expanded}
          size={15}
        />
        <span className="truncate">{node.name}</span>
        {!isDir && node.size !== undefined ? (
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {formatBytes(node.size)}
          </span>
        ) : null}
      </button>
      {!isDir ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="File actions"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(node)}>
              <FileEdit />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload?.(node)}>
              <Download />
              Download
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
