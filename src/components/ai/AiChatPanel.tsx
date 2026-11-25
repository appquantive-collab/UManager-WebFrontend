import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../lib/auth-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUp, Check, Copy, Gauge, Loader2, Mic, RotateCcw, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import clsx from "clsx";
import { Badge } from "../ui/Badge";
import { ApiError } from "../../lib/api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";
import { currentLanguage } from "../../lib/i18n";
import { transcribeVoice, useVoiceRecorder, useVoiceStore, voiceOutputSupported, voiceRecordingSupported } from "../../lib/speech";
import { confirmAction, dismissAction, listMessages, sendMessage, type AiChatMessage } from "../../lib/ai-chat-api";
import { getBilling } from "../../lib/billing-api";
import { WorkflowCard } from "./WorkflowCard";

// Munshi AI chat: WhatsApp-style composer (grows as you type; mic when empty,
// send when there's text), voice notes transcribed into the box for review,
// replies you can listen to or copy, optional auto-read, and suggestion chips.

function useActionLabel() {
  const { t } = useTranslation();
  return (action: NonNullable<AiChatMessage["proposedAction"]>): string => {
    if (action.type === "mark_attendance") {
      const p = action.payload as { staffName?: string; status?: string; date?: string };
      return t("ai.aiChatPanel.markAttendance", {
        staffName: p.staffName ?? t("ai.aiChatPanel.staffFallback"),
        status: String(p.status ?? "").replace("_", " "),
        date: p.date ?? "",
      });
    }
    const p = action.payload as { customerName?: string; items?: { productName: string; quantity: number }[] };
    const itemsText = (p.items ?? []).map((i) => `${i.quantity} × ${i.productName}`).join(", ");
    return t("ai.aiChatPanel.newOrderFor", {
      customerName: p.customerName ?? t("ai.aiChatPanel.customerFallback"),
      itemsText,
    });
  };
}

