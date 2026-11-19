import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { SupportedLanguageCode } from "./i18n";
import { API_BASE_URL, ApiError } from "./api";
import { useAuthStore } from "./auth-store";

/** Signed-in requests let the server put AI costs (speech, voice) on the right business. */
function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
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

/** Extra listening after stop is pressed, so the last word isn't clipped. */
const TAIL_MS = 600;

function releaseMic(session: RecordingSession) {
  session.stream?.getTracks().forEach((track) => track.stop());
  // Back to the loudspeaker (iPhone otherwise keeps sound on the quiet earpiece).
  audioSessionForMic(false);
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
      audioSessionForMic(true);
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
      if (session.recorder && session.recorder.state !== "inactive") {
        // People press stop while still saying the last word: keep listening a
        // moment longer so it isn't cut off (cancel stops at once).
        const recorder = session.recorder;
        window.setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, cancel ? 0 : TAIL_MS);
      }
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
  /**
   * live: quick preview read while the mic is on.
   * purpose: what they're saying it for; Munshi AI then fixes what speech-to-text misheard ("Raksin" → rexine).
   */
  options: { live?: boolean; purpose?: "business" | "order" | "chat"; durationMs?: number } = {}
): Promise<string> {
  const form = new FormData();
  const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", blob, `voice.${extension}`);
  form.append("lang", language);
  form.append("kind", kind);
  if (options.purpose && !options.live) form.append("purpose", options.purpose);
  if (options.durationMs) form.append("durationMs", String(Math.round(options.durationMs)));
  const path = options.live ? "/munshi/transcribe/live" : "/munshi/transcribe";
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body: form, headers: authHeader() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (body.code) throw new ApiError(body.error ?? "Transcription failed", res.status, body.code);
    throw new Error(`Transcription failed: ${res.status}`);
  }
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
          const heard = await transcribeVoice(clip, language, kind, { live: true, durationMs: Date.now() - startedAt });
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
// It plays through one shared <audio> element: phones let a page play sound
// only after a tap, and an element that has played once inside a tap may play
// again later on its own. (Web Audio was used before; on phones it could sit
// "suspended" after the mic was used, and a reply then never finished, so
// nothing after it was heard until the speaker was switched off and on.)
// If the backend can't produce audio, the browser's own voice is the fallback.

type AudioSessionType = "auto" | "playback" | "play-and-record" | "ambient" | "transient" | "transient-solo";

/**
 * iPhone (Safari 17+): "playback" makes Munshi heard through the loudspeaker
 * even on silent; "play-and-record" while the mic is on. Setting it back to
 * playback after recording also moves sound off the quiet earpiece.
 */
function setAudioSession(type: AudioSessionType) {
  const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!audioSession) return;
  try {
    audioSession.type = type;
  } catch {
    // Older Safari: nothing to change.
  }
}

/** Called by the recorder: mic on → record mode; mic off → loudspeaker playback again. */
export function audioSessionForMic(micOn: boolean) {
  setAudioSession(micOn ? "play-and-record" : "playback");
}

let player: HTMLAudioElement | null = null;
/** The shared element has played inside a tap, so it may play on its own now. */
let unlocked = false;
/** A reply is loaded in the element (so a tap mustn't swap in the silent clip). */
let playerBusy = false;
/** A reply the phone refused to start; it plays on the next tap anywhere. */
let blockedResume: (() => void) | null = null;
let silentUrl: string | null = null;
/** Which clip owns the element; a late timer from an older clip must not touch it. */
let playToken = 0;

function getPlayer(): HTMLAudioElement | null {
  if (player) return player;
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  setAudioSession("playback");
  player = new Audio();
  player.preload = "auto";
  player.setAttribute("playsinline", "");
  return player;
}

/** A tenth of a second of silence (WAV), played inside a tap to unlock the element. */
function silentClip(): string {
  if (silentUrl) return silentUrl;
  const samples = 800;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silentUrl;
}

export const voiceOutputSupported = typeof window !== "undefined" && (typeof Audio !== "undefined" || speechSynthesisSupported);

