import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, Ban, Bell, Copy, CornerUpLeft, Lock, MessageCircle, MoreVertical, Trash2, UserPlus, UserRound } from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "../../lib/auth-store";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";
import {
  acceptChat,
  isRequest,
  chatName,
  deleteChatMessage,
  getConversation,
  listMessages,
  markChatRead,
  newClientId,
  sendChatMessage,
  setChatBlocked,
  statusOf,
  uploadChatFile,
  type ChatAttachment,
  type ChatCardType,
  type ChatMessage,
  type Conversation,
  type SendBody,
  type BillCardData,
} from "../../lib/chat-api";
import { bumpConversation, chatKeys, clearUnread, patchMessage, upsertMessage, type MessagesData } from "../../lib/chat-cache";
import { sendTyping, useChatLive } from "../../lib/chat-socket";
import { enablePush, pushState } from "../../lib/push";
import { ChatAvatar } from "./ConversationList";
import { MessageBubble, type BubbleActions } from "./MessageBubble";
import { Composer } from "./Composer";
import { BillCardDialog, ChatProfileDialog, ImageViewer, ShareCardDialog } from "./ChatDialogs";
import { dayLabel, lastSeenLabel, sameDay } from "./chat-format";

/** Phone photos are 3–8 MB; send a sharp 1600px JPEG instead (saves data on both sides). */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 400_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const voiceName = (mime: string) => `voice-${Date.now()}.${mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm"}`;

function errorText(t: (k: string) => string, err: unknown): string {
  const code = err instanceof ApiError ? err.code : undefined;
  if (code && ["BLOCKED", "YOU_BLOCKED", "NO_DUES", "NOT_A_CONTACT", "TOO_BIG", "BAD_FILE", "NO_STORAGE"].includes(code)) return t(`chat.errors.${code}`);
  if (err instanceof ApiError && err.status === 413) return t("chat.errors.TOO_BIG");
  // Anything else the server explained (4xx) is shown as it said; network trouble gets the generic line.
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.message) return err.message;
  return t("chat.errors.generic");
}

