import { getPushKey, savePushSubscription } from "./chat-api";

/** Web Push for new chat messages (Android Chrome, desktop browsers, iPhone home-screen app). */

export type PushState = "granted" | "denied" | "default" | "unsupported";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushState(): PushState {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PushState;
}

function keyBytes(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // The worker is only registered in production builds (see main.tsx).
  if (!import.meta.env.PROD) return null;
  return navigator.serviceWorker.register("/sw.js");
}

async function subscribe(): Promise<boolean> {
  const reg = await registration();
  if (!reg) return false;
  await navigator.serviceWorker.ready;
  const { publicKey } = await getPushKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource });
  await savePushSubscription(sub.toJSON());
  return true;
}

/** Ask for permission (needs a tap) and register this device. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushState;
  try {
    return (await subscribe()) ? "granted" : "unsupported";
  } catch {
    return "unsupported";
  }
}

/** Already allowed earlier: make sure this login's device is registered (quietly). */
export async function refreshPush(): Promise<void> {
  if (pushState() !== "granted") return;
  await subscribe().catch(() => undefined);
}

/** A notification while the app is open but hidden (another tab, phone locked with the page open). */
export async function showLocalNotification(title: string, body: string, url: string, tag: string) {
  if (pushState() !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  const options: NotificationOptions = { body, tag, icon: "/logo-192.png", badge: "/logo-64.png", data: { url } };
  if (reg) await reg.showNotification(title, options).catch(() => undefined);
  else {
    try {
      const n = new Notification(title, options);
      n.onclick = () => {
        window.focus();
        window.location.assign(url);
      };
    } catch {
      // Some phones only allow notifications from a service worker.
    }
  }
}
