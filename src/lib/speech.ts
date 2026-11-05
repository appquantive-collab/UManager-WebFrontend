import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { SupportedLanguageCode } from "./i18n";
import { API_BASE_URL } from "./api";

// Free, on-device speech using the browser's Web Speech API: the mic turns
// speech into text, and replies are read aloud by a system voice. Nothing is
// sent to our servers. Availability and voices depend on the browser/OS.

// ---------- Speech → text (microphone) ----------

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent extends Event {
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent extends Event {
  readonly error: string;
}
interface Recognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechRecognitionSupported = recognitionConstructor() !== null;

export type MicError = "denied" | "failed";

/** Indian-English recognition copes best with Hinglish; Hindi gets Devanagari text. */
export function recognitionLang(language: SupportedLanguageCode): string {
  return language === "hi" ? "hi-IN" : "en-IN";
}

export function useSpeechRecognition(onText: (text: string, isFinal: boolean) => void, onError: (error: MicError) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const handlersRef = useRef({ onText, onError });

  useEffect(() => {
    handlersRef.current = { onText, onError };
  });

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback((lang: string) => {
    const Ctor = recognitionConstructor();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let text = "";
      let isFinal = true;
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
        if (!event.results[i].isFinal) isFinal = false;
      }
      handlersRef.current.onText(text, isFinal);
    };
    recognition.onerror = (event) => {
      // Silence and our own stop() aren't errors worth telling the user about.
      if (event.error === "no-speech" || event.error === "aborted") return;
      handlersRef.current.onError(
        event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "failed"
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      handlersRef.current.onError("failed");
    }
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { listening, start, stop };
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

function cleanForSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}️?/gu, "")
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
  // Browsers only let audio start after a user gesture; resume on the first one
  // (e.g. the splash's "Get started" tap) so later replies can play on their own.
  const unlock = () => {
    void getAudioContext()?.resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
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

async function downloadVoice(key: string, text: string, language: SupportedLanguageCode): Promise<AudioBuffer | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: language }),
    });
    if (!res.ok) return null;
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
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
