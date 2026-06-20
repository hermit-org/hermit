import * as React from "react";
import {
  File,
  FileText,
  FileCode2,
  FileJson,
  FileImage,
  FileAudio,
  FileArchive,
  Folder,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileIconProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** File or directory name (used to pick the glyph by extension). */
  name: string;
  /** Whether the node is a directory. */
  isDirectory?: boolean;
  /** Whether a directory is currently expanded. */
  expanded?: boolean;
  /** Render size in pixels. */
  size?: number;
}

interface ExtMeta {
  Icon: LucideIcon;
  className: string;
}

const EXT_META: Record<string, ExtMeta> = {
  ts: { Icon: FileCode2, className: "text-blue-500" },
  tsx: { Icon: FileCode2, className: "text-blue-500" },
  js: { Icon: FileCode2, className: "text-yellow-500" },
  jsx: { Icon: FileCode2, className: "text-yellow-500" },
  json: { Icon: FileJson, className: "text-amber-500" },
  md: { Icon: FileText, className: "text-muted-foreground" },
  markdown: { Icon: FileText, className: "text-muted-foreground" },
  txt: { Icon: FileText, className: "text-muted-foreground" },
  png: { Icon: FileImage, className: "text-violet-500" },
  jpg: { Icon: FileImage, className: "text-violet-500" },
  jpeg: { Icon: FileImage, className: "text-violet-500" },
  gif: { Icon: FileImage, className: "text-violet-500" },
  webp: { Icon: FileImage, className: "text-violet-500" },
  svg: { Icon: FileImage, className: "text-violet-500" },
  mp3: { Icon: FileAudio, className: "text-rose-500" },
  wav: { Icon: FileAudio, className: "text-rose-500" },
  zip: { Icon: FileArchive, className: "text-orange-500" },
  gz: { Icon: FileArchive, className: "text-orange-500" },
};

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/**
 * File-type icon chosen by extension (or folder open/closed state).
 *
 * @example
 * <FileIcon name="app.tsx" />
 */
export function FileIcon({
  name,
  isDirectory,
  expanded,
  size = 16,
  className,
  ...props
}: FileIconProps): React.JSX.Element {
  let Icon: LucideIcon;
  let tone = "text-muted-foreground";
  if (isDirectory) {
    Icon = expanded ? FolderOpen : Folder;
    tone = "text-blue-500";
  } else {
    const meta = EXT_META[extOf(name)];
    Icon = meta ? meta.Icon : File;
    tone = meta?.className ?? tone;
  }
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      aria-hidden
      {...props}
    >
      <Icon style={{ width: size, height: size }} className={tone} />
    </span>
  );
}
