import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { SupportedLanguageCode } from "./i18n";
import { API_BASE_URL } from "./api";
import { PRERECORDED_VOICE_KEYS } from "./voice-manifest";

// Munshi AI's ears and voice. Hold-to-talk clips go to our backend for Whisper
// transcription; replies are spoken in an Indian male voice (pre-recorded files
// for fixed lines, the backend's live voice otherwise, the browser's own voice
// as a last resort).

// ---------- Hold-to-talk voice messages (speech → text) ----------
// The mic records while held; on release the clip is transcribed by Whisper on
// our backend, which copes far better with Indian English, Hindi and Hinglish
// than the browser's built-in recognition (that one stops at the first pause).

export const voiceRecordingSupported =
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

export type MicError = "denied" | "failed";

const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

interface RecordingSession {
  stream?: MediaStream;
  recorder?: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  cancelled: boolean;
  finish?: (blob: Blob | null) => void;
}

function releaseMic(session: RecordingSession) {
  session.stream?.getTracks().forEach((track) => track.stop());
}

export function useVoiceRecorder(onError: (error: MicError) => void) {
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const sessionRef = useRef<RecordingSession | null>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  const start = useCallback(async () => {
    if (sessionRef.current) return;
    const session: RecordingSession = { chunks: [], startedAt: Date.now(), cancelled: false };
    sessionRef.current = session;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      session.stream = stream;
      // Released (or the permission prompt took the press) before the mic was ready.
      if (sessionRef.current !== session) {
        releaseMic(session);
        session.finish?.(null);
        return;
      }
      const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      session.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) session.chunks.push(event.data);
      };
      recorder.onstop = () => {
        releaseMic(session);
        const type = recorder.mimeType || mimeType || "audio/webm";
        session.finish?.(session.cancelled || session.chunks.length === 0 ? null : new Blob(session.chunks, { type }));
      };
      // Hand over audio every second (not only at the end), so the clip-so-far
      // can be read for a live transcript while still recording.
      recorder.start(1000);
      session.startedAt = Date.now();
      setStartedAt(session.startedAt);
      setRecording(true);
    } catch (err) {
      if (sessionRef.current === session) sessionRef.current = null;
      releaseMic(session);
      setRecording(false);
      const name = err instanceof DOMException ? err.name : "";
      onErrorRef.current(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed");
    }
  }, []);

  /** Stops recording; resolves with the clip and its length, or null if there's nothing usable. */
  const stop = useCallback((cancel = false): Promise<{ blob: Blob; durationMs: number } | null> => {
    const session = sessionRef.current;
    if (!session) return Promise.resolve(null);
    sessionRef.current = null;
    setRecording(false);
    session.cancelled = cancel;
    const durationMs = Date.now() - session.startedAt;

    return new Promise((resolve) => {
      session.finish = (blob) => resolve(blob ? { blob, durationMs } : null);
      if (session.recorder && session.recorder.state !== "inactive") session.recorder.stop();
      else if (session.stream) {
        releaseMic(session);
        resolve(null);
      }
      // Otherwise the mic is still starting; start() resolves this with null once it's ready.
    });
  }, []);

  useEffect(
    () => () => {
      const session = sessionRef.current;
      if (!session) return;
      sessionRef.current = null;
      session.cancelled = true;
      if (session.recorder && session.recorder.state !== "inactive") session.recorder.stop();
      else releaseMic(session);
    },
    []
  );

  /** The audio recorded so far (still recording), or null if nothing yet. */
  const snapshot = useCallback((): Blob | null => {
    const session = sessionRef.current;
    if (!session?.recorder || session.chunks.length === 0) return null;
    return new Blob(session.chunks, { type: session.recorder.mimeType || "audio/webm" });
  }, []);

  return { recording, startedAt, start, stop, snapshot };
}

export type TranscribeKind = "text" | "phone" | "email";

