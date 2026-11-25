import { apiFetch, apiUpload } from "./api";

export type ChatKind = "text" | "image" | "file" | "voice" | "card";
export type ChatCardType = "bill" | "catalogue" | "dues";
export type MessageStatus = "sent" | "delivered" | "read";
/** Not saved yet (on its way) or failed to send. Only for this device's own messages. */
export type LocalState = "sending" | "failed";

export interface ChatAttachment {
  url: string;
  name?: string;
  size?: number;
  mime?: string;
  durationSec?: number;
}

export interface BillCardData {
  invoiceNumber: string;
  date: string;
  items: { name: string; qty: number; unit: string; price: number; total: number }[];
  moreItems: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  cancelled: boolean;
  payee: string;
  upiId: string | null;
}
export interface CatalogueCardData {
  title: string;
  note: string;
  token: string;
  itemCount: number;
  payee: string;
}
export interface DuesCardData {
  direction: "receivable" | "payable";
  amount: number;
  bills: number;
  payee: string;
  upiId: string | null;
  asOf: string;
}
export type ChatCard =
  | { type: "bill"; data: BillCardData }
  | { type: "catalogue"; data: CatalogueCardData }
  | { type: "dues"; data: DuesCardData };

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderTenantId: string;
  senderName: string;
  kind: ChatKind;
  text: string;
  attachment: ChatAttachment | null;
  card: ChatCard | null;
  replyTo: { messageId: string; text: string; kind: ChatKind; senderTenantId: string } | null;
  clientId: string | null;
  deleted: boolean;
  createdAt: string;
  /** Set only on this device while sending. */
  local?: LocalState;
  /** A local preview (blob URL) shown while the upload runs. */
  localPreview?: string;
}

export interface Conversation {
  _id: string;
  other: {
    tenantId: string;
    businessName: string;
    savedName: string | null;
    kind: "customer" | "supplier" | null;
    contactId: string | null;
  };
  presence: { online: boolean; lastSeenAt: string | null };
  lastMessage: { text: string; kind: ChatKind | "deleted"; mine: boolean; createdAt: string; status: MessageStatus | null } | null;
  unread: number;
  blockedByMe: boolean;
  otherLastReadAt: string | null;
  otherLastDeliveredAt: string | null;
  lastMessageAt: string;
}

export interface ChatContact {
  id: string;
  name: string;
  phone: string;
  kind: "customer" | "supplier";
  shop: { tenantId: string; businessName: string } | null;
  conversationId: string | null;
}

export const chatName = (c: Pick<Conversation, "other">) => c.other.savedName || c.other.businessName;

export const listConversations = () => apiFetch<Conversation[]>("/chats");
export const getConversation = (id: string) => apiFetch<Conversation>(`/chats/${id}`);
export const getUnreadTotal = () => apiFetch<{ total: number }>("/chats/unread");
export const listChatContacts = () => apiFetch<ChatContact[]>("/chats/contacts");
export const listMessages = (id: string, before?: string) =>
  apiFetch<{ messages: ChatMessage[]; hasMore: boolean }>(`/chats/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`);

export const startChat = (body: { phone: string } | { contactKind: "customer" | "supplier"; contactId: string }) =>
  apiFetch<Conversation>("/chats/start", { method: "POST", body: JSON.stringify(body) });

export interface SendBody {
  clientId: string;
  kind: ChatKind;
  text?: string;
  attachment?: ChatAttachment;
  card?: { type: ChatCardType; refId?: string };
  replyToId?: string;
}
export const sendChatMessage = (conversationId: string, body: SendBody) =>
  apiFetch<ChatMessage>(`/chats/${conversationId}/messages`, { method: "POST", body: JSON.stringify(body) });
export const markChatRead = (conversationId: string) => apiFetch<void>(`/chats/${conversationId}/read`, { method: "POST" });
export const deleteChatMessage = (messageId: string) => apiFetch<ChatMessage>(`/chats/messages/${messageId}`, { method: "DELETE" });
export const setChatBlocked = (conversationId: string, blocked: boolean) =>
  apiFetch<Conversation>(`/chats/${conversationId}/block`, { method: "POST", body: JSON.stringify({ blocked }) });

export function uploadChatFile(file: Blob, name: string) {
  const form = new FormData();
  form.append("file", file, name);
  return apiUpload<{ url: string; name: string; size: number; mime: string }>("/chats/upload", form);
}

export const getPushKey = () => apiFetch<{ publicKey: string }>("/chats/push/key");
export const savePushSubscription = (subscription: PushSubscriptionJSON) =>
  apiFetch<void>("/chats/push/subscribe", { method: "POST", body: JSON.stringify({ subscription }) });

/** Tick for one of my messages, from what the other shop has received / read. */
export function statusOf(message: Pick<ChatMessage, "createdAt">, conv: Pick<Conversation, "otherLastReadAt" | "otherLastDeliveredAt">): MessageStatus {
  if (conv.otherLastReadAt && conv.otherLastReadAt >= message.createdAt) return "read";
  if (conv.otherLastDeliveredAt && conv.otherLastDeliveredAt >= message.createdAt) return "delivered";
  return "sent";
}

export const newClientId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Roles that can use chat (mirrors the backend). */
export const CHAT_ROLES = ["OWNER", "MANAGER", "SUPER_ADMIN"] as const;
