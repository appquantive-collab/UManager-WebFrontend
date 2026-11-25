import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, BookOpen, ChevronDown, Clock3, Download, FileText, Pause, Play, ReceiptText, Wallet } from "lucide-react";
import clsx from "clsx";
import { formatCurrency } from "../../lib/format";
import { upiPayLink } from "../../lib/bill-share";
import type { ChatMessage, MessageStatus } from "../../lib/chat-api";
import { Ticks } from "./ConversationList";
import { clock, fileSize, playableAudio, thumbOf, timeOf } from "./chat-format";

export interface BubbleActions {
  onReply: (m: ChatMessage) => void;
  onMenu: (m: ChatMessage, anchor: HTMLElement | null) => void;
  onOpenImage: (url: string) => void;
  onOpenBill: (m: ChatMessage) => void;
  onRetry: (m: ChatMessage) => void;
  onJumpTo: (messageId: string) => void;
}

/** A voice note: play / pause, progress, length. */
function VoicePlayer({ url, duration, mine }: { url: string; duration?: number; mine: boolean }) {
  const { t } = useTranslation();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [length, setLength] = useState(duration ?? 0);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = () => {
    if (!audio.current) {
      const a = new Audio(url.startsWith("blob:") ? url : playableAudio(url));
      a.preload = "auto";
      a.ontimeupdate = () => setPos(a.currentTime);
      a.onloadedmetadata = () => Number.isFinite(a.duration) && setLength(a.duration);
      a.onended = () => {
        setPlaying(false);
        setPos(0);
      };
      a.onerror = () => {
        setPlaying(false);
        setFailed(true);
      };
      audio.current = a;
    }
    const a = audio.current;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      // Only one voice note plays at a time.
      document.dispatchEvent(new CustomEvent("vm-voice-play", { detail: a }));
      void a.play().then(() => setPlaying(true), () => setFailed(true));
    }
  };

  useEffect(() => {
    const stopOthers = (e: Event) => {
      if ((e as CustomEvent).detail !== audio.current && audio.current && !audio.current.paused) {
        audio.current.pause();
        setPlaying(false);
      }
    };
    document.addEventListener("vm-voice-play", stopOthers);
    return () => document.removeEventListener("vm-voice-play", stopOthers);
  }, []);

  const progress = length ? Math.min(100, (pos / length) * 100) : 0;
  return (
    <div className="flex w-60 max-w-full items-center gap-3 py-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("chat.voice.pause") : t("chat.voice.play")}
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          mine ? "bg-primary text-on-primary" : "bg-primary-container text-primary"
        )}
      >
        {playing ? <Pause size={18} fill="currentColor" aria-hidden="true" /> : <Play size={18} fill="currentColor" className="ml-0.5" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="relative h-1.5 rounded-full bg-text/10" aria-hidden="true">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-xs tabular-nums text-text-muted">{failed ? t("chat.voice.failed") : clock(playing || pos ? pos : length)}</p>
      </div>
    </div>
  );
}