export async function transcribeVoice(
  blob: Blob,
  language: SupportedLanguageCode,
  kind: TranscribeKind,
  options: { live?: boolean } = {}
): Promise<string> {
  const form = new FormData();
  const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", blob, `voice.${extension}`);
  form.append("lang", language);
  form.append("kind", kind);
  const path = options.live ? "/munshi/transcribe/live" : "/munshi/transcribe";
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
  const { text } = (await res.json()) as { text: string };
  // Whisper sometimes "hears" these stock phrases in silence or noise.
  return /^(thank you\.?|thanks for watching!?|you\.?|\.+)$/i.test(text.trim()) ? "" : text.trim();
}

const LIVE_EVERY_MS = 2500;
const LIVE_MAX_MS = 90_000;

/**
 * Live words while the mic is on: every few seconds the clip-so-far is read
 * by Whisper and the text shown, so the person sees they're being heard. One
 * read at a time; stops refreshing after 90s (the final read on stop still
 * covers everything). Clears when a new recording starts.
 */
export function useLiveTranscript(
  recorder: { recording: boolean; startedAt: number; snapshot: () => Blob | null },
  language: SupportedLanguageCode,
  kind: TranscribeKind = "text"
): string {
  const [text, setText] = useState("");
  const { recording, startedAt, snapshot } = recorder;

  useEffect(() => {
    if (!recording) return;
    setText("");
    let alive = true;
    let lastSize = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive) return;
      const clip = snapshot();
      if (clip && clip.size > lastSize && Date.now() - startedAt < LIVE_MAX_MS) {
        lastSize = clip.size;
        try {
          const heard = await transcribeVoice(clip, language, kind, { live: true });
          if (alive && heard) setText(heard);
        } catch {
          // A missed live update is fine; the final read on stop still runs.
        }
      }
      if (alive) timer = setTimeout(() => void tick(), LIVE_EVERY_MS);
    };
    timer = setTimeout(() => void tick(), LIVE_EVERY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [recording, startedAt, snapshot, language, kind]);

  return text;
}

// ---------- Text → speech (Munshi's voice) ----------

export const speechSynthesisSupported =
  typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

// Voice names are the only gender signal browsers expose. These cover the
// common Indian voices on Windows/Edge (Ravi, Hemant, Prabhat, Madhur), Apple
// (Rishi) and a few others; anything else falls back to the best Indian voice.
const MALE_VOICE = /\b(ravi|hemant|prabhat|madhur|rishi|kunal|aarav|arjun|rehaan|male)\b/i;
const FEMALE_VOICE = /\b(heera|kalpana|swara|neerja|aashi|ananya|kavya|lekha|veena|female)\b/i;

if (speechSynthesisSupported) {
  // Chrome loads voices lazily; asking early means they're ready by the first reply.
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const target = lang.toLowerCase();
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;

  for (const voice of window.speechSynthesis.getVoices()) {
    const voiceLang = voice.lang.replace("_", "-").toLowerCase();
    let score: number;
    if (voiceLang === target) score = 10;
    else if (voiceLang.endsWith("-in")) score = 5; // another Indian voice still has the right accent
    else if (target.startsWith("en") && voiceLang.startsWith("en")) score = 2;
    else continue;

    if (MALE_VOICE.test(voice.name)) score += 6;
    if (FEMALE_VOICE.test(voice.name)) score -= 3;
    if (/natural|neural|online/i.test(voice.name)) score += 2;

    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

// Must match cleanForSpeech() in scripts/generate-voice.mjs.
// Markdown marks go, list markers go, and each line break becomes a pause, so
// a list isn't read as one breathless run.
function cleanForSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^[ \t]*(?:[-*•]|\d+[.)])[ \t]+/gm, "")
    .replace(/([^\s.!?।:,;])[ \t]*\n+/g, "$1.\n")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Munshi's voice: Indian male neural voice from our backend ----------
// The backend (/api/tts) returns MP3 in an Indian male voice for every device.
// Audio plays through Web Audio, which iOS allows once unlocked by any tap.
// If the backend can't produce audio, the browser's own voice is the fallback.

