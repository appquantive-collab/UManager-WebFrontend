import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Camera, FileText, Image as ImageIcon, Mic, Paperclip, ReceiptText, SendHorizontal, Trash2, Wallet, X } from "lucide-react";
import clsx from "clsx";
import type { ChatCardType, ChatMessage } from "../../lib/chat-api";
import { clock } from "./chat-format";

const PICK_MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
const HOLD_MS = 350;
const HINT_KEY = "voicemunshi.chat.voiceHintSeen";
const hintSeen = () => {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
};

export function Composer({
  replyTo,
  replyName,
  onCancelReply,
  onSendText,
  onSendFiles,
  onSendVoice,
  onShare,
  onTyping,
  blocked,
  onUnblock,
}: {
  replyTo: ChatMessage | null;
  replyName: string;
  onCancelReply: () => void;
  onSendText: (text: string) => void;
  onSendFiles: (files: File[], kind: "image" | "file") => void;
  onSendVoice: (blob: Blob, durationSec: number) => void;
  onShare: (type: ChatCardType) => void;
  onTyping: (typing: boolean) => void;
  blocked: boolean;
  onUnblock: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [recording, setRecording] = useState<null | { locked: boolean; started: number }>(null);
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  // How to record is explained until the first voice note goes out.
  const [showHint, setShowHint] = useState(() => !hintSeen());
  const area = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const discard = useRef(false);
  const pressedAt = useRef(0);
  /** The finger came up before the mic was ready (e.g. while the permission prompt showed). */
  const releasedEarly = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Grow the box with the text, up to ~5 lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  useEffect(() => {
    if (replyTo) area.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((Date.now() - recording.started) / 1000), 200);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  // Leaving the chat mid-recording throws the recording away.
  useEffect(
    () => () => {
      discard.current = true;
      recorder.current?.stream.getTracks().forEach((tr) => tr.stop());
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    []
  );

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSendText(value);
    setText("");
    onTyping(false);
    area.current?.focus();
  };

  const startRecording = async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError(t("chat.voice.unsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mimeType = PICK_MIME.find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
      chunks.current = [];
      discard.current = false;
      const started = Date.now();
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const seconds = (Date.now() - started) / 1000;
        if (discard.current || seconds < 0.8 || chunks.current.length === 0) return;
        onSendVoice(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }), Math.round(seconds));
        setShowHint(false);
        try {
          localStorage.setItem(HINT_KEY, "1");
        } catch {
          // private mode: the hint shows again next time
        }
      };
      rec.start(250);
      recorder.current = rec;
      setElapsed(0);
      setRecording({ locked: releasedEarly.current, started });
      navigator.vibrate?.(20);
    } catch {
      setMicError(t("chat.voice.denied"));
    }
  };

  const stopRecording = (keep: boolean) => {
    discard.current = !keep;
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    setRecording(null);
  };

  // Hold the mic to record and let go to send; a quick tap keeps it recording (send / delete buttons).
  const micDown = (e: React.PointerEvent) => {
    e.preventDefault();
    pressedAt.current = Date.now();
    releasedEarly.current = false;
    if (!recording) void startRecording();
  };
  const micUp = () => {
    if (!recorder.current) {
      releasedEarly.current = true;
      return;
    }
    if (Date.now() - pressedAt.current < HOLD_MS) setRecording((r) => (r ? { ...r, locked: true } : r));
    else if (recording && !recording.locked) stopRecording(true);
  };

  if (blocked) {
    return (
      <div className="shrink-0 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm text-text-muted">
        {t("chat.blockedNotice")}{" "}
        <button type="button" onClick={onUnblock} className="font-semibold text-primary underline-offset-2 hover:underline">
          {t("chat.unblock")}
        </button>
      </div>
    );
  }

  const shareItems: { key: string; icon: typeof Camera; label: string; tone: string; onClick: () => void }[] = [
    { key: "photo", icon: ImageIcon, label: t("chat.attach.photo"), tone: "bg-[#7c3aed]", onClick: () => photoInput.current?.click() },
    { key: "camera", icon: Camera, label: t("chat.attach.camera"), tone: "bg-[#db2777]", onClick: () => cameraInput.current?.click() },
    { key: "file", icon: FileText, label: t("chat.attach.file"), tone: "bg-[#2563eb]", onClick: () => fileInput.current?.click() },
    { key: "bill", icon: ReceiptText, label: t("chat.attach.bill"), tone: "bg-primary", onClick: () => onShare("bill") },
    { key: "catalogue", icon: BookOpen, label: t("chat.attach.catalogue"), tone: "bg-[#0d9488]", onClick: () => onShare("catalogue") },
    { key: "dues", icon: Wallet, label: t("chat.attach.dues"), tone: "bg-[#16a34a]", onClick: () => onShare("dues") },
  ];

  const pickFiles = (list: FileList | null, kind: "image" | "file") => {
    const files = Array.from(list ?? []).slice(0, 10);
    if (files.length) onSendFiles(files, kind);
  };

  return (
    <div className="shrink-0 border-t border-border bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {replyTo ? (
        <div className="mx-3 mt-2 flex items-start gap-2 rounded-xl border-l-4 border-primary bg-surface-muted px-3 py-2 sm:mx-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">{replyName}</p>
            <p className="line-clamp-2 text-sm text-text-muted">{replyTo.text || replyTo.attachment?.name || t(`chat.kind.${replyTo.kind}`)}</p>
          </div>
          <button type="button" onClick={onCancelReply} aria-label={t("chat.cancelReply")} className="rounded-full p-1 text-icon hover:bg-surface-variant">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {micError ? (
        <p role="alert" className="mx-3 mt-2 rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white sm:mx-4">
          {micError}
        </p>
      ) : null}

      <div className="flex items-end gap-2 px-2 pt-2 sm:px-4">
        {recording ? (
          <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-surface-muted px-4" role="status" aria-live="polite">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            <span className="text-sm font-semibold tabular-nums text-text">{clock(elapsed)}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{recording.locked ? t("chat.voice.recording") : t("chat.voice.releaseToSend")}</span>
            <button type="button" onClick={() => stopRecording(false)} aria-label={t("chat.voice.discard")} className="rounded-full p-1.5 text-danger hover:bg-danger/10">
              <Trash2 size={19} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="relative flex min-w-0 flex-1 items-end rounded-3xl border border-border bg-surface-muted focus-within:border-primary/60" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t("chat.attach.open")}
              aria-expanded={menuOpen}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-icon outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Paperclip size={20} className={clsx("transition-transform", menuOpen && "rotate-45")} aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="absolute bottom-full left-0 z-20 mb-2 grid w-[min(20rem,calc(100vw-1.5rem))] grid-cols-3 gap-y-4 rounded-2xl border border-border bg-surface p-4 shadow-elevation-3" role="menu">
                {shareItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick();
                    }}
                    className="flex flex-col items-center gap-1.5 rounded-xl text-xs font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span className={clsx("flex h-12 w-12 items-center justify-center rounded-full text-white", item.tone)}>
                      <item.icon size={21} aria-hidden="true" />
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="sr-only" htmlFor="chat-input">
              {t("chat.placeholder")}
            </label>
            <textarea
              id="chat-input"
              ref={area}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onTyping(e.target.value.length > 0);
              }}
              onBlur={() => onTyping(false)}
              onKeyDown={(e) => {
                // Enter sends on a computer; on phones Enter is a new line.
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t("chat.placeholder")}
              className="max-h-[8.25rem] min-h-11 min-w-0 flex-1 resize-none bg-transparent py-3 pr-4 text-[0.9375rem] leading-5 text-text outline-none placeholder:text-text-muted"
            />
          </div>
        )}

        {text.trim() || recording?.locked ? (
          <button
            type="button"
            onClick={() => (recording ? stopRecording(true) : send())}
            aria-label={t("chat.send")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <SendHorizontal size={20} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={micDown}
            onPointerUp={micUp}
            onPointerCancel={() => recording && !recording.locked && stopRecording(false)}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (recording) stopRecording(true);
                else {
                  pressedAt.current = Date.now();
                  void startRecording().then(() => setRecording((r) => (r ? { ...r, locked: true } : r)));
                }
              }
            }}
            aria-label={recording ? t("chat.voice.releaseToSend") : t("chat.voice.hold")}
            className={clsx(
              "flex h-12 w-12 shrink-0 touch-none select-none items-center justify-center rounded-full text-white shadow-brand outline-none transition-transform focus-visible:ring-2 focus-visible:ring-primary/40",
              recording ? "scale-110 bg-danger" : "bg-brand-gradient"
            )}
          >
            <Mic size={21} aria-hidden="true" />
          </button>
        )}
      </div>
      {showHint && !recording && !text ? <p className="px-4 pt-1 text-center text-[0.6875rem] text-text-muted sm:hidden">{t("chat.voice.hint")}</p> : null}

      <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => (pickFiles(e.target.files, "image"), (e.target.value = ""))} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (pickFiles(e.target.files, "image"), (e.target.value = ""))} />
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,application/pdf"
        multiple
        hidden
        onChange={(e) => (pickFiles(e.target.files, "file"), (e.target.value = ""))}
      />
    </div>
  );
}
