import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import i18n from "../i18n";

/**
 * Merge Tailwind CSS class names conditionally.
 *
 * Combines `clsx` (conditional classes) with `tailwind-merge` (conflict
 * resolution) so later classes override earlier ones.
 *
 * @example
 * cn("px-2", isActive && "bg-primary", "px-4") // => "bg-primary px-4"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a byte count into a human-readable file size string. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Format a number with thousands separators. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

/** Format a cost amount with currency. */
export function formatCost(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: amount < 0.01 ? 4 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(4)} ${currency}`;
  }
}

/** Format a Unix epoch (ms) or ISO string as a relative "time ago" string. */
export function formatRelativeTime(
  input: number | string | Date,
  now: number = Date.now(),
): string {
  const time =
    typeof input === "number"
      ? input
      : typeof input === "string"
        ? new Date(input).getTime()
        : input.getTime();
  const diff = now - time;
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 45) return i18n.t("common.justNow");
  if (min < 60) return i18n.t("common.minutesAgo", { count: min });
  if (hr < 24) return i18n.t("common.hoursAgo", { count: hr });
  if (day < 7) return i18n.t("common.daysAgo", { count: day });
  return new Date(time).toLocaleDateString();
}