function CardShell({ icon: Icon, title, subtitle, children }: { icon: typeof Wallet; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="w-72 max-w-full overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-start gap-2.5 px-3 pb-2 pt-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text">{title}</p>
          {subtitle ? <p className="truncate text-xs text-text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

const cardButton = "flex h-10 flex-1 items-center justify-center gap-1.5 text-sm font-semibold text-primary outline-none hover:bg-primary-container/60 focus-visible:bg-primary-container/60";

function CardView({ m, mine, onOpenBill }: { m: ChatMessage; mine: boolean; onOpenBill: () => void }) {
  const { t } = useTranslation();
  const card = m.card!;
  if (card.type === "bill") {
    const d = card.data;
    const payLink = !mine && d.due > 0 && d.upiId && !d.cancelled ? upiPayLink(d.upiId, d.payee, d.due, d.invoiceNumber) : null;
    return (
      <CardShell icon={ReceiptText} title={t("chat.card.bill", { number: d.invoiceNumber })} subtitle={new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}>
        <ul className="space-y-0.5 px-3 text-xs text-text-muted">
          {d.items.slice(0, 3).map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate">
                {item.name} × {item.qty} {item.unit}
              </span>
              <span className="tabular-nums">{formatCurrency(item.total)}</span>
            </li>
          ))}
          {d.items.length + d.moreItems > 3 ? <li>{t("chat.card.moreItems", { count: d.items.length + d.moreItems - 3 })}</li> : null}
        </ul>
        <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-border px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("chat.card.total")}</span>
          <span className="text-base font-bold tabular-nums text-text">{formatCurrency(d.total)}</span>
        </div>
        {d.cancelled ? (
          <p className="px-3 pb-2 text-xs font-semibold text-danger">{t("chat.card.cancelled")}</p>
        ) : d.due > 0 ? (
          <p className="px-3 pb-2 text-xs font-semibold text-warning">{t("chat.card.due", { amount: formatCurrency(d.due) })}</p>
        ) : (
          <p className="px-3 pb-2 text-xs font-semibold text-success">{t("chat.card.paid")}</p>
        )}
        <div className="flex divide-x divide-border border-t border-border">
          <button type="button" onClick={onOpenBill} className={cardButton}>
            {t("chat.card.viewBill")}
          </button>
          {payLink ? (
            <a href={payLink} className={cardButton}>
              {t("chat.card.payUpi")}
            </a>
          ) : null}
        </div>
      </CardShell>
    );
  }
  if (card.type === "catalogue") {
    const d = card.data;
    return (
      <CardShell icon={BookOpen} title={d.title} subtitle={t("chat.card.catalogueItems", { count: d.itemCount, shop: d.payee })}>
        {d.note ? <p className="line-clamp-2 px-3 pb-2 text-xs text-text-muted">{d.note}</p> : null}
        <div className="flex border-t border-border">
          <a href={`${window.location.origin}/c/${d.token}`} target="_blank" rel="noopener noreferrer" className={cardButton}>
            {t("chat.card.openCatalogue")}
          </a>
        </div>
      </CardShell>
    );
  }
  const d = card.data;
  // Written from the reader's side: who owes whom.
  const owedByReader = (d.direction === "receivable") !== mine;
  const title = d.direction === "receivable" ? (mine ? t("chat.card.duesAskSent") : t("chat.card.duesAskReceived", { shop: d.payee })) : mine ? t("chat.card.duesPaySent") : t("chat.card.duesPayReceived", { shop: d.payee });
  const payLink = !mine && d.direction === "receivable" && d.upiId ? upiPayLink(d.upiId, d.payee, d.amount, t("chat.card.duesNote")) : null;
  return (
    <CardShell icon={Wallet} title={title} subtitle={t("chat.card.duesBills", { count: d.bills })}>
      <div className="px-3 pb-3">
        <p className={clsx("text-2xl font-bold tabular-nums", owedByReader ? "text-danger" : "text-success")}>{formatCurrency(d.amount)}</p>
        <p className="text-xs text-text-muted">{t("chat.card.asOf", { date: new Date(d.asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) })}</p>
      </div>
      {payLink ? (
        <div className="flex border-t border-border">
          <a href={payLink} className={cardButton}>
            {t("chat.card.payUpi")}
          </a>
        </div>
      ) : null}
    </CardShell>
  );
}

