import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Ban, Check, CheckCheck, MessageCirclePlus, MessagesSquare, Search } from "lucide-react";
import clsx from "clsx";
import { chatName, type Conversation } from "../../lib/chat-api";
import { useChatLive } from "../../lib/chat-socket";
import { initials, listTime } from "./chat-format";

export function ChatAvatar({ name, online, size = 48 }: { name: string; online?: boolean; size?: number }) {
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full bg-primary-container font-bold text-primary"
        style={{ fontSize: size * 0.36 }}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      {online ? <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-success" aria-hidden="true" /> : null}
    </span>
  );
}

export function Ticks({ status, className }: { status: "sent" | "delivered" | "read" | null; className?: string }) {
  const { t } = useTranslation();
  if (!status) return null;
  const label = t(`chat.status.${status}`);
  if (status === "sent") return <Check size={16} className={clsx("shrink-0 text-text-muted", className)} aria-label={label} />;
  return <CheckCheck size={16} className={clsx("shrink-0", status === "read" ? "text-info" : "text-text-muted", className)} aria-label={label} />;
}

export function ConversationList({
  conversations,
  loading,
  activeId,
  onNewChat,
}: {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  onNewChat: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "customer" | "supplier">("all");
  const typing = useChatLive((s) => s.typing);
  const presence = useChatLive((s) => s.presence);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if ((filter === "customer" || filter === "supplier") && c.other.kind !== filter) return false;
      if (!q) return true;
      return `${c.other.savedName ?? ""} ${c.other.businessName} ${c.lastMessage?.text ?? ""}`.toLowerCase().includes(q);
    });
  }, [conversations, query, filter]);

  const preview = (c: Conversation) => {
    const m = c.lastMessage;
    if (!m) return t("chat.noMessagesYet");
    if (m.kind === "deleted") return t("chat.deleted");
    if (m.kind === "image") return `📷 ${m.text || t("chat.kind.image")}`;
    if (m.kind === "voice") return `🎤 ${t("chat.kind.voice")}`;
    if (m.kind === "file") return `📄 ${m.text || t("chat.kind.file")}`;
    if (m.kind === "card") return `🧾 ${m.text}`;
    return m.text;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-text">{t("chat.title")}</h1>
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-sm font-semibold text-white shadow-brand outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <MessageCirclePlus size={18} aria-hidden="true" />
            {t("chat.newChat")}
          </button>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-primary">
          <Search size={17} className="shrink-0 text-icon" aria-hidden="true" />
          <span className="sr-only">{t("chat.search")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chat.search")}
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
          />
        </label>
        <div role="group" aria-label={t("chat.filterLabel")} className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {(["all", "unread", "customer", "supplier"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={clsx(
                "h-8 shrink-0 rounded-full px-3 text-[0.8125rem] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                filter === key ? "bg-primary-container text-primary" : "bg-surface-muted text-text-muted hover:text-text"
              )}
            >
              {t(`chat.filter.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto pb-4" aria-busy={loading}>
        {loading && conversations.length === 0
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="h-12 w-12 animate-pulse rounded-full bg-surface-variant" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3.5 w-1/2 animate-pulse rounded bg-surface-variant" />
                  <span className="block h-3 w-3/4 animate-pulse rounded bg-surface-variant" />
                </span>
              </li>
            ))
          : null}

        {!loading && conversations.length === 0 ? (
          <li className="flex flex-col items-center px-8 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-primary">
              <MessagesSquare size={26} aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-bold text-text">{t("chat.emptyTitle")}</p>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">{t("chat.emptyBody")}</p>
            <button type="button" onClick={onNewChat} className="mt-4 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand">
              {t("chat.newChat")}
            </button>
          </li>
        ) : null}

        {!loading && conversations.length > 0 && visible.length === 0 ? <li className="px-4 py-10 text-center text-sm text-text-muted">{t("chat.noMatch")}</li> : null}

        {visible.map((c) => {
          const name = chatName(c);
          const online = presence[c.other.tenantId]?.online ?? c.presence.online;
          const isTyping = (typing[c._id] ?? 0) > Date.now();
          return (
            <li key={c._id}>
              <NavLink
                to={`/app/chats/${c._id}`}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 outline-none transition-colors focus-visible:bg-surface-muted",
                  c._id === activeId ? "bg-primary-container/60" : "hover:bg-surface-muted"
                )}
              >
                <ChatAvatar name={name} online={online} />
                <span className="min-w-0 flex-1 border-b border-border/60 pb-3 pt-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-text">{name}</span>
                    {c.lastMessage ? (
                      <span className={clsx("shrink-0 text-xs", c.unread ? "font-semibold text-primary" : "text-text-muted")}>{listTime(c.lastMessage.createdAt)}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    {c.other.kind ? (
                      <span className="shrink-0 rounded-md bg-surface-muted px-1.5 py-px text-[0.6875rem] font-semibold text-text-muted">{t(`chat.kindTag.${c.other.kind}`)}</span>
                    ) : null}
                    {isTyping ? (
                      <span className="truncate text-sm font-semibold text-success">{t("chat.typing")}</span>
                    ) : (
                      <>
                        {c.lastMessage?.mine && c.lastMessage.kind !== "deleted" ? <Ticks status={c.lastMessage.status} /> : null}
                        {c.blockedByMe ? <Ban size={14} className="shrink-0 text-danger" aria-label={t("chat.blocked")} /> : null}
                        <span className={clsx("min-w-0 flex-1 truncate text-sm", c.lastMessage?.kind === "deleted" ? "italic text-text-muted" : "text-text-muted")}>{preview(c)}</span>
                      </>
                    )}
                    {c.unread > 0 ? (
                      <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-bold text-on-primary" aria-label={t("chat.unreadCount", { count: c.unread })}>
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
