import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { API_BASE_URL } from "./api";
import { useAuthStore } from "./auth-store";
import { getUnreadTotal } from "./chat-api";

/**
 * One live connection per signed-in owner/manager. Messages, ticks, typing and
 * online status arrive here; ChatLive (components/chat) turns them into cache
 * updates. Saving always goes through the REST API.
 */

interface ChatLiveState {
  connected: boolean;
  /** conversationId → typing indicator expiry (ms). */
  typing: Record<string, number>;
  /** tenantId → online / last seen, newer than what the chat list says. */
  presence: Record<string, { online: boolean; lastSeenAt: string | null }>;
  /** The chat open on screen right now (its messages count as read). */
  activeConversationId: string | null;
}

export const useChatLive = create<ChatLiveState>(() => ({ connected: false, typing: {}, presence: {}, activeConversationId: null }));

let socket: Socket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;

function socketOrigin(): string {
  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function getChatSocket(): Socket | null {
  return socket;
}

export function connectChat(): Socket {
  if (socket) return socket;
  socket = io(socketOrigin(), {
    // Always the newest access token (it is refreshed by api.ts).
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 10000,
  });
  socket.on("connect", () => {
    attempts = 0;
    useChatLive.setState({ connected: true });
  });
  socket.on("disconnect", () => useChatLive.setState({ connected: false }));
  // A refused handshake is not retried by socket.io itself.
  socket.on("connect_error", (err) => {
    useChatLive.setState({ connected: false });
    if (err.message === "FORBIDDEN") return;
    if (retry) clearTimeout(retry);
    attempts += 1;
    retry = setTimeout(async () => {
      // An old token: any API call refreshes it.
      if (err.message === "UNAUTHORIZED") await getUnreadTotal().catch(() => undefined);
      if (socket && !socket.connected && useAuthStore.getState().accessToken) socket.connect();
    }, Math.min(30000, 1500 * attempts));
  });
  return socket;
}

export function disconnectChat() {
  if (retry) clearTimeout(retry);
  retry = null;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  useChatLive.setState({ connected: false, typing: {}, presence: {} });
}

let lastTypingSent = 0;
/** Tell the other shop I'm typing (at most every 2.5s) or stopped. */
export function sendTyping(conversationId: string, typing: boolean) {
  if (!socket?.connected) return;
  const now = Date.now();
  if (typing && now - lastTypingSent < 2500) return;
  lastTypingSent = typing ? now : 0;
  socket.emit("chat:typing", { conversationId, typing });
}
