import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Check, Copy, Loader2, Mic, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import clsx from "clsx";
import { Badge } from "../ui/Badge";
import { ApiError } from "../../lib/api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";
import { currentLanguage } from "../../lib/i18n";
import { transcribeVoice, useVoiceRecorder, useVoiceStore, voiceOutputSupported, voiceRecordingSupported } from "../../lib/speech";
import { confirmAction, dismissAction, listMessages, sendMessage, type AiChatMessage } from "../../lib/ai-chat-api";

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
    <div className="mt-2.5 rounded-xl border border-border bg-surface p-3">
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

export function AiChatPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voiceEnabled = useVoiceStore((state) => state.enabled);
  const setVoiceEnabled = useVoiceStore((state) => state.setEnabled);
  const speak = useVoiceStore((state) => state.speak);
  const stopSpeaking = useVoiceStore((state) => state.stop);
  const speakingId = useVoiceStore((state) => state.speakingId);

  const suggestions = t("ai.chat.suggestions", { returnObjects: true }) as unknown as string[];

  const messagesQuery = useQuery({ queryKey: ["ai-chat-messages"], queryFn: listMessages });
  const messages = messagesQuery.data ?? [];

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["ai-chat-messages"] });
      setPendingText(null);
      // Auto-read new replies when the speaker is on.
      if (useVoiceStore.getState().enabled && result?.assistantMessage?.content) {
        speak(result.assistantMessage._id, result.assistantMessage.content, currentLanguage(), { interrupt: true });
      }
    },
    onError: (err, content) => {
      setPendingText(null);
      setInput((current) => current || content); // give the text back so nothing is lost
      // Plan / token-limit errors come back translated ("tokens used up — upgrade").
      showError(err instanceof ApiError && err.code ? errorMessage(err, t) : err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotReachAssistant"));
    },
  });

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pendingText, sendMutation.isPending]);

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
      const text = await transcribeVoice(result.blob, currentLanguage(), "text");
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
    } catch {
      showError(t("welcomeChat.voice.micFailed"));
    } finally {
      setTranscribing(false);
    }
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
  const busy = sendMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {messagesQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-surface-variant" />
            <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-surface-variant" />
          </div>
        ) : messages.length === 0 && !pendingText ? (
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
                <div key={message._id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.9375rem] text-on-primary shadow-elevation-1 sm:max-w-md">
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p className="mt-0.5 text-right text-[0.6875rem] text-on-primary/75">{timeOf(message.createdAt)}</p>
                  </div>
                </div>
              ) : (
                <div key={message._id} className="flex justify-start">
                  <div className="max-w-[88%] sm:max-w-lg">
                    <div className="rounded-2xl rounded-bl-md border border-border bg-surface px-3.5 py-2 text-[0.9375rem] leading-relaxed text-text shadow-elevation-1">
                      <RichText text={message.content} />
                      {message.proposedAction ? <ActionCard message={message} /> : null}
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
            {pendingText ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.9375rem] text-on-primary opacity-80 sm:max-w-md">
                  <p className="whitespace-pre-wrap break-words">{pendingText}</p>
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
      <div className="border-t border-border bg-surface px-3 pb-3 pt-2">
        {messages.length > 0 && !hasText && !recorder.recording ? (
          <div className="scrollbar-hide -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
            {(Array.isArray(suggestions) ? suggestions : []).map((s) => (
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

        <div className="flex items-end gap-2">
          {recorder.recording ? (
            <div className="flex min-h-12 flex-1 items-center gap-3 rounded-3xl border border-danger/30 bg-danger-container/40 px-3" role="status">
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
              <span className="min-w-0 truncate text-sm text-text-muted">{t("ai.chat.recordingHint")}</span>
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
          {recorder.recording ? (
            <button
              type="button"
              onClick={() => void finishRecording(false)}
              aria-label={t("ai.chat.stopRecording")}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              <Check size={22} strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : hasText || !voiceRecordingSupported ? (
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
              onClick={startRecording}
              disabled={busy || transcribing}
              aria-label={t("ai.chat.record")}
              title={t("ai.chat.record")}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary outline-none transition-[transform,background-color] hover:bg-primary-hover active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-40"
            >
              <Mic size={21} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-2 text-center text-[0.6875rem] leading-snug text-text-muted">{t("ai.chat.disclaimer")}</p>
      </div>
    </div>
  );
}