function ActionCard({ message }: { message: AiChatMessage }) {
  const { t } = useTranslation();
  const actionLabel = useActionLabel();
  const queryClient = useQueryClient();
  const action = message.proposedAction!;

  const confirmMutation = useMutation({
    mutationFn: () => confirmAction(message._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat-messages"] }),
    onError: (err) => showError(err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotConfirmAction")),
  });
  const dismissMutation = useMutation({
    mutationFn: () => dismissAction(message._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat-messages"] }),
    onError: (err) => showError(err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotDismissAction")),
  });

  return (
    <div className="mt-2.5 rounded-xl border border-border bg-surface p-3 shadow-card">
      <p className="text-sm font-semibold text-text">{actionLabel(action)}</p>
      {action.status === "pending" ? (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => dismissMutation.mutate()}
            disabled={confirmMutation.isPending || dismissMutation.isPending}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-muted outline-none transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            <X size={14} aria-hidden="true" /> {t("ai.aiChatPanel.dismiss")}
          </button>
          <button
            type="button"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || dismissMutation.isPending}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary outline-none transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {confirmMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} aria-hidden="true" />}
            {t("ai.aiChatPanel.confirm")}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <Badge tone={action.status === "confirmed" ? "success" : "neutral"}>
            {action.status === "confirmed" ? (action.resultSummary ?? t("ai.aiChatPanel.confirmed")) : t("ai.aiChatPanel.dismissed")}
          </Badge>
        </div>
      )}
    </div>
  );
}

/** Renders **bold** and simple "- " / "1. " lists from replies, safely (no HTML injection). */
/**
 * Today's Munshi AI tokens, under the chat header: used / daily, how many are
 * left, and a thin bar. Taps through to Settings → Plan. Refreshes after each reply.
 */
function AiUsageBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["billing"], queryFn: getBilling, staleTime: 30_000, retry: false });
  const usage = data?.usage;
  if (!usage) return null;
  const num = (n: number) => Math.round(n).toLocaleString("en-IN");
  const pct = usage.unlimited ? 0 : Math.min(100, Math.max(0, usage.todayPct));
  const tone = usage.unlimited ? "bg-success" : usage.exhausted || pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary";
  return (
    <button
      type="button"
      onClick={() => navigate("/app/settings?tab=plan")}
      className="block w-full shrink-0 border-b border-border bg-surface px-4 py-2 text-left outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
      aria-label={t("ai.chat.usageAria", { left: num(usage.remainingTokens), total: num(usage.dailyTokens) })}
    >
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-text">
          <Gauge size={14} className="shrink-0 text-icon" aria-hidden="true" />
          <span className="truncate">{t("ai.chat.usageTitle")}</span>
        </span>
        <span className="shrink-0 tabular-nums text-text-muted">
          {usage.unlimited ? (
            t("ai.chat.usageUnlimited")
          ) : usage.exhausted ? (
            <span className="font-semibold text-danger">{t("ai.chat.usageExhausted")}</span>
          ) : (
            t("ai.chat.usageLeft", { left: num(usage.remainingTokens), total: num(usage.dailyTokens) })
          )}
        </span>
      </span>
      {usage.unlimited ? null : (
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-variant" aria-hidden="true">
          <span className={clsx("block h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${pct}%` }} />
        </span>
      )}
    </button>
  );
}

function RichText({ text }: { text: string }) {
  const inline = (line: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      )
    );

  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${blocks.length}`} className={clsx("my-1 space-y-0.5 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </Tag>
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}

function RecordingTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return <span className="font-semibold tabular-nums">{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</span>;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/**
 * onBack: phone full-screen mode (WhatsApp-like): a back arrow in the header,
 * room for the notch and home bar, and no footer note.
 */
export function AiChatPanel({ onBack }: { onBack?: () => void } = {}) {
  const fullScreen = Boolean(onBack);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  // Opened after a while away (see TenantAdminLayout): Munshi greets first. Not saved; gone once you write.
  const location = useLocation();
  const routerNavigate = useNavigate();
  const ownerName = useAuthStore((state) => state.user?.name) ?? "";
  const [greeting, setGreeting] = useState<string | null>(() =>
    (location.state as { greet?: number } | null)?.greet ? (ownerName.trim() ? t("ai.chat.returnGreeting", { name: ownerName.trim().split(/\s+/)[0] }) : t("ai.chat.returnGreetingNoName")) : null
  );
  useEffect(() => {
    if (!(location.state as { greet?: number } | null)?.greet) return;
    // Forget the greet flag, so a reload doesn't greet again.
    routerNavigate(location.pathname, { replace: true, state: null });
    if (greeting && useVoiceStore.getState().enabled) useVoiceStore.getState().speak("return-greeting", greeting, currentLanguage(), { interrupt: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voiceEnabled = useVoiceStore((state) => state.enabled);
  const setVoiceEnabled = useVoiceStore((state) => state.setEnabled);
  const speak = useVoiceStore((state) => state.speak);
  const stopSpeaking = useVoiceStore((state) => state.stop);
  const speakingId = useVoiceStore((state) => state.speakingId);
  const waitingForTap = useVoiceStore((state) => state.waitingForTap);

  const suggestions = t("ai.chat.suggestions", { returnObjects: true }) as unknown as string[];

  const messagesQuery = useQuery({ queryKey: ["ai-chat-messages"], queryFn: listMessages });
  const messages = messagesQuery.data ?? [];

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: async (result) => {
      // Auto-read new replies when the speaker is on. Started before the message
      // list reloads, so the voice is being made while the text appears.
      if (useVoiceStore.getState().enabled && result?.assistantMessage?.content) {
        speak(result.assistantMessage._id, result.assistantMessage.content, currentLanguage(), { interrupt: true });
      }
      await queryClient.invalidateQueries({ queryKey: ["ai-chat-messages"] });
      // Each answer uses tokens: keep the usage bar current.
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      // Saying "haan" can do a step (add a party, record a purchase, make a bill): refresh what it touches.
      for (const key of ["customers", "suppliers", "products", "purchases", "invoices", "stock-levels", "dashboard-summary", "orders", "staff", "departments", "expenses", "daybook"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      setPendingText(null);
    },
    onError: (err, content) => {
      setPendingText(null);
      setInput((current) => current || content); // give the text back so nothing is lost
      // Plan / token-limit errors come back translated ("tokens used up — upgrade").
      showError(err instanceof ApiError && err.code ? errorMessage(err, t) : err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotReachAssistant"));
    },
  });

  // Keep the newest message in view: jump straight to it when the chat opens,
  // glide to it for new messages. Cards and images can grow after the first
  // paint, so the opening jump is repeated once the layout has settled.
  const openedRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    if (!openedRef.current) {
      openedRef.current = true;
      el.scrollTop = el.scrollHeight;
      const settle = window.setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 250);
      return () => window.clearTimeout(settle);
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, pendingText, sendMutation.isPending, greeting, waitingForTap]);

  // WhatsApp-style box: grows with the text up to ~6 lines, then scrolls.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sendMutation.isPending) return;
    stopSpeaking();
    setGreeting(null);
    setPendingText(content);
    setInput("");
    sendMutation.mutate(content);
  };

  // ---- Voice notes: record → transcribe → text box for review ----
  const recorder = useVoiceRecorder((error) =>
    showError(t(error === "denied" ? "welcomeChat.voice.micDenied" : "welcomeChat.voice.micFailed"))
  );

  const startRecording = () => {
    stopSpeaking();
    void recorder.start();
  };

  const finishRecording = async (cancel: boolean) => {
    const result = await recorder.stop(cancel);
    if (cancel || !result) return;
    if (result.durationMs < 600) {
      showError(t("ai.chat.tooShort"));
      return;
    }
    setTranscribing(true);
    try {
      const text = await transcribeVoice(result.blob, currentLanguage(), "text", { purpose: "chat", durationMs: result.durationMs });
      if (!text) {
        showError(t("welcomeChat.voice.micFailed"));
        return;
      }
      setInput((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text));
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    } catch (err) {
      // "Today's AI is used up" says so; anything else is "couldn't hear you".
      showError(err instanceof ApiError && err.code ? errorMessage(err, t) : t("welcomeChat.voice.micFailed"));
    } finally {
      setTranscribing(false);
    }
  };

  // ---- Mic button: hold to talk (release = done, slide left = cancel), or tap to start / tap ✓ to stop ----
  const holdRef = useRef<{ at: number; x: number; cancelled: boolean } | null>(null);
  const [holding, setHolding] = useState(false);
  const HOLD_MS = 350;
  const SLIDE_CANCEL_PX = 80;

  const micPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    if (recorder.recording) {
      holdRef.current = null; // tap-to-stop: handled on release
      return;
    }
    if (busy || transcribing) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Not fatal: release still arrives on the button in practice.
    }
    const hold = { at: Date.now(), x: e.clientX, cancelled: false };
    holdRef.current = hold;
    startRecording();
    // Only a real hold turns the button red (a quick tap shouldn't flash it).
    window.setTimeout(() => {
      if (holdRef.current === hold && !hold.cancelled) {
        setHolding(true);
        navigator.vibrate?.(12);
      }
    }, HOLD_MS);
  };

  const micPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const hold = holdRef.current;
    if (!hold || hold.cancelled || Date.now() - hold.at < HOLD_MS) return;
    if (e.clientX - hold.x < -SLIDE_CANCEL_PX) {
      hold.cancelled = true;
      setHolding(false);
      navigator.vibrate?.([10, 40, 10]);
      void finishRecording(true);
    }
  };

  const micPointerUp = () => {
    const hold = holdRef.current;
    holdRef.current = null;
    setHolding(false);
    if (!hold) {
      // Tapped ✓ while recording in tap mode.
      if (recorder.recording) void finishRecording(false);
      return;
    }
    if (hold.cancelled) return;
    // Held and let go: that's the end of what they said. A quick tap (or the mic
    // still starting, e.g. the permission prompt) keeps recording: tap ✓ to stop.
    if (Date.now() - hold.at >= HOLD_MS && recorder.recording) void finishRecording(false);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(t("ai.chat.copied"));
    } catch {
      showError(t("ai.chat.copyFailed"));
    }
  };

  const toggleSpeaker = () => {
    if (voiceEnabled) {
      setVoiceEnabled(false);
      return;
    }
    setVoiceEnabled(true);
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) speak(last._id, last.content, currentLanguage(), { interrupt: true });
  };

  // Phones: Enter adds a new line like WhatsApp; desktop: Enter sends, Shift+Enter for a new line.
  const enterSends = typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches;
  const hasText = input.trim().length > 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastFollowUps = lastAssistant?.followUps ?? [];
  // Munshi asked a question with tap-answers: those show instead of suggestions.
  const lastAsked = Boolean(messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.quickReplies?.length);
  const busy = sendMutation.isPending;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      {/* Header */}
      <div
        className={clsx(
          "flex items-center gap-3 border-b border-border px-4 py-3",
          fullScreen && "gap-2 bg-surface pl-1.5 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-elevation-1"
        )}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("ai.chat.back")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft size={21} aria-hidden="true" />
          </button>
        ) : null}
        <img src="/splash-munshi.webp" alt="" className="h-10 w-10 shrink-0 rounded-full border border-border object-cover object-[center_12%]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-bold leading-tight text-text">{t("brand.assistantName")}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {busy ? t("ai.chat.typing") : t("ai.chat.online")}
          </p>
        </div>
        {voiceOutputSupported ? (
          <button
            type="button"
            onClick={toggleSpeaker}
            aria-pressed={voiceEnabled}
            aria-label={t(voiceEnabled ? "welcomeChat.voice.speakerOff" : "welcomeChat.voice.speakerOn")}
            title={t(voiceEnabled ? "welcomeChat.voice.speakerOff" : "welcomeChat.voice.speakerOn")}
            className={clsx(
              "flex h-9 w-9 items-center justify-center rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              voiceEnabled ? "border-primary text-primary" : "border-border text-icon hover:text-text"
            )}
          >
            {voiceEnabled ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
          </button>
        ) : null}
      </div>

      <AiUsageBar />

      {/* Messages */}
      <div
        ref={scrollRef}
        className={clsx("min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4", fullScreen && "bg-background px-3")}
        role="log"
        aria-live="polite"
      >
        {messagesQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-surface-variant" />
            <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-surface-variant" />
          </div>
        ) : messages.length === 0 && !pendingText && !greeting ? (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <img src="/splash-munshi.webp" alt="" className="h-16 w-16 rounded-full border border-border object-cover object-[center_12%]" />
            <p className="mt-3 text-base font-bold text-text">{t("ai.chat.welcomeTitle")}</p>
            <p className="mt-1 max-w-sm text-sm text-text-muted">{t("ai.chat.welcomeBody")}</p>
            <div className="mt-4 grid w-full max-w-md gap-2 sm:grid-cols-2">
              {(Array.isArray(suggestions) ? suggestions : []).slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm text-text outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message._id} className="flex min-w-0 justify-end">
                  <div className="min-w-0 max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.9375rem] text-on-primary shadow-elevation-1 sm:max-w-md">
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</p>
                    <p className="mt-0.5 text-right text-[0.6875rem] text-on-primary/75">{timeOf(message.createdAt)}</p>
                  </div>
                </div>
              ) : (
                <div key={message._id} className="flex min-w-0 justify-start">
                  <div className="min-w-0 max-w-[88%] sm:max-w-lg">
                    <div className="min-w-0 rounded-2xl rounded-bl-md border border-border bg-surface px-3.5 py-2 text-[0.9375rem] leading-relaxed text-text shadow-elevation-1 [overflow-wrap:anywhere]">
                      <RichText text={message.content} />
                      {message.proposedAction ? <ActionCard message={message} /> : null}
                      {message.steps?.length ? <WorkflowCard message={message} /> : null}
                    </div>
                    <div className="mt-1 flex items-center gap-0.5 pl-1 text-text-muted">
                      <span className="mr-1 text-[0.6875rem]">{timeOf(message.createdAt)}</span>
                      {voiceOutputSupported ? (
                        <button
                          type="button"
                          onClick={() =>
                            speakingId === message._id ? stopSpeaking() : speak(message._id, message.content, currentLanguage(), { interrupt: true })
                          }
                          aria-label={t(speakingId === message._id ? "welcomeChat.voice.stop" : "welcomeChat.voice.replay")}
                          title={t(speakingId === message._id ? "welcomeChat.voice.stop" : "welcomeChat.voice.replay")}
                          className="flex h-8 w-8 items-center justify-center rounded-full outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {speakingId === message._id ? (
                            <Square size={11} fill="currentColor" className="text-primary" aria-hidden="true" />
                          ) : (
                            <Volume2 size={15} className="text-icon" aria-hidden="true" />
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void copy(message.content)}
                        aria-label={t("ai.chat.copy")}
                        title={t("ai.chat.copy")}
                        className="flex h-8 w-8 items-center justify-center rounded-full outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Copy size={14} className="text-icon" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
            {(() => {
              const last = messages[messages.length - 1];
              return last?.role === "assistant" && last.quickReplies?.length && !pendingText && !busy ? (
                <div className="flex flex-wrap gap-2 pl-1" aria-label={t("ai.workflow.quickReplies")}>
                  {last.quickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => handleSend(reply)}
                      className="min-h-10 rounded-full border border-primary/40 bg-surface px-3.5 text-sm font-semibold text-text outline-none transition-colors hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}
            {greeting ? (
              <div className="flex min-w-0 justify-start">
                <div className="min-w-0 max-w-[88%] rounded-2xl rounded-bl-md border border-primary/20 bg-primary-container px-3.5 py-2 text-[0.9375rem] leading-relaxed text-text shadow-elevation-1 sm:max-w-lg">
                  {greeting}
                </div>
              </div>
            ) : null}
            {pendingText ? (
              <div className="flex justify-end">
                <div className="min-w-0 max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.9375rem] text-on-primary opacity-80 sm:max-w-md">
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{pendingText}</p>
                </div>
              </div>
            ) : null}
            {busy ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3" role="status">
                  <span className="sr-only">{t("ai.aiChatPanel.thinking")}</span>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-text-muted motion-safe:animate-bounce"
                      style={{ animationDelay: `${i * 140}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Suggestions + composer */}
      <div className={clsx("border-t border-border bg-surface px-3 pb-3 pt-2", fullScreen && "pb-[max(0.5rem,env(safe-area-inset-bottom))]")}>
        {/* Text came in (typed or spoken): clear it, or say it again from scratch. */}
        {hasText && !recorder.recording && !transcribing ? (
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setInput("")}
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X size={14} className="text-icon" aria-hidden="true" />
              {t("setup.work.clear")}
            </button>
            {voiceRecordingSupported ? (
              <button
                type="button"
                onClick={() => {
                  setInput("");
                  startRecording();
                }}
                disabled={busy}
                className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              >
                <RotateCcw size={14} className="text-icon" aria-hidden="true" />
                {t("setup.work.retry")}
              </button>
            ) : null}
          </div>
        ) : null}

        {messages.length > 0 && !hasText && !recorder.recording && !lastAsked ? (
          <div className="scrollbar-hide -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
            {/* Follow-ups to the last answer when Munshi gave some; otherwise the usual starters. */}
            {(lastFollowUps.length ? lastFollowUps : Array.isArray(suggestions) ? suggestions : []).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSend(s)}
                disabled={busy}
                className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-text outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {waitingForTap ? (
          <button
            type="button"
            className="mb-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary-container px-3 text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Volume2 size={16} aria-hidden="true" />
            {t("ai.chat.tapToHear")}
          </button>
        ) : null}

        <div className="flex items-end gap-2">
          {recorder.recording ? (
            <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-3xl border border-danger/30 bg-danger-container/40 px-2.5" role="status">
              <button
                type="button"
                onClick={() => void finishRecording(true)}
                aria-label={t("ai.chat.cancelRecording")}
                title={t("ai.chat.cancelRecording")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-danger/40"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger motion-safe:animate-pulse" aria-hidden="true" />
              <RecordingTimer startedAt={recorder.startedAt} />
              <span className="min-w-0 truncate text-sm text-text-muted">{holding ? t("ai.chat.holdHint") : t("ai.chat.recordingHint")}</span>
            </div>
          ) : (
            <div className="flex min-h-12 flex-1 items-end rounded-3xl border border-border bg-background px-4 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && enterSends) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={transcribing ? t("welcomeChat.voice.understanding") : t("ai.chat.placeholder")}
                aria-label={t("ai.chat.placeholder")}
                disabled={transcribing}
                className="max-h-[10.5rem] w-full resize-none bg-transparent py-1.5 text-base leading-6 text-text outline-none placeholder:text-text-muted disabled:opacity-60"
              />
              {transcribing ? <Loader2 size={18} className="mb-2 ml-2 shrink-0 animate-spin text-icon" aria-hidden="true" /> : null}
            </div>
          )}

          {/* One round button, WhatsApp-style: mic when empty, send when there's text, ✓ while recording. */}
          {(hasText && !recorder.recording) || !voiceRecordingSupported ? (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!hasText || busy || transcribing}
              aria-label={t("ai.aiChatPanel.send")}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary outline-none transition-[transform,background-color] hover:bg-primary-hover active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-40"
            >
              <ArrowUp size={22} strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={micPointerDown}
              onPointerMove={micPointerMove}
              onPointerUp={micPointerUp}
              onPointerCancel={micPointerUp}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => {
                // Keyboard (Enter / Space): start, or stop and use what was said.
                if (e.detail !== 0) return;
                if (recorder.recording) void finishRecording(false);
                else startRecording();
              }}
              disabled={!recorder.recording && (busy || transcribing)}
              aria-label={recorder.recording ? t("ai.chat.stopRecording") : t("ai.chat.record")}
              title={recorder.recording ? undefined : t("ai.chat.record")}
              className={clsx(
                "flex h-12 w-12 shrink-0 touch-none select-none items-center justify-center rounded-full bg-primary text-on-primary outline-none transition-[transform,background-color] [-webkit-touch-callout:none] hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-40",
                holding ? "scale-125 bg-danger hover:bg-danger" : "active:scale-95"
              )}
            >
              {recorder.recording && !holding ? <Check size={22} strokeWidth={2.4} aria-hidden="true" /> : <Mic size={21} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          )}
        </div>
        {!fullScreen ? <p className="mt-1.5 px-2 text-center text-[0.6875rem] leading-snug text-text-muted">{t("ai.chat.disclaimer")}</p> : null}
      </div>
    </div>
  );
}
