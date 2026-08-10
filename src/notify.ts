/*
 * Thin wrapper over the Web Notifications API, so a fired trigger can reach the
 * user even when the tab is in the background. All calls are safe no-ops when
 * notifications aren't supported or permitted.
 */

export type NotifyState = "unsupported" | "default" | "granted" | "denied";

function supported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notifyState(): NotifyState {
  if (!supported()) return "unsupported";
  return Notification.permission as NotifyState;
}

export async function requestNotify(): Promise<NotifyState> {
  if (!supported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission as NotifyState;
  try {
    return (await Notification.requestPermission()) as NotifyState;
  } catch {
    return Notification.permission as NotifyState;
  }
}

export function fireNotification(title: string, body: string): void {
  if (!supported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    /* some browsers throw off a non-secure origin; ignore */
  }
}
