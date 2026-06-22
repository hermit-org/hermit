import {
  FileText,
  FilePenLine,
  Trash2,
  FolderInput,
  Search,
  SquareTerminal,
  BrainCog,
  Globe,
  ArrowLeftRight,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ToolKind } from "@/components/domain";

/** Accent metadata for each tool kind: icon + tailwind tone + i18n label key. */
export interface ToolKindMeta {
  Icon: LucideIcon;
  /** Tailwind text-* class applied to the icon. */
  tone: string;
  /** i18n key fragment under `tool.kind.*`. */
  labelKey: string;
}

export const TOOL_KIND_META: Record<ToolKind, ToolKindMeta> = {
  read: { Icon: FileText, tone: "text-blue-500", labelKey: "read" },
  edit: { Icon: FilePenLine, tone: "text-amber-500", labelKey: "edit" },
  delete: { Icon: Trash2, tone: "text-rose-500", labelKey: "delete" },
  move: { Icon: FolderInput, tone: "text-violet-500", labelKey: "move" },
  search: { Icon: Search, tone: "text-sky-500", labelKey: "search" },
  execute: {
    Icon: SquareTerminal,
    tone: "text-emerald-600 dark:text-emerald-400",
    labelKey: "execute",
  },
  think: { Icon: BrainCog, tone: "text-purple-500", labelKey: "think" },
  fetch: { Icon: Globe, tone: "text-cyan-500", labelKey: "fetch" },
  switch_mode: {
    Icon: ArrowLeftRight,
    tone: "text-indigo-500",
    labelKey: "switch_mode",
  },
  other: {
    Icon: Wrench,
    tone: "text-muted-foreground",
    labelKey: "other",
  },
};

/** Resolve meta for an arbitrary (possibly missing) kind; falls back to `other`. */
export function getKindMeta(kind?: string): ToolKindMeta {
  if (kind && kind in TOOL_KIND_META) {
    return TOOL_KIND_META[kind as ToolKind];
  }
  return TOOL_KIND_META.other;
}
