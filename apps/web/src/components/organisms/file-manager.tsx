import * as React from "react";
import { Save, RefreshCw, FolderOpen, FileWarning } from "lucide-react";
import { FileTreeItem } from "@/components/molecules";
import { EmptyState, Spinner } from "@/components/atoms";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/components/domain";

export interface FileManagerProps {
  /** Root nodes of the file tree. */
  tree: FileNode[];
  /** Currently open file path. */
  selectedPath?: string;
  /** Contents of the currently open file. */
  fileContent?: string;
  /** Loading state for the tree or file. */
  loading?: boolean;
  /** Whether the open file is dirty (unsaved). */
  dirty?: boolean;
  /** Read-only mode (no editing). */
  readOnly?: boolean;
  /** Set of expanded directory paths. */
  expandedPaths?: Set<string>;
  /** Toggle a directory open/closed. */
  onToggle?: (node: FileNode) => void;
  /** Open / select a file. */
  onSelectFile?: (node: FileNode) => void;
  /** Edit the file content. */
  onContentChange?: (content: string) => void;
  /** Save the file. */
  onSave?: () => void;
  /** Refresh the tree. */
  onRefresh?: () => void;
  className?: string;
}

/**
 * File manager: a file tree, a code/text preview/editor with syntax-styled
 * monospace rendering, and save/read actions.
 *
 * @example
 * <FileManager tree={tree} selectedPath="src/app.ts" fileContent={content} onSave={save} />
 */
export function FileManager({
  tree,
  selectedPath,
  fileContent,
  loading,
  dirty,
  readOnly,
  expandedPaths,
  onToggle,
  onSelectFile,
  onContentChange,
  onSave,
  onRefresh,
  className,
}: FileManagerProps): React.JSX.Element {
  const [localExpanded, setLocalExpanded] = React.useState<Set<string>>(
    () => expandedPaths ?? new Set(),
  );

  const expanded = expandedPaths ?? localExpanded;

  const handleToggle = React.useCallback(
    (node: FileNode) => {
      if (onToggle) {
        onToggle(node);
        return;
      }
      setLocalExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
    },
    [onToggle],
  );

  const renderNodes = (nodes: FileNode[], depth: number): React.ReactNode => {
    return nodes.map((node) => (
      <React.Fragment key={node.path}>
        <FileTreeItem
          node={node}
          depth={depth}
          expanded={expanded.has(node.path)}
          selected={node.path === selectedPath}
          onToggle={handleToggle}
          onSelect={onSelectFile}
          onEdit={onSelectFile}
        />
        {node.isDirectory && expanded.has(node.path) && node.children ? (
          <>{renderNodes(node.children, depth + 1)}</>
        ) : null}
      </React.Fragment>
    ));
  };

  return (
    <div className={cn("flex h-full", className)}>
      <div className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Files</span>
          {onRefresh ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto h-6 w-6"
              aria-label="Refresh"
              onClick={onRefresh}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          ) : null}
        </div>
        <ScrollArea className="flex-1">
          <div className="py-1">
            {tree.length === 0 ? (
              <EmptyState
                icon={FileWarning}
                title="No files"
                description="The working directory is empty."
                compact
              />
            ) : (
              renderNodes(tree, 0)
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedPath ? (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
              <span className="truncate font-mono text-xs">{selectedPath}</span>
              {dirty ? (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  unsaved
                </Badge>
              ) : null}
              {onSave && !readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7"
                  disabled={!dirty}
                  onClick={onSave}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              ) : null}
            </div>
            <div className="relative flex-1">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner size={20} />
                </div>
              ) : (
                <Textarea
                  value={fileContent ?? ""}
                  readOnly={readOnly}
                  onChange={(e) => onContentChange?.(e.target.value)}
                  className="h-full w-full resize-none rounded-none border-0 bg-secondary/20 p-3 font-mono text-xs shadow-none focus-visible:ring-0"
                  spellCheck={false}
                />
              )}
            </div>
          </>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="No file selected"
            description="Select a file from the tree to preview or edit."
          />
        )}
      </div>
    </div>
  );
}