export function MessageBubble({
  m,
  mine,
  status,
  showTail,
  highlighted,
  actions,
  theirName,
}: {
  m: ChatMessage;
  mine: boolean;
  status: MessageStatus;
  showTail: boolean;
  highlighted: boolean;
  actions: BubbleActions;
  theirName: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Long-press on phones opens the message menu.
  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || m.local) return;
    press.current = setTimeout(() => {
      navigator.vibrate?.(15);
      actions.onMenu(m, ref.current);
    }, 450);
  };
  const endPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };

  const meta = (
    <span className={clsx("ml-2 inline-flex translate-y-1 items-center gap-1 whitespace-nowrap align-bottom text-[0.6875rem] text-text-muted", m.kind === "image" && !m.text && "absolute bottom-1.5 right-2 rounded-full bg-black/45 px-1.5 py-0.5 text-white")}>
      {timeOf(m.createdAt)}
      {mine && !m.deleted ? (
        m.local === "sending" ? (
          <Clock3 size={13} aria-label={t("chat.status.sending")} />
        ) : m.local === "failed" ? (
          <AlertCircle size={14} className="text-danger" aria-label={t("chat.status.failed")} />
        ) : (
          <Ticks status={status} className={m.kind === "image" && !m.text && status !== "read" ? "text-white" : undefined} />
        )
      ) : null}
    </span>
  );

  let body: ReactNode;
  if (m.deleted) {
    body = <p className="text-sm italic text-text-muted">{mine ? t("chat.deletedByYou") : t("chat.deleted")}{meta}</p>;
  } else if (m.kind === "image" && m.attachment) {
    const src = m.localPreview ?? thumbOf(m.attachment.url);
    body = (
      <div className="relative -mx-1.5 -mt-1">
        <button type="button" onClick={() => actions.onOpenImage(m.localPreview ?? m.attachment!.url)} className="block overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <img src={src} alt={m.text || t("chat.kind.image")} className="max-h-80 w-64 max-w-full object-cover" loading="lazy" />
        </button>
        {m.text ? <p className="whitespace-pre-wrap px-1.5 pt-1.5 text-sm text-text [overflow-wrap:anywhere]">{m.text}{meta}</p> : meta}
      </div>
    );
  } else if (m.kind === "voice" && m.attachment) {
    body = (
      <div>
        <VoicePlayer url={m.localPreview ?? m.attachment.url} duration={m.attachment.durationSec} mine={mine} />
        <div className="text-right">{meta}</div>
      </div>
    );
  } else if (m.kind === "file" && m.attachment) {
    body = (
      <div>
        <a
          href={m.attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          download={m.attachment.name}
          className="flex w-64 max-w-full items-center gap-3 rounded-lg bg-text/5 p-2.5 outline-none hover:bg-text/10 focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
            <FileText size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text">{m.attachment.name || t("chat.kind.file")}</span>
            <span className="block text-xs text-text-muted">{[fileSize(m.attachment.size), (m.attachment.name?.split(".").pop() ?? "").toUpperCase()].filter(Boolean).join(" · ")}</span>
          </span>
          <Download size={18} className="shrink-0 text-icon" aria-hidden="true" />
        </a>
        {m.text ? <p className="whitespace-pre-wrap pt-1.5 text-sm text-text [overflow-wrap:anywhere]">{m.text}</p> : null}
        <div className="text-right">{meta}</div>
      </div>
    );
  } else if (m.kind === "card" && m.card) {
    body = (
      <div>
        <CardView m={m} mine={mine} onOpenBill={() => actions.onOpenBill(m)} />
        <div className="text-right">{meta}</div>
      </div>
    );
  } else {
    body = (
      <p className="whitespace-pre-wrap text-[0.9375rem] leading-snug text-text [overflow-wrap:anywhere]">
        {m.text}
        {meta}
      </p>
    );
  }

  return (
    <div id={`msg-${m._id}`} className={clsx("group flex px-3 sm:px-6", mine ? "justify-end" : "justify-start", showTail ? "mt-2" : "mt-0.5")}>
      <div
        ref={ref}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => {
          if (m.local) return;
          e.preventDefault();
          actions.onMenu(m, ref.current);
        }}
        className={clsx(
          "relative max-w-[85%] select-text rounded-2xl px-2.5 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.06)] transition-colors sm:max-w-[70%]",
          mine ? "bg-[#ffe8d9]" : "bg-surface",
          showTail && (mine ? "rounded-tr-md" : "rounded-tl-md"),
          highlighted && "ring-2 ring-primary/50",
          m.local === "failed" && "cursor-pointer"
        )}
        onClick={m.local === "failed" ? () => actions.onRetry(m) : undefined}
      >
        {m.replyTo ? (
          <button
            type="button"
            onClick={() => actions.onJumpTo(m.replyTo!.messageId)}
            className="mb-1 block w-full rounded-lg border-l-4 border-primary bg-text/5 px-2 py-1 text-left outline-none"
          >
            <span className="block text-xs font-semibold text-primary">{m.replyTo.senderTenantId === m.senderTenantId ? (mine ? t("chat.you") : theirName) : mine ? theirName : t("chat.you")}</span>
            <span className="line-clamp-2 text-xs text-text-muted">{m.replyTo.text || t(`chat.kind.${m.replyTo.kind}`)}</span>
          </button>
        ) : null}
        {body}
        {m.local === "failed" ? <p className="mt-0.5 text-xs font-semibold text-danger">{t("chat.tapToRetry")}</p> : null}
        {!m.local && !m.deleted ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              actions.onMenu(m, ref.current);
            }}
            aria-label={t("chat.menu.open")}
            className={clsx(
              "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-surface/90 text-icon opacity-0 shadow-sm outline-none transition-opacity focus-visible:opacity-100 group-hover:opacity-100 lg:flex",
              m.kind === "image" && "bg-black/40 text-white"
            )}
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
