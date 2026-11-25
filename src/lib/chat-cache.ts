import type { QueryClient } from "@tanstack/react-query";
import type { ChatMessage, Conversation } from "./chat-api";

/** react-query keys for chat. */
export const chatKeys = {
  list: ["chats"] as const,
  unread: ["chat-unread"] as const,
  one: (id: string) => ["chat", id] as const,
  messages: (id: string) => ["chat-messages", id] as const,
  contacts: ["chat-contacts"] as const,
  profile: (id: string) => ["chat-profile", id] as const,
};

export type MessagesData = { messages: ChatMessage[]; hasMore: boolean };

/** Add or replace a message (matched by id, or by clientId for my own message still marked "sending"). */
export function upsertMessage(qc: QueryClient, msg: ChatMessage) {
  qc.setQueryData<MessagesData>(chatKeys.messages(msg.conversationId), (data) => {
    if (!data) return data;
    const list = data.messages;
    const at = list.findIndex((m) => m._id === msg._id || (msg.clientId && m.clientId === msg.clientId));
    if (at >= 0) {
      const next = list.slice();
      // Keep the local preview so a just-sent photo doesn't flash while the real one loads.
      next[at] = { ...msg, localPreview: list[at].localPreview };
      return { ...data, messages: next };
    }
    return { ...data, messages: [...list, msg].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
  });
}

export function patchMessage(qc: QueryClient, conversationId: string, clientId: string, patch: Partial<ChatMessage>) {
  qc.setQueryData<MessagesData>(chatKeys.messages(conversationId), (data) =>
    data ? { ...data, messages: data.messages.map((m) => (m.clientId === clientId && m.local ? { ...m, ...patch } : m)) } : data
  );
}

export function removeLocalMessage(qc: QueryClient, conversationId: string, clientId: string) {
  qc.setQueryData<MessagesData>(chatKeys.messages(conversationId), (data) =>
    data ? { ...data, messages: data.messages.filter((m) => !(m.clientId === clientId && m.local)) } : data
  );
}

function updateConversation(qc: QueryClient, id: string, fn: (c: Conversation) => Conversation) {
  qc.setQueryData<Conversation>(chatKeys.one(id), (c) => (c ? fn(c) : c));
  qc.setQueryData<Conversation[]>(chatKeys.list, (list) => (list ? list.map((c) => (c._id === id ? fn(c) : c)) : list));
}

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** The other shop received / read up to these times. */
export function applyReceipt(qc: QueryClient, r: { conversationId: string; deliveredAt: string | null; readAt: string | null }) {
  updateConversation(qc, r.conversationId, (c) => {
    const next = { ...c, otherLastDeliveredAt: later(c.otherLastDeliveredAt, r.deliveredAt), otherLastReadAt: later(c.otherLastReadAt, r.readAt) };
    if (next.lastMessage?.mine) {
      const at = next.lastMessage.createdAt;
      next.lastMessage = { ...next.lastMessage, status: next.otherLastReadAt && next.otherLastReadAt >= at ? "read" : next.otherLastDeliveredAt && next.otherLastDeliveredAt >= at ? "delivered" : "sent" };
    }
    return next;
  });
}

const previewText = (m: ChatMessage) => (m.kind === "system" ? (m.system?.as ?? "") : "") || m.text || m.attachment?.name || (m.card?.type === "bill" ? m.card.data.invoiceNumber : m.card?.type === "catalogue" ? m.card.data.title : "");

/**
 * A new message reached the chat list: move the chat to the top with the new
 * preview. Returns false when the chat isn't in the list yet (caller refetches).
 */
export function bumpConversation(qc: QueryClient, msg: ChatMessage, mine: boolean, countUnread: boolean): boolean {
  let found = false;
  const patch = (c: Conversation): Conversation => ({
    ...c,
    lastMessage: { text: previewText(msg), kind: msg.kind, mine, createdAt: msg.createdAt, status: mine ? "sent" : null },
    lastMessageAt: msg.createdAt,
    unread: countUnread ? c.unread + 1 : c.unread,
  });
  qc.setQueryData<Conversation[]>(chatKeys.list, (list) => {
    if (!list) return list;
    const hit = list.find((c) => c._id === msg.conversationId);
    if (!hit) return list;
    found = true;
    return [patch(hit), ...list.filter((c) => c._id !== msg.conversationId)];
  });
  qc.setQueryData<Conversation>(chatKeys.one(msg.conversationId), (c) => (c ? patch(c) : c));
  if (countUnread) qc.setQueryData<{ total: number }>(chatKeys.unread, (u) => ({ total: (u?.total ?? 0) + 1 }));
  return found;
}

/** I read this chat (here or on another device). */
export function clearUnread(qc: QueryClient, conversationId: string) {
  let cleared = 0;
  updateConversation(qc, conversationId, (c) => {
    cleared = c.unread;
    return { ...c, unread: 0 };
  });
  if (cleared) qc.setQueryData<{ total: number }>(chatKeys.unread, (u) => ({ total: Math.max(0, (u?.total ?? 0) - cleared) }));
}