type AudioContextConstructor = typeof AudioContext;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  if (typeof window === "undefined") return null;
  const Ctor: AudioContextConstructor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

export const voiceOutputSupported = typeof window !== "undefined" && (Boolean(getAudioContext()) || speechSynthesisSupported);

if (typeof window !== "undefined") {
  // Browsers only let audio start after a user gesture, so every tap/keypress
  // makes sure Munshi's audio is unlocked; later replies then play on their own
  // with the speaker already on. Notes:
  // - On phones a touch's "pointerdown" doesn't count as a gesture (only the
  //   lift/click does), so listen to those too — this was why replies stayed
  //   silent until the speaker was switched off and on.
  // - iOS needs a sound actually started inside the gesture, so play one
  //   silent sample; it also re-locks audio after the app was in the
  //   background, so keep listening (cheap: it returns at once when running).
  let browserVoicePrimed = false;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state !== "running") {
      try {
        const source = ctx.createBufferSource();
        source.buffer = ctx.createBuffer(1, 1, 22050);
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        // Not fatal: resume() below is enough on most browsers.
      }
      void ctx.resume().catch(() => undefined);
    }
    // The browser's own voice (fallback) has the same rule on iOS.
    if (!browserVoicePrimed && speechSynthesisSupported) {
      browserVoicePrimed = true;
      try {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
      } catch {
        // Ignore: only a fallback.
      }
    }
  };
  for (const event of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
    window.addEventListener(event, unlock, { capture: true, passive: true });
  }
}

const AUDIO_CACHE_MAX = 80;
const audioCache = new Map<string, AudioBuffer>();

// Downloads already in progress, so a prefetch and the later speak() share one request.
const inFlight = new Map<string, Promise<AudioBuffer | null>>();

function fetchVoice(text: string, language: SupportedLanguageCode): Promise<AudioBuffer | null> {
  const key = `${language}|${text}`;
  const cached = audioCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = downloadVoice(key, text, language).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

/** Start fetching a line before it is shown, so Munshi starts talking as soon as it appears. */
export function prefetchVoice(text: string, language: SupportedLanguageCode) {
  const spoken = cleanForSpeech(text);
  if (spoken && getAudioContext()) void fetchVoice(spoken, language);
}

// Must match VOICE_IDS in scripts/generate-voice.mjs (and the voices in backend
// tts.service.ts). Hinglish is read by the Hindi voice after being written in Devanagari.
const VOICE_IDS: Record<SupportedLanguageCode, string> = {
  en: "en-IN-PrabhatNeural|-5%",
  "hi-Latn": "hi-IN-MadhurNeural|-5%|spoken",
  hi: "hi-IN-MadhurNeural|-5%|spoken",
};

// Same key the generator script uses to name pre-recorded files.
async function prerecordedKey(text: string, language: SupportedLanguageCode): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${VOICE_IDS[language]}|${text}`));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return PRERECORDED_VOICE_KEYS.has(key) ? key : null;
}

async function fetchAudioBytes(text: string, language: SupportedLanguageCode): Promise<ArrayBuffer | null> {
  // Fixed lines ship with the website and play instantly; only lines with names
  // or AI answers need the backend's live voice.
  const prerecorded = await prerecordedKey(text, language).catch(() => null);
  if (prerecorded) {
    try {
      const res = await fetch(`/voice/${prerecorded}.mp3`);
      if (res.ok) return await res.arrayBuffer();
    } catch {
      // Fall through to the live voice.
    }
  }
  const res = await fetch(`${API_BASE_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang: language }),
  });
  return res.ok ? res.arrayBuffer() : null;
}

async function downloadVoice(key: string, text: string, language: SupportedLanguageCode): Promise<AudioBuffer | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;

  try {
    const bytes = await fetchAudioBytes(text, language);
    if (!bytes) return null;
    const buffer = await ctx.decodeAudioData(bytes);
    audioCache.set(key, buffer);
    if (audioCache.size > AUDIO_CACHE_MAX) {
      const oldest = audioCache.keys().next().value;
      if (oldest !== undefined) audioCache.delete(oldest);
    }
    return buffer;
  } catch {
    return null;
  }
}