export function ChatThread({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const myTenantId = me?.tenantId ?? "";
  const scroller = useRef<HTMLDivElement>(null);
  const retries = useRef(new Map<string, () => void>());
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [share, setShare] = useState<ChatCardType | null>(null);
  const [billView, setBillView] = useState<BillCardData | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pushNow, setPushNow] = useState(pushState());

  const conv = useQuery({
    queryKey: chatKeys.one(conversationId),
    queryFn: () => getConversation(conversationId),
    initialData: () => qc.getQueryData<Conversation[]>(chatKeys.list)?.find((c) => c._id === conversationId),
    initialDataUpdatedAt: 0,
  });

  // A refetch must not drop messages still being sent, or older ones already loaded.
  const messages = useQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: async (): Promise<MessagesData> => {
      const fresh = await listMessages(conversationId);
      const prev = qc.getQueryData<MessagesData>(chatKeys.messages(conversationId));
      if (!prev) return fresh;
      const oldestFresh = fresh.messages[0]?.createdAt;
      const older = oldestFresh ? prev.messages.filter((m) => !m.local && m.createdAt < oldestFresh) : [];
      const pending = prev.messages.filter((m) => m.local && !fresh.messages.some((f) => f.clientId && f.clientId === m.clientId));
      return { messages: [...older, ...fresh.messages, ...pending], hasMore: older.length ? prev.hasMore : fresh.hasMore };
    },
  });

  const c = conv.data;
  const list = useMemo(() => messages.data?.messages ?? [], [messages.data]);
  const name = c ? chatName(c) : "";
  const typingUntil = useChatLive((s) => s.typing[conversationId] ?? 0);
  const livePresence = useChatLive((s) => (c ? s.presence[c.other.tenantId] : undefined));
  const presence = livePresence ?? c?.presence;
  const isTyping = typingUntil > Date.now();

  // This chat is on screen: its messages count as read.
  useEffect(() => {
    useChatLive.setState({ activeConversationId: conversationId });
    return () => {
      if (useChatLive.getState().activeConversationId === conversationId) useChatLive.setState({ activeConversationId: null });
      sendTyping(conversationId, false);
    };
  }, [conversationId]);

  const unread = c?.unread ?? 0;
  useEffect(() => {
    const read = () => {
      if (document.visibilityState !== "visible") return;
      clearUnread(qc, conversationId);
      void markChatRead(conversationId).catch(() => undefined);
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [conversationId, qc, unread]);

  // ---- scrolling ----
  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(0);
  }, []);

  const firstScroll = useRef(true);
  useEffect(() => {
    firstScroll.current = true;
    setReplyTo(null);
  }, [conversationId]);

  const lastId = list[list.length - 1]?._id;
  const keepOffset = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || list.length === 0) return;
    if (keepOffset.current !== null) {
      // Older messages were added on top: stay where the reader was.
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
      return;
    }
    if (firstScroll.current) {
      firstScroll.current = false;
      el.scrollTop = el.scrollHeight;
      return;
    }
    const last = list[list.length - 1];
    if (last.senderTenantId === myTenantId || atBottom) scrollToBottom(true);
    else setNewBelow((n) => n + 1);
    // Only when a new last message arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, list.length]);

  const loadOlder = async () => {
    const data = qc.getQueryData<MessagesData>(chatKeys.messages(conversationId));
    const oldest = data?.messages.find((m) => !m.local);
    if (!data?.hasMore || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await listMessages(conversationId, oldest.createdAt);
      const el = scroller.current;
      keepOffset.current = el ? el.scrollHeight - el.scrollTop : null;
      qc.setQueryData<MessagesData>(chatKeys.messages(conversationId), (d) =>
        d ? { messages: [...page.messages.filter((m) => !d.messages.some((x) => x._id === m._id)), ...d.messages], hasMore: page.hasMore } : d
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAtBottom(bottom);
    if (bottom) setNewBelow(0);
    if (el.scrollTop < 120) void loadOlder();
  };

  const jumpTo = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(messageId);
    setTimeout(() => setHighlight(null), 1600);
  };

  // ---- sending ----
  const sendWith = useCallback(
    (body: Omit<SendBody, "clientId">, local: Partial<ChatMessage> = {}, upload?: () => Promise<ChatAttachment>) => {
      const clientId = newClientId();
      const reply = replyTo;
      setReplyTo(null);
      const optimistic: ChatMessage = {
        _id: `local-${clientId}`,
        conversationId,
        senderTenantId: myTenantId,
        senderName: me?.name ?? "",
        kind: body.kind,
        text: body.text ?? "",
        attachment: body.attachment ?? local.attachment ?? null,
        card: null,
        replyTo: reply ? { messageId: reply._id, text: reply.text || reply.attachment?.name || "", kind: reply.kind, senderTenantId: reply.senderTenantId } : null,
        clientId,
        deleted: false,
        createdAt: new Date().toISOString(),
        local: "sending",
        ...local,
      };
      upsertMessage(qc, optimistic);
      bumpConversation(qc, optimistic, true, false);

      let uploaded: ChatAttachment | undefined = body.attachment;
      const attempt = async () => {
        patchMessage(qc, conversationId, clientId, { local: "sending", localError: undefined });
        try {
          if (upload && !uploaded) uploaded = await upload();
          const saved = await sendChatMessage(conversationId, { ...body, attachment: uploaded, clientId, replyToId: reply?._id });
          upsertMessage(qc, saved);
          retries.current.delete(clientId);
        } catch (err) {
          const reason = errorText(t, err);
          patchMessage(qc, conversationId, clientId, { local: "failed", localError: reason });
          showError(reason);
        }
      };
      retries.current.set(clientId, () => void attempt());
      void attempt();
    },
    [conversationId, me?.name, myTenantId, qc, replyTo, t]
  );

  const sendText = (text: string) => sendWith({ kind: "text", text });

  const sendFiles = (files: File[], kind: "image" | "file") => {
    for (const original of files) {
      const preview = kind === "image" ? URL.createObjectURL(original) : undefined;
      sendWith(
        { kind },
        { attachment: { url: preview ?? "", name: original.name, size: original.size, mime: original.type }, localPreview: preview },
        async () => {
          const file = kind === "image" ? await shrinkImage(original) : original;
          const up = await uploadChatFile(file, file.name);
          return { url: up.url, name: up.name, size: up.size, mime: up.mime };
        }
      );
    }
  };

  const sendVoice = (blob: Blob, durationSec: number) => {
    const preview = URL.createObjectURL(blob);
    sendWith({ kind: "voice" }, { attachment: { url: preview, durationSec, mime: blob.type }, localPreview: preview }, async () => {
      const up = await uploadChatFile(blob, voiceName(blob.type));
      return { url: up.url, name: up.name, size: up.size, mime: up.mime, durationSec };
    });
  };

  const sendCard = async (card: { type: ChatCardType; refId?: string }) => {
    setShare(null);
    try {
      const saved = await sendChatMessage(conversationId, { clientId: newClientId(), kind: "card", card });
      upsertMessage(qc, saved);
      bumpConversation(qc, saved, true, false);
      scrollToBottom(true);
    } catch (err) {
      showError(errorText(t, err));
    }
  };

  // ---- actions ----
  const actions: BubbleActions = {
    onReply: setReplyTo,
    onMenu: (m) => setMenu(m),
    onOpenImage: setImage,
    onOpenBill: (m) => m.card?.type === "bill" && setBillView(m.card.data),
    onRetry: (m) => m.clientId && retries.current.get(m.clientId)?.(),
    onJumpTo: jumpTo,
  };

  const accept = async () => {
    try {
      const next = await acceptChat(conversationId);
      qc.setQueryData(chatKeys.one(conversationId), next);
      void qc.invalidateQueries({ queryKey: chatKeys.list });
    } catch (err) {
      showError(errorText(t, err));
    }
  };
  const addedMe = list.some((m) => m.kind === "system" && m.senderTenantId !== myTenantId);

  const toggleBlock = async () => {
    if (!c) return;
    setHeaderMenu(false);
    try {
      const next = await setChatBlocked(conversationId, !c.blockedByMe);
      qc.setQueryData(chatKeys.one(conversationId), next);
      void qc.invalidateQueries({ queryKey: chatKeys.list });
      showSuccess(next.blockedByMe ? t("chat.blockedToast", { name }) : t("chat.unblockedToast", { name }));
    } catch (err) {
      showError(errorText(t, err));
    }
  };

  const turnOnNotifications = async () => {
    setHeaderMenu(false);
    const result = await enablePush();
    setPushNow(result);
    if (result === "granted") showSuccess(t("chat.push.on"));
    else if (result === "denied") showError(t("chat.push.denied"));
    else showError(t("chat.push.unsupported"));
  };

  if (conv.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-base font-semibold text-text">{t("chat.notFound")}</p>
        <button type="button" onClick={() => navigate("/app/chats")} className="text-sm font-semibold text-primary">
          {t("chat.backToChats")}
        </button>
      </div>
    );
  }

  const subtitle = isTyping
    ? t("chat.typing")
    : presence?.online
      ? t("chat.online")
      : presence?.lastSeenAt
        ? lastSeenLabel(presence.lastSeenAt)
        : c?.other.savedName && c.other.businessName !== c.other.savedName
          ? c.other.businessName
          : "";

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#f6f0ea]">
      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-border bg-surface px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
        <button
          type="button"
          onClick={() => navigate("/app/chats")}
          aria-label={t("chat.backToChats")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => c && setProfileOpen(true)}
          aria-label={t("chat.profile.open", { name })}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-0.5 pr-2 text-left outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
        >
        {c ? <ChatAvatar name={name} online={presence?.online} size={42} /> : <span className="h-10.5 w-10.5 animate-pulse rounded-full bg-surface-variant" />}
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-base font-bold text-text">{name || "…"}</p>
          <p className={clsx("truncate text-xs", isTyping || presence?.online ? "font-semibold text-success" : "text-text-muted")} aria-live="polite">
            {subtitle}
          </p>
        </div>
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setHeaderMenu((v) => !v)}
            aria-label={t("chat.menu.more")}
            aria-expanded={headerMenu}
            className="flex h-10 w-10 items-center justify-center rounded-full text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <MoreVertical size={20} aria-hidden="true" />
          </button>
          {headerMenu && c ? (
            <>
              <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setHeaderMenu(false)} />
              <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-elevation-3">
                <button type="button" role="menuitem" onClick={() => (setHeaderMenu(false), setProfileOpen(true))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-muted">
                  <UserRound size={17} className="text-icon" aria-hidden="true" />
                  {t("chat.profile.view")}
                </button>
                {!c.other.kind ? (
                  <button type="button" role="menuitem" onClick={() => (setHeaderMenu(false), setProfileOpen(true))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-muted">
                    <UserPlus size={17} className="text-icon" aria-hidden="true" />
                    {t("chat.profile.saveTitle")}
                  </button>
                ) : null}
                {c.other.kind && c.other.contactId ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate(`/app/${c.other.kind === "customer" ? "customers" : "suppliers"}?q=${encodeURIComponent(c.other.savedName ?? "")}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-muted"
                  >
                    <UserRound size={17} className="text-icon" aria-hidden="true" />
                    {t(c.other.kind === "customer" ? "chat.menu.viewCustomer" : "chat.menu.viewSupplier")}
                  </button>
                ) : null}
                {pushNow === "default" ? (
                  <button type="button" role="menuitem" onClick={() => void turnOnNotifications()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-muted">
                    <Bell size={17} className="text-icon" aria-hidden="true" />
                    {t("chat.push.turnOn")}
                  </button>
                ) : null}
                <button type="button" role="menuitem" onClick={() => void toggleBlock()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-danger hover:bg-surface-muted">
                  <Ban size={17} aria-hidden="true" />
                  {c.blockedByMe ? t("chat.unblock") : t("chat.block")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>

      {pushNow === "default" ? (
        <button
          type="button"
          onClick={() => void turnOnNotifications()}
          className="flex shrink-0 items-center justify-center gap-2 bg-info-container px-4 py-2 text-sm font-semibold text-info outline-none hover:underline"
        >
          <Bell size={16} aria-hidden="true" />
          {t("chat.push.banner")}
        </button>
      ) : null}

      {/* A chat another shop started: continue, save them, or restrict. */}
      {c && isRequest(c) ? (
        <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
          <p className="text-sm font-semibold text-text">{addedMe ? t("chat.request.addedYou", { name }) : t("chat.request.started", { name })}</p>
          {!c.other.kind ? <p className="mt-0.5 text-xs text-text-muted">{t("chat.request.notSaved")}</p> : null}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => void accept()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-3.5 text-sm font-semibold text-white shadow-brand outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <MessageCircle size={16} aria-hidden="true" />
              {t("chat.request.continue")}
            </button>
            {!c.other.kind ? (
              <button type="button" onClick={() => setProfileOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40">
                <UserPlus size={16} aria-hidden="true" />
                {t("chat.profile.saveTitle")}
              </button>
            ) : null}
            <button type="button" onClick={() => void toggleBlock()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger/40 px-3.5 text-sm font-semibold text-danger outline-none hover:bg-danger/5 focus-visible:ring-2 focus-visible:ring-danger/40">
              <Ban size={16} aria-hidden="true" />
              {t("chat.block")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Messages */}
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className="mx-auto mb-3 flex max-w-sm items-start gap-2 rounded-xl bg-[#fff5d6] px-3 py-2 text-center text-xs leading-relaxed text-text-subtle">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t("chat.privacyNote", { name: name || "…" })}</span>
        </div>
        {loadingOlder ? <p className="py-2 text-center text-xs text-text-muted">{t("chat.loadingOlder")}</p> : null}
        {messages.isLoading ? <p className="py-10 text-center text-sm text-text-muted">{t("chat.loading")}</p> : null}
        {!messages.isLoading && list.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xs text-center">
            <p className="text-sm font-semibold text-text">{t("chat.sayHello", { name })}</p>
            <button type="button" onClick={() => sendText(t("chat.helloText"))} className="mt-3 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-card">
              👋 {t("chat.helloText")}
            </button>
          </div>
        ) : null}
        {list.map((m, i) => {
          const prev = list[i - 1];
          const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const mine = m.senderTenantId === myTenantId;
          const showTail = newDay || !prev || prev.senderTenantId !== m.senderTenantId;
          return (
            <Fragment key={m.clientId ?? m._id}>
              {newDay ? (
                <div className="sticky top-1 z-1 my-3 flex justify-center">
                  <span className="rounded-lg bg-surface/95 px-3 py-1 text-xs font-semibold text-text-muted shadow-sm">{dayLabel(m.createdAt)}</span>
                </div>
              ) : null}
              <MessageBubble m={m} mine={mine} status={c ? statusOf(m, c) : "sent"} showTail={showTail} highlighted={highlight === m._id} actions={actions} theirName={name} />
            </Fragment>
          );
        })}
        {isTyping ? (
          <div className="mt-2 flex px-3 sm:px-6">
            <span className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-surface px-3 py-3 shadow-sm" aria-label={t("chat.typing")}>
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-2 w-2 rounded-full bg-text-muted motion-safe:animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </span>
          </div>
        ) : null}
      </div>

      {!atBottom ? (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label={t("chat.scrollDown")}
          className="absolute bottom-24 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-icon shadow-elevation-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:right-8"
        >
          <ArrowDown size={20} aria-hidden="true" />
          {newBelow > 0 ? <span className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-bold text-on-primary">{newBelow}</span> : null}
        </button>
      ) : null}

      <Composer
        replyTo={replyTo}
        replyName={replyTo ? (replyTo.senderTenantId === myTenantId ? t("chat.you") : name) : ""}
        onCancelReply={() => setReplyTo(null)}
        onSendText={sendText}
        onSendFiles={sendFiles}
        onSendVoice={sendVoice}
        onShare={setShare}
        onTyping={(typing) => sendTyping(conversationId, typing)}
        blocked={Boolean(c?.blockedByMe)}
        onUnblock={() => void toggleBlock()}
      />

      {c ? <ShareCardDialog type={share} contact={c.other} onClose={() => setShare(null)} onSend={(card) => void sendCard(card)} /> : null}
      <BillCardDialog data={billView} onClose={() => setBillView(null)} />
      {c ? <ChatProfileDialog conversation={c} open={profileOpen} onClose={() => setProfileOpen(false)} onToggleRestrict={() => (setProfileOpen(false), void toggleBlock())} /> : null}
      <ImageViewer url={image} onClose={() => setImage(null)} />

      {/* Long-press / ▾ menu for one message */}
      {menu ? (
        <div className="fixed inset-0 z-125 flex items-end justify-center bg-black/30 sm:items-center" onClick={() => setMenu(null)}>
          <div role="menu" aria-label={t("chat.menu.open")} className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-elevation-3 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="line-clamp-2 border-b border-border px-5 py-3 text-sm text-text-muted">{menu.text || menu.attachment?.name || t(`chat.kind.${menu.kind}`)}</p>
            {!menu.deleted ? (
              <button type="button" role="menuitem" onClick={() => (setReplyTo(menu), setMenu(null))} className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-[0.9375rem] text-text hover:bg-surface-muted">
                <CornerUpLeft size={19} className="text-icon" aria-hidden="true" />
                {t("chat.menu.reply")}
              </button>
            ) : null}
            {menu.text && !menu.deleted ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard?.writeText(menu.text).then(() => showSuccess(t("chat.copied")));
                  setMenu(null);
                }}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-[0.9375rem] text-text hover:bg-surface-muted"
              >
                <Copy size={19} className="text-icon" aria-hidden="true" />
                {t("chat.menu.copy")}
              </button>
            ) : null}
            {menu.senderTenantId === myTenantId && !menu.deleted ? (
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  const target = menu;
                  setMenu(null);
                  try {
                    upsertMessage(qc, await deleteChatMessage(target._id));
                  } catch (err) {
                    showError(errorText(t, err));
                  }
                }}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-[0.9375rem] text-danger hover:bg-surface-muted"
              >
                <Trash2 size={19} aria-hidden="true" />
                {t("chat.menu.deleteForEveryone")}
              </button>
            ) : null}
            <button type="button" onClick={() => setMenu(null)} className="w-full border-t border-border px-5 py-3.5 text-[0.9375rem] font-semibold text-text-muted hover:bg-surface-muted">
              {t("chat.menu.cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