if (typeof window !== "undefined") {
  // Every tap/keypress keeps Munshi's audio unlocked, so replies play on their
  // own with the speaker on. On phones a touch's "pointerdown" isn't a gesture
  // (only the lift/click is), so those are listened to as well.
  let browserVoicePrimed = false;
  const unlock = () => {
    // A reply that was refused plays now, inside this tap.
    if (blockedResume) {
      const resume = blockedResume;
      blockedResume = null;
      useVoiceStore.setState({ waitingForTap: false });
      resume();
    } else if (!unlocked && !playerBusy) {
      const el = getPlayer();
      if (el) {
        el.src = silentClip();
        el.play().then(
          () => {
            unlocked = true;
          },
          () => undefined
        );
      }
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
  for (const event of ["pointerup", "touchend", "click", "keydown"]) {
    window.addEventListener(event, unlock, { capture: true, passive: true });
  }
  // Coming back to the app: iOS may have locked audio again.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      unlocked = false;
      setAudioSession("playback");
    }
  });
}

const AUDIO_CACHE_MAX = 80;
/** Spoken text → object URL of its audio. */
const audioCache = new Map<string, string>();

// Downloads already in progress, so a prefetch and the later speak() share one request.
const inFlight = new Map<string, Promise<string | null>>();

function fetchVoice(text: string, language: SupportedLanguageCode): Promise<string | null> {
  const key = `${language}|${text}`;
  const cached = audioCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = downloadVoice(key, text, language).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

// Must match VOICE_IDS in scripts/generate-voice.mjs (and the voices in backend
// tts.service.ts). Hinglish is read by the Hindi voice after being written in Devanagari.
const VOICE_IDS: Record<SupportedLanguageCode, string> = {
  en: "en-IN-PrabhatNeural|-5%",
  "hi-Latn": "sarvam|v3_shubh|exact",
  hi: "sarvam|v3_shubh|exact",
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

async function fetchAudio(text: string, language: SupportedLanguageCode): Promise<Blob | null> {
  // Fixed lines ship with the website and play instantly; only lines with names
  // or AI answers need the backend's live voice.
  const prerecorded = await prerecordedKey(text, language).catch(() => null);
  if (prerecorded) {
    try {
      const res = await fetch(`/voice/${prerecorded}.mp3`);
      if (res.ok) return await res.blob();
    } catch {
      // Fall through to the live voice.
    }
  }
  const res = await fetch(`${API_BASE_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ text, lang: language }),
  });
  return res.ok ? res.blob() : null;
}

async function downloadVoice(key: string, text: string, language: SupportedLanguageCode): Promise<string | null> {
  try {
    const blob = await fetchAudio(text, language);
    if (!blob || blob.size === 0) return null;
    const url = URL.createObjectURL(blob);
    audioCache.set(key, url);
    if (audioCache.size > AUDIO_CACHE_MAX) {
      const oldest = audioCache.keys().next().value;
      // Not revoked: a queued reply may still be about to play it.
      if (oldest !== undefined) audioCache.delete(oldest);
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Long replies are spoken in pieces, split at sentence ends: the first piece is
 * short, so its voice is ready in about a second and Munshi starts talking
 * while the rest is still being made (all pieces are fetched at once).
 */
function splitForSpeech(text: string): string[] {
  if (text.length <= 110) return [text];
  const sentences = text
    .replace(/([.!?।]+["')\]]*)\s+/g, "$1\u0000")
    .split("\u0000")
    .flatMap((s) => (s.length > 220 ? s.replace(/,\s+/g, ",\u0000").split("\u0000") : [s]))
    .map((s) => s.trim())
    .filter(Boolean);
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const limit = parts.length === 0 ? 90 : 260;
    if (!current) current = sentence;
    else if (current.length + 1 + sentence.length <= limit) current += ` ${sentence}`;
    else {
      parts.push(current);
      current = sentence;
    }
    // Start talking as soon as there's a sensible first piece.
    if (parts.length === 0 && current.length >= 40) {
      parts.push(current);
      current = "";
    }
  }
  if (current) parts.push(current);
  return parts;
}

interface Part {
  text: string;
  audio: Promise<string | null>;
}

async function planParts(text: string, language: SupportedLanguageCode): Promise<Part[]> {
  // Fixed lines are recorded whole; don't split those.
  const whole = (await prerecordedKey(text, language).catch(() => null)) !== null;
  const pieces = whole ? [text] : splitForSpeech(text);
  return pieces.map((piece) => ({ text: piece, audio: fetchVoice(piece, language) }));
}

/** Start fetching a line before it is shown, so Munshi starts talking as soon as it appears. */
export function prefetchVoice(text: string, language: SupportedLanguageCode) {
  const spoken = cleanForSpeech(text);
  if (spoken && voiceOutputSupported) void planParts(spoken, language);
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

type PlayResult = "ended" | "blocked" | "error";

/** Play one clip on the shared element; resolves when it ends (or can't play). */
function playUrl(url: string): Promise<PlayResult> {
  const el = getPlayer();
  if (!el) return Promise.resolve("error");
  const token = ++playToken;
  return new Promise((resolve) => {
    let done = false;
    let guard: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: PlayResult) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      if (token === playToken) {
        el.onended = null;
        el.onerror = null;
        el.onpause = null;
        playerBusy = false;
      }
      resolve(result);
    };
    playerBusy = true;
    el.onended = () => finish("ended");
    el.onerror = () => finish("error");
    el.src = url;
    el.play().then(
      () => {
        unlocked = true;
        // Paused by the system (a call, another app) or stopped: move on.
        el.onpause = () => {
          if (!el.ended) finish("ended");
        };
        // Never let one stuck clip hold up every reply after it.
        const seconds = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 60;
        guard = setTimeout(() => finish("ended"), seconds * 1000 + 4000);
      },
      (err: unknown) => finish(err instanceof DOMException && err.name === "NotAllowedError" ? "blocked" : "error")
    );
  });
}

interface QueueItem {
  id: string;
  language: SupportedLanguageCode;
  parts: Promise<Part[]>;
}

// Replies are read one after another; fetching starts as soon as a reply is
// queued so the next one is usually ready when the current one ends.
let queue: QueueItem[] = [];
let playing: { id: string } | null = null;
// Bumped by stop(): work for audio that was cancelled sees a stale value and stops.
let generation = 0;

async function runItem(item: QueueItem, gen: number) {
  const parts = await item.parts;
  for (const part of parts) {
    if (gen !== generation) return;
    const url = await part.audio;
    if (gen !== generation) return;
    useVoiceStore.setState({ speakingId: item.id });
    if (!url) {
      await new Promise<void>((done) => speakWithBrowser(part.text, item.language, done));
      continue;
    }
    let result = await playUrl(url);
    if (result === "blocked" && gen === generation) {
      // The phone wants a tap first: wait for one (anywhere), then play inside it.
      unlocked = false;
      useVoiceStore.setState({ waitingForTap: true });
      result = await new Promise<PlayResult>((resolve) => {
        blockedResume = () => void playUrl(url).then(resolve);
        waitingCancel = () => resolve("error");
      });
      waitingCancel = null;
    }
    if (result !== "ended" && gen === generation) {
      // Couldn't play this piece: say it with the phone's own voice instead of skipping it.
      await new Promise<void>((done) => speakWithBrowser(part.text, item.language, done));
    }
  }
}

/** Ends a wait for a tap when everything is stopped. */
let waitingCancel: (() => void) | null = null;

function playNext() {
  if (playing || queue.length === 0) return;
  const item = queue.shift()!;
  const gen = generation;
  const current = { id: item.id };
  playing = current;
  void runItem(item, gen)
    .catch(() => undefined)
    .finally(() => {
      if (gen !== generation || playing !== current) return;
      playing = null;
      if (useVoiceStore.getState().speakingId === item.id) useVoiceStore.setState({ speakingId: null });
      playNext();
    });
}

const VOICE_ENABLED_KEY = "sethsathi.munshi-voice";

/** Munshi speaks by default; only someone who turned the speaker off ("0") stays silent. */
function readVoiceEnabled(): boolean {
  try {
    return localStorage.getItem(VOICE_ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

interface VoiceState {
  /** When on, every new Munshi reply is read aloud. Remembered across visits. */
  enabled: boolean;
  /** Id of the message currently being read aloud, for the replay button state. */
  speakingId: string | null;
  /** The phone blocked the voice until the next tap (shown as "tap to hear"). */
  waitingForTap: boolean;
  setEnabled: (enabled: boolean) => void;
  speak: (id: string, text: string, language: SupportedLanguageCode, options?: { interrupt?: boolean }) => void;
  stop: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  enabled: voiceOutputSupported && readVoiceEnabled(),
  speakingId: null,
  waitingForTap: false,

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
    queue.push({ id, language, parts: planParts(spoken, language) });
    playNext();
  },

  stop: () => {
    generation += 1;
    queue = [];
    blockedResume = null;
    playToken += 1;
    waitingCancel?.();
    waitingCancel = null;
    if (player && playerBusy) {
      player.onended = null;
      player.onerror = null;
      player.onpause = null;
      player.pause();
      playerBusy = false;
    }
    playing = null;
    if (speechSynthesisSupported) window.speechSynthesis.cancel();
    set({ speakingId: null, waitingForTap: false });
  },
}));