function speakWithBrowser(text: string, language: SupportedLanguageCode, onDone: () => void, voicesWaited = false) {
  if (!speechSynthesisSupported) {
    onDone();
    return;
  }
  const synth = window.speechSynthesis;
  // Chrome fills the voice list a moment after load; speaking before that uses the default (US) voice.
  if (synth.getVoices().length === 0 && !voicesWaited) {
    let started = false;
    const retry = () => {
      if (started) return;
      started = true;
      synth.removeEventListener?.("voiceschanged", retry);
      speakWithBrowser(text, language, onDone, true);
    };
    synth.addEventListener?.("voiceschanged", retry);
    setTimeout(retry, 1000);
    return;
  }

  const lang = language === "hi" ? "hi-IN" : "en-IN";
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  utterance.lang = voice?.lang ?? lang;
  if (voice) utterance.voice = voice;
  utterance.pitch = voice && MALE_VOICE.test(voice.name) ? 1 : 0.85;
  utterance.rate = 0.98;
  utterance.onend = onDone;
  utterance.onerror = onDone;
  synth.speak(utterance);
}

interface QueueItem {
  id: string;
  text: string;
  language: SupportedLanguageCode;
  audio: Promise<AudioBuffer | null>;
}

// Replies are read one after another; fetching starts as soon as a reply is
// queued so the next one is usually ready when the current one ends.
let queue: QueueItem[] = [];
let playing: { id: string; source?: AudioBufferSourceNode } | null = null;
// Bumped by stop(): callbacks from audio that was cancelled see a stale value and do nothing.
let generation = 0;

function playNext() {
  if (playing || queue.length === 0) return;
  const item = queue.shift()!;
  const gen = generation;
  const current: { id: string; source?: AudioBufferSourceNode } = { id: item.id };
  playing = current;

  const finish = () => {
    if (gen !== generation || playing !== current) return;
    playing = null;
    if (useVoiceStore.getState().speakingId === item.id) useVoiceStore.setState({ speakingId: null });
    playNext();
  };

  void item.audio.then((buffer) => {
    if (gen !== generation) return;
    useVoiceStore.setState({ speakingId: item.id });
    const ctx = getAudioContext();
    if (!buffer || !ctx) {
      speakWithBrowser(item.text, item.language, finish);
      return;
    }
    void ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = finish;
    current.source = source;
    source.start();
  });
}

const VOICE_ENABLED_KEY = "sethsathi.munshi-voice";

function readVoiceEnabled(): boolean {
  try {
    return localStorage.getItem(VOICE_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

interface VoiceState {
  /** When on, every new Munshi reply is read aloud. Remembered across visits. */
  enabled: boolean;
  /** Id of the message currently being read aloud, for the replay button state. */
  speakingId: string | null;
  setEnabled: (enabled: boolean) => void;
  speak: (id: string, text: string, language: SupportedLanguageCode, options?: { interrupt?: boolean }) => void;
  stop: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  enabled: voiceOutputSupported && readVoiceEnabled(),
  speakingId: null,

  setEnabled: (enabled) => {
    try {
      localStorage.setItem(VOICE_ENABLED_KEY, enabled ? "1" : "0");
    } catch {
      // Without storage the choice just isn't remembered next visit.
    }
    if (!enabled) get().stop();
    set({ enabled });
  },

  speak: (id, text, language, options) => {
    if (!voiceOutputSupported) return;
    const spoken = cleanForSpeech(text);
    if (!spoken) return;
    if (options?.interrupt) get().stop();
    queue.push({ id, text: spoken, language, audio: fetchVoice(spoken, language) });
    playNext();
  },

  stop: () => {
    generation += 1;
    queue = [];
    try {
      playing?.source?.stop();
    } catch {
      // Already finished.
    }
    playing = null;
    if (speechSynthesisSupported) window.speechSynthesis.cancel();
    set({ speakingId: null });
  },
}));
