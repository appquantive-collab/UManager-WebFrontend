import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuthStore } from "../../lib/auth-store";
import { chatName, markChatRead, type ChatMessage, type Conversation } from "../../lib/chat-api";
import { applyReceipt, bumpConversation, chatKeys, clearUnread, upsertMessage } from "../../lib/chat-cache";
import { connectChat, disconnectChat, useChatLive } from "../../lib/chat-socket";
import { refreshPush, showLocalNotification } from "../../lib/push";

/** What a message says in a toast / notification. */
export function messagePreview(t: (k: string, o?: Record<string, unknown>) => string, m: Pick<ChatMessage, "kind" | "text" | "attachment" | "card" | "system">): string {
  if (m.kind === "text") return m.text;
  if (m.kind === "system") return t(`chat.system.addedYouShort.${m.system?.as ?? "customer"}`);
  if (m.kind === "image") return `📷 ${m.text || t("chat.kind.image")}`;
  if (m.kind === "voice") return `🎤 ${t("chat.kind.voice")}`;
  if (m.kind === "file") return `📄 ${m.attachment?.name || t("chat.kind.file")}`;
  if (m.card?.type === "bill") return `🧾 ${t("chat.card.billShort", { number: m.card.data.invoiceNumber })}`;
  if (m.card?.type === "catalogue") return `📒 ${m.card.data.title}`;
  if (m.card?.type === "dues") return `💰 ${t("chat.card.duesShort")}`;
  return "";
}

/**
 * Keeps the shop's chat connection open while the app is open and applies
 * live events (new messages, ticks, typing, online) to the cached data.
 */
export function ChatLive() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const myTenantId = useAuthStore((s) => s.user?.tenantId ?? null);

  useEffect(() => {
    if (!myTenantId) return;
    const socket = connectChat();
    void refreshPush();

    const onMessage = (msg: ChatMessage) => {
      const mine = msg.senderTenantId === myTenantId;
      const active = useChatLive.getState().activeConversationId === msg.conversationId;
      const looking = active && document.visibilityState === "visible";
      upsertMessage(qc, msg);
      const known = bumpConversation(qc, msg, mine, !mine && !looking);
      if (!known) void qc.invalidateQueries({ queryKey: chatKeys.list });
      if (mine) return;
      // Someone stopped typing the moment their message arrived.
      useChatLive.setState((s) => {
        const typing = { ...s.typing };
        delete typing[msg.conversationId];
        return { typing };
      });
      if (looking) {
        void markChatRead(msg.conversationId).catch(() => undefined);
        return;
      }
      const conv =
        qc.getQueryData<Conversation[]>(chatKeys.list)?.find((c) => c._id === msg.conversationId) ?? qc.getQueryData<Conversation>(chatKeys.one(msg.conversationId));
      const title = conv ? chatName(conv) : t("chat.newMessage");
      const body = messagePreview(t, msg);
      const url = `/app/chats/${msg.conversationId}`;
      if (document.visibilityState === "hidden") {
        void showLocalNotification(title, body, url, `chat-${msg.conversationId}`);
      } else {
        toast(title, { description: body, id: `chat-${msg.conversationId}`, action: { label: t("chat.open"), onClick: () => navigate(url) } });
      }
    };
    const onUpdate = (msg: ChatMessage) => {
      upsertMessage(qc, msg);
      void qc.invalidateQueries({ queryKey: chatKeys.list });
    };
    const onReceipt = (r: { conversationId: string; deliveredAt: string | null; readAt: string | null }) => applyReceipt(qc, r);
    const onRead = (r: { conversationId: string }) => clearUnread(qc, r.conversationId);
    const onTyping = (e: { conversationId: string; typing: boolean }) =>
      useChatLive.setState((s) => {
        const typing = { ...s.typing };
        if (e.typing) typing[e.conversationId] = Date.now() + 5000;
        else delete typing[e.conversationId];
        return { typing };
      });
    const onPresence = (p: { tenantId: string; online: boolean; lastSeenAt: string | null }) =>
      useChatLive.setState((s) => ({ presence: { ...s.presence, [p.tenantId]: { online: p.online, lastSeenAt: p.lastSeenAt } } }));
    const onConversation = (e: { conversationId: string }) => {
      void qc.invalidateQueries({ queryKey: chatKeys.list });
      void qc.invalidateQueries({ queryKey: chatKeys.one(e.conversationId) });
    };
    // Back online: fetch whatever was missed.
    const onConnect = () => {
      void qc.invalidateQueries({ queryKey: chatKeys.list });
      void qc.invalidateQueries({ queryKey: chatKeys.unread });
      const active = useChatLive.getState().activeConversationId;
      if (active) void qc.invalidateQueries({ queryKey: chatKeys.messages(active) });
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:update", onUpdate);
    socket.on("chat:receipt", onReceipt);
    socket.on("chat:read", onRead);
    socket.on("chat:typing", onTyping);
    socket.on("chat:presence", onPresence);
    socket.on("chat:conversation", onConversation);
    socket.on("connect", onConnect);

    // A tapped notification asks the open app to show that chat.
    const onWorkerMessage = (e: MessageEvent) => {
      if (e.data?.type === "vm-open" && typeof e.data.url === "string") navigate(e.data.url);
    };
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage);

    // Typing dots stop by themselves if the "stopped" event never comes.
    const sweep = setInterval(() => {
      const now = Date.now();
      const typing = useChatLive.getState().typing;
      if (Object.values(typing).some((until) => until < now)) {
        useChatLive.setState({ typing: Object.fromEntries(Object.entries(typing).filter(([, until]) => until >= now)) });
      }
    }, 1500);

    return () => {
      clearInterval(sweep);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
      socket.off("chat:message", onMessage);
      socket.off("chat:update", onUpdate);
      socket.off("chat:receipt", onReceipt);
      socket.off("chat:read", onRead);
      socket.off("chat:typing", onTyping);
      socket.off("chat:presence", onPresence);
      socket.off("chat:conversation", onConversation);
      socket.off("connect", onConnect);
    };
  }, [myTenantId, qc, navigate, t]);

  // Signed out (or another business): close the connection.
  useEffect(() => () => disconnectChat(), [myTenantId]);

  return null;
}
