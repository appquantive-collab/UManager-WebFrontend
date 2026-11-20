import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Play, Square, Volume2 } from "lucide-react";
import clsx from "clsx";
import { getPlatformSettings, updatePlatformSettings, type PlatformSettings } from "../../lib/billing-api";
import { previewVoice } from "../../lib/admin-session";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";

const ENGINES: { key: PlatformSettings["ttsEngine"]; title: string; body: string }[] = [
  { key: "auto", title: "Auto (recommended)", body: "Sarvam's natural Indian voice; Microsoft voice if Sarvam fails or credits run out." },
  { key: "sarvam", title: "Sarvam only", body: "No backup: Munshi stays silent if Sarvam fails." },
  { key: "edge", title: "Microsoft voice only", body: "Free Madhur voice. No Sarvam credits used." },
];

/** Who speaks Munshi's Hindi / Hinglish replies, and which Sarvam voice — with a listen button for each. */
export function VoiceCard() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["platform-settings"], queryFn: getPlatformSettings });
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const save = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["platform-settings"], data);
      showSuccess("Voice setting saved");
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : "Couldn't save"),
  });

  const listen = async (key: string) => {
    audioRef.current?.pause();
    if (playing === key) {
      setPlaying(null);
      return;
    }
    setLoading(key);
    try {
      const url = URL.createObjectURL(await previewVoice(key));
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
      setPlaying(key);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Couldn't play this voice");
    } finally {
      setLoading(null);
    }
  };

  const s = settings.data;
  if (!s) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Volume2 size={18} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
        <div>
          <h3 className="text-base font-bold text-text">Munshi&apos;s voice (Hindi / Hinglish)</h3>
          <p className="text-sm text-text-muted">Who reads Munshi&apos;s replies aloud, for every business. English replies keep the Microsoft voice.</p>
        </div>
      </div>

      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Voice engine">
        {ENGINES.map((e) => {
          const selected = s.ttsEngine === e.key;
          return (
            <button
              key={e.key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={save.isPending}
              onClick={() => !selected && save.mutate({ ttsEngine: e.key })}
              className={clsx(
                "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60",
                selected ? "border-primary bg-primary-container" : "border-border hover:bg-surface-muted"
              )}
            >
              <span
                className={clsx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-primary bg-primary text-on-primary" : "border-border")}
                aria-hidden="true"
              >
                {selected ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span>
                <span className="block text-sm font-semibold text-text">{e.title}</span>
                <span className="block text-xs text-text-muted">{e.body}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-sm font-semibold text-text">Sarvam voice</p>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {s.voices.map((v) => {
          const selected = s.ttsVoice === v.key;
          return (
            <li key={v.key} className={clsx("flex items-center gap-3 px-3.5 py-2.5", selected && "bg-primary-container")}>
              <button
                type="button"
                onClick={() => void listen(v.key)}
                disabled={loading !== null && loading !== v.key}
                aria-label={playing === v.key ? `Stop ${v.label}` : `Listen to ${v.label}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              >
                {loading === v.key ? <Loader2 size={15} className="animate-spin" /> : playing === v.key ? <Square size={12} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
              </button>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-text">{v.label}</span>
                <span className="block text-xs text-text-muted">{v.model === "bulbul:v3" ? "₹3 per 1,000 characters" : "₹1 per 1,000 characters"}</span>
              </span>
              {selected ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
                  <Check size={14} aria-hidden="true" /> In use
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => save.mutate({ ttsVoice: v.key })}
                  disabled={save.isPending}
                  className="min-h-9 shrink-0 rounded-lg border border-border px-3 text-xs font-semibold text-text outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                >
                  Use this
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-text-muted">
        {!s.sarvamConfigured
          ? "No Sarvam key on the server (KEY_SARVAM): the Microsoft voice is used."
          : s.sarvamVoiceAvailable
            ? "Sarvam voice: key set and working. Listening to a sample uses a little Sarvam credit."
            : "Sarvam voice: paused for an hour after a credits or key error. The Microsoft voice is being used."}
      </p>
    </section>
  );
}
