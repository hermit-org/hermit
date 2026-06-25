/**
 * Browser desktop-notification helpers.
 *
 * Uses the standard `Notification` API, which is supported by both Chrome and
 * Firefox. The legacy "HTML Notification" feature was removed from browsers
 * years ago, so `Notification.body` is plain text only — we send the assistant
 * reply (trimmed/previewed) as the notification body.
 */

/** Whether the Notifications API is available in the current environment. */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Current permission: "default" | "granted" | "denied" (or "" if unsupported). */
export function notificationPermission(): NotificationPermission {
  if (!notificationsSupported()) return "denied";
  return Notification.permission;
}

/**
 * Request notification permission. Returns the resulting permission.
 * Resolves to "denied" when unsupported or when the user denies.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Trim a block of text to a single-line preview suitable for a notification body. */
export function previewText(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

/**
 * Show a desktop notification. No-ops when unsupported, not permitted, or when
 * the tab is focused (so we don't interrupt users already reading the reply).
 */
export function showNotification(
  title: string,
  body: string,
): Notification | null {
  if (!notificationsSupported()) return null;
  if (Notification.permission !== "granted") return null;
  // Skip when the page is visible and focused — the user is already looking.
  if (typeof document !== "undefined" && !document.hidden) return null;
  try {
    const n = new Notification(title, {
      body: previewText(body),
      // Browsers ignore this if no origin icon exists; harmless either way.
      icon: "/favicon.ico",
    });
    // Focus the window when the user clicks the notification.
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return n;
  } catch {
    return null;
  }
}
