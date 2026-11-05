import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import clsx from "clsx";
import { ArrowUp, Mic, PartyPopper, Square, Volume2, VolumeX, X } from "lucide-react";
import i18n, { currentLanguage, supportedLanguages, type SupportedLanguageCode } from "../../lib/i18n";
import { register as registerTenant } from "../../lib/auth-api";
import { askMunshi } from "../../lib/munshi-api";
import { ApiError } from "../../lib/api";
import { useAuthStore } from "../../lib/auth-store";
import { useSplashStore } from "../../lib/splash-store";
import { showError } from "../../lib/toast";
import {
  prefetchVoice,
  recognitionLang,
  speechRecognitionSupported,
  voiceOutputSupported,
  useSpeechRecognition,
  useVoiceStore,
} from "../../lib/speech";

// A scripted sign-up conversation in Munshi AI's voice. It is deliberately not
// LLM-driven: it collects a password, which must never be sent to the model,
// and every answer has to pass the same validation as the register form.

type Field = "name" | "business" | "phone" | "email" | "password";
type Step = "choose" | "language" | Field | "preview" | "editPick" | "creating" | "done";

interface Draft {
  language: SupportedLanguageCode;
  name: string;
  business: string;
  phone: string;
  email: string;
  password: string;
}

type ChatMessage =
  | { id: number; role: "bot"; key: string; params?: Record<string, string>; tone?: "success" }
  | { id: number; role: "bot"; preview: Draft }
  | { id: number; role: "bot"; text: string; tone?: undefined }
  | { id: number; role: "user"; text: string };

type NewMessage =
  | { role: "bot"; key: string; params?: Record<string, string>; tone?: "success" }
  | { role: "bot"; preview: Draft }
  | { role: "bot"; text: string; tone?: undefined }
  | { role: "user"; text: string };

const CHOICE_STEPS = ["choose", "language", "preview", "editPick", "done"] as const;

const FIELD_ORDER: Field[] = ["name", "business", "phone", "email", "password"];

const fieldSchemas: Record<Field, z.ZodType<string>> = {
  name: z.string().min(2),
  business: z.string().min(2),
  phone: z.string().regex(/^\d{10}$/),
  email: z.string().email(),
  password: z.string().min(8),
};

const fieldErrorKey: Record<Field, string> = {
  name: "welcomeChat.errors.nameTooShort",
  business: "welcomeChat.errors.businessTooShort",
  phone: "welcomeChat.errors.phoneInvalid",
  email: "welcomeChat.errors.emailInvalid",
  password: "welcomeChat.errors.passwordTooShort",
};

const fieldPromptKey: Record<Field, string> = {
  name: "welcomeChat.askName",
  business: "welcomeChat.askBusiness",
  phone: "welcomeChat.askPhone",
  email: "welcomeChat.askEmail",
  password: "welcomeChat.askPassword",
};

const fieldInput: Record<
  Field,
  { type: string; autoComplete: string; inputMode?: "text" | "numeric" | "email"; maxLength?: number }
> = {
  name: { type: "text", autoComplete: "name" },
  business: { type: "text", autoComplete: "organization" },
  phone: { type: "tel", autoComplete: "tel-national", inputMode: "numeric", maxLength: 14 },
  email: { type: "email", autoComplete: "email", inputMode: "email" },
  password: { type: "password", autoComplete: "new-password" },
};

const REDIRECT_AFTER_SUCCESS_MS = 6000;

function isField(step: Step): step is Field {
  return (FIELD_ORDER as string[]).includes(step);
}

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function formatPhone(phone: string): string {
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
}

// Spoken input arrives as words; turn it into what each field expects.
function cleanSpoken(field: Field, text: string): string {
  if (field === "phone") return text.replace(/\D/g, "");
  if (field === "email") {
    return text
      .toLowerCase()
      .replace(/\s*\b(at the rate of|at the rate|at sign|at)\b\s*/g, "@")
      .replace(/\s*\bdot\b\s*/g, ".")
      .replace(/\s*\bunderscore\b\s*/g, "_")
      .replace(/\s*\b(dash|hyphen)\b\s*/g, "-")
      .replace(/\s+/g, "");
  }
  return text.replace(/\s+/g, " ").trimStart();
}

// What Munshi reads aloud for a message. The preview card skips the password.
function spokenText(message: NewMessage): string {
  if (message.role === "user") return "";
  if ("preview" in message) {
    const draft = message.preview;
    return [
      i18n.t("welcomeChat.previewTitle"),
      `${i18n.t("welcomeChat.fields.name")}: ${draft.name}`,
      `${i18n.t("welcomeChat.fields.business")}: ${draft.business}`,
      `${i18n.t("welcomeChat.fields.phone")}: ${draft.phone.split("").join(" ")}`,
      `${i18n.t("welcomeChat.fields.email")}: ${draft.email}`,
    ].join(". ");
  }
  if ("text" in message) return message.text;
  return i18n.t(message.key, message.params);
}

interface Chip {
  label: string;
  primary?: boolean;
  /** Words (English, Hinglish, Hindi) that pick this option when spoken. */
  keywords?: string[];
  onClick: () => void;
}

const CHOICE_KEYWORDS = {
  register: ["new", "create", "register", "sign up", "signup", "naya", "nayi", "banao", "banana", "नया", "नई", "बनाओ", "बनाना", "रजिस्टर"],
  login: ["login", "log in", "sign in", "signin", "already", "have an account", "purana", "purane", "पुराना", "पुराने", "लॉगिन", "लॉग इन"],
  confirm: ["yes", "ok", "okay", "confirm", "create", "correct", "right", "looks good", "haan", "han", "sahi", "theek", "thik", "banao", "हाँ", "हां", "सही", "ठीक", "बनाओ"],
  edit: ["no", "change", "edit", "wrong", "nahi", "nahin", "badlo", "badalna", "galat", "नहीं", "बदलो", "बदलना", "गलत"],
  home: ["home", "start", "go", "open", "chalo", "shuru", "होम", "चलो", "शुरू"],
};

const LANGUAGE_KEYWORDS: Record<SupportedLanguageCode, string[]> = {
  en: ["english", "angrezi", "इंग्लिश", "अंग्रेजी", "अंग्रेज़ी"],
  "hi-Latn": ["hinglish", "हिंग्लिश"],
  hi: ["hindi", "हिंदी", "हिन्दी"],
};

const EDIT_KEYWORDS: Record<Field | "language", string[]> = {
  name: ["name", "naam", "नाम"],
  business: ["business", "shop", "dukan", "dukaan", "firm", "company", "बिज़नेस", "बिजनेस", "दुकान", "व्यापार"],
  phone: ["mobile", "phone", "number", "मोबाइल", "फ़ोन", "फोन", "नंबर"],
  email: ["email", "e-mail", "mail", "ईमेल"],
  password: ["password", "पासवर्ड"],
  language: ["language", "bhasha", "भाषा"],
};

function normalizeSpeech(text: string): string {
  return ` ${text.toLowerCase().replace(/[.,!?।]/g, " ").replace(/\s+/g, " ").trim()} `;
}

// Picks the option whose keywords (or label) best match what was said. Whole
// words only, so "change" doesn't match "ha"; longer matches win ties such as
// "business name" (business beats name).
function matchChip(spoken: string, chips: Chip[]): Chip | null {
  const said = normalizeSpeech(spoken);
  let best: Chip | null = null;
  let bestScore = 0;
  for (const chip of chips) {
    let score = 0;
    for (const keyword of [chip.label, ...(chip.keywords ?? [])]) {
      if (said.includes(normalizeSpeech(keyword))) score += keyword.length;
    }
    if (score > bestScore) {
      best = chip;
      bestScore = score;
    }
  }
  return best;
}

// Words that start a question. Strong ones count from two words ("kya hai"),
// weak ones need three so a name like "Will Kumar" isn't taken as a question.
const STRONG_QUESTION_START =
  /^(what|how|why|when|where|which|who|whom|whose|kya|kaise|kaisa|kaisi|kyu|kyun|kyon|kab|kahan|kaha|kaun|kitna|kitne|kitni|क्या|कैसे|कैसा|क्यों|कब|कहाँ|कहां|कौन|कितना|कितने|कितनी)(\s|$)/i;
const WEAK_QUESTION_START = /^(can|could|do|does|did|is|are|will|would|should|may|tell|explain|batao|bataiye|बताओ|बताइए)(\s|$)/i;

function looksLikeQuestion(text: string): boolean {
  const value = text.trim();
  if (/[?？]$/.test(value)) return true;
  const words = value.split(/\s+/).length;
  return (STRONG_QUESTION_START.test(value) && words >= 2) || (WEAK_QUESTION_START.test(value) && words >= 3);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function MunshiWelcomeChat({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const splashDone = useSplashStore((state) => state.done);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(true);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [offerLogin, setOfferLogin] = useState(false);
  const voiceEnabled = useVoiceStore((state) => state.enabled);
  const speakingId = useVoiceStore((state) => state.speakingId);
  const setVoiceEnabled = useVoiceStore((state) => state.setEnabled);
  const speak = useVoiceStore((state) => state.speak);
  const stopSpeaking = useVoiceStore((state) => state.stop);

  const draftRef = useRef<Draft>({
    language: currentLanguage(),
    name: "",
    business: "",
    phone: "",
    email: "",
    password: "",
  });
  const idRef = useRef(0);
  const aliveRef = useRef(true);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // What the mic is filling: a typed field, or a spoken pick among the option chips.
  const micTargetRef = useRef<Field | "choice" | null>(null);
  const chipsRef = useRef<Chip[]>([]);
  const answerRef = useRef<((question: string) => Promise<void>) | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      useVoiceStore.getState().stop();
    };
  }, []);

  const push = useCallback((message: NewMessage) => {
    idRef.current += 1;
    const id = idRef.current;
    setMessages((current) => [...current, { ...message, id } as ChatMessage]);
    if (message.role === "bot") {
      const voice = useVoiceStore.getState();
      if (voice.enabled) voice.speak(String(id), spokenText(message), currentLanguage());
    }
  }, []);

  const say = useCallback(
    async (key: string, params?: Record<string, string>, tone?: "success") => {
      // Fetch the voice during the typing dots so speech starts with the message.
      if (useVoiceStore.getState().enabled) prefetchVoice(i18n.t(key, params), currentLanguage());
      setTyping(true);
      await wait(650);
      if (!aliveRef.current) return;
      setTyping(false);
      push({ role: "bot", key, params, tone });
    },
    [push]
  );

  const mic = useSpeechRecognition(
    (text, isFinal) => {
      const target = micTargetRef.current;
      if (!target) return;
      if (target !== "choice") {
        setInput(cleanSpoken(target, text));
        return;
      }
      setInput(text);
      if (!isFinal) return;
      micTargetRef.current = null;
      setInput("");
      const chip = matchChip(text, chipsRef.current);
      if (chip && !looksLikeQuestion(text)) chip.onClick();
      else void answerRef.current?.(text);
    },
    (error) => showError(t(error === "denied" ? "welcomeChat.voice.micDenied" : "welcomeChat.voice.micFailed"))
  );

  useEffect(() => {
    if (!splashDone || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      await say("welcomeChat.greeting");
      setStep("choose");
      setBusy(false);
    })();
  }, [splashDone, say]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (isField(step) && !busy) inputRef.current?.focus();
  }, [step, busy]);

  const askField = async (field: Field) => {
    await say(fieldPromptKey[field], field === "business" ? { name: draftRef.current.name } : undefined);
    setStep(field);
    setBusy(false);
  };

  const showPreview = async (introKey: string) => {
    await say(introKey);
    push({ role: "bot", preview: { ...draftRef.current } });
    setStep("preview");
    setBusy(false);
  };

  const goToLogin = async (userText: string) => {
    push({ role: "user", text: userText });
    setBusy(true);
    await say("welcomeChat.goingToLogin");
    await wait(600);
    if (aliveRef.current) navigate("/login");
  };

  const chooseRegister = async () => {
    push({ role: "user", text: t("welcomeChat.choiceRegister") });
    setBusy(true);
    await say("welcomeChat.askLanguage");
    setStep("language");
    setBusy(false);
  };

  const chooseLanguage = async (code: SupportedLanguageCode, label: string) => {
    push({ role: "user", text: label });
    setBusy(true);
    await i18n.changeLanguage(code);
    draftRef.current = { ...draftRef.current, language: code };
    await say("welcomeChat.languageSet");
    if (editing) {
      setEditing(false);
      await showPreview("welcomeChat.previewUpdated");
    } else {
      await askField("name");
    }
  };

  // A visitor's own question: a short, SethSathi-only answer, then the chat
  // carries on from the same step (the options/placeholder stay on screen).
  const answerQuestion = async (question: string) => {
    push({ role: "user", text: question });
    setInput("");
    setBusy(true);
    setTyping(true);
    try {
      const { reply } = await askMunshi(question, currentLanguage());
      if (!aliveRef.current) return;
      setTyping(false);
      push({ role: "bot", text: reply });
    } catch {
      if (!aliveRef.current) return;
      setTyping(false);
      push({ role: "bot", key: "welcomeChat.askFailed" });
    }
    setBusy(false);
  };

  useEffect(() => {
    answerRef.current = answerQuestion;
  });

  const submitField = async () => {
    if (busy) return;
    if (!isField(step)) {
      // Option steps: typed text either names an option or is a question.
      const text = input.trim();
      if (!text) return;
      micTargetRef.current = null;
      mic.stop();
      const chip = matchChip(text, chipsRef.current);
      if (chip && !looksLikeQuestion(text)) {
        setInput("");
        chip.onClick();
      } else if (chipsRef.current.length > 0) {
        await answerQuestion(text);
      }
      return;
    }
    const field = step;
    const raw = input;
    if (field !== "password" && looksLikeQuestion(raw)) {
      micTargetRef.current = null;
      mic.stop();
      await answerQuestion(raw.trim());
      return;
    }
    const value = field === "phone" ? normalizePhone(raw) : field === "password" ? raw : raw.trim();
    if (!value) return;

    micTargetRef.current = null;
    mic.stop();
    push({
      role: "user",
      text: field === "password" ? "•".repeat(Math.min(value.length, 12)) : field === "phone" ? formatPhone(value) : value,
    });
    setInput("");
    setBusy(true);

    if (!fieldSchemas[field].safeParse(value).success) {
      await say(fieldErrorKey[field]);
      setBusy(false);
      return;
    }

    draftRef.current = { ...draftRef.current, [field]: value };
    setOfferLogin(false);

    if (editing) {
      setEditing(false);
      await showPreview("welcomeChat.previewUpdated");
      return;
    }
    const next = FIELD_ORDER[FIELD_ORDER.indexOf(field) + 1];
    if (next) await askField(next);
    else await showPreview("welcomeChat.previewIntro");
  };

  const startEdit = async () => {
    push({ role: "user", text: t("welcomeChat.edit") });
    setBusy(true);
    await say("welcomeChat.whichEdit");
    setStep("editPick");
    setBusy(false);
  };

  const pickEdit = async (target: Field | "language") => {
    push({ role: "user", text: t(`welcomeChat.fields.${target}`) });
    setEditing(true);
    setBusy(true);
    await say(`welcomeChat.editPrompt.${target}`);
    setStep(target);
    setBusy(false);
  };

  const createAccount = async () => {
    const draft = draftRef.current;
    push({ role: "user", text: t("welcomeChat.confirm") });
    setStep("creating");
    setBusy(true);
    await say("welcomeChat.creating");
    setTyping(true);

    try {
      const session = await registerTenant({
        businessName: draft.business,
        businessType: "Wholesale",
        ownerName: draft.name,
        email: draft.email,
        password: draft.password,
        phone: draft.phone,
        preferredLanguage: draft.language,
      });
      if (!aliveRef.current) return;
      setTyping(false);
      setSession(session);
      push({ role: "bot", key: "welcomeChat.success", params: { name: draft.name, business: draft.business }, tone: "success" });
      await say("welcomeChat.successHelp");
      setStep("done");
      setBusy(false);
      await wait(REDIRECT_AFTER_SUCCESS_MS);
      if (aliveRef.current) navigate("/app", { replace: true });
    } catch (err) {
      if (!aliveRef.current) return;
      setTyping(false);
      const code = err instanceof ApiError ? err.code : undefined;
      const message = err instanceof Error ? err.message : "";
      const taken: Field | null =
        code === "EMAIL_TAKEN" || (!code && /email/i.test(message))
          ? "email"
          : code === "PHONE_TAKEN" || (!code && /mobile/i.test(message))
            ? "phone"
            : null;

      if (taken) {
        await say(taken === "email" ? "welcomeChat.errors.emailTaken" : "welcomeChat.errors.phoneTaken");
        setEditing(true);
        setOfferLogin(true);
        setStep(taken);
        setBusy(false);
        return;
      }
      await say("welcomeChat.errors.generic", { message });
      setStep("preview");
      setBusy(false);
    }
  };

  const fieldStep = isField(step) ? step : null;
  // Steps that show option chips; the box then takes a typed or spoken choice or question.
  const choiceStep = (CHOICE_STEPS as readonly Step[]).includes(step);
  const inputConfig = fieldStep ? fieldInput[fieldStep] : null;

  const toggleVoice = () => {
    if (voiceEnabled) {
      setVoiceEnabled(false);
      return;
    }
    setVoiceEnabled(true);
    const lastBot = [...messages].reverse().find((message) => message.role === "bot");
    if (lastBot) speak(String(lastBot.id), spokenText(lastBot), currentLanguage(), { interrupt: true });
  };

  const replay = (message: ChatMessage) => {
    if (speakingId === String(message.id)) {
      stopSpeaking();
      return;
    }
    speak(String(message.id), spokenText(message), currentLanguage(), { interrupt: true });
  };

  const chips: Chip[] = busy
    ? []
    : step === "choose"
      ? [
          {
            label: t("welcomeChat.choiceRegister"),
            primary: true,
            keywords: CHOICE_KEYWORDS.register,
            onClick: chooseRegister,
          },
          {
            label: t("welcomeChat.choiceLogin"),
            keywords: CHOICE_KEYWORDS.login,
            onClick: () => goToLogin(t("welcomeChat.choiceLogin")),
          },
        ]
      : step === "language"
        ? supportedLanguages.map((lang) => ({
            label: lang.label,
            primary: lang.code === currentLanguage(),
            keywords: LANGUAGE_KEYWORDS[lang.code],
            onClick: () => chooseLanguage(lang.code, lang.label),
          }))
        : step === "preview"
          ? [
              { label: t("welcomeChat.confirm"), primary: true, keywords: CHOICE_KEYWORDS.confirm, onClick: createAccount },
              { label: t("welcomeChat.edit"), keywords: CHOICE_KEYWORDS.edit, onClick: startEdit },
            ]
          : step === "editPick"
            ? (["name", "business", "phone", "email", "password", "language"] as const).map((target) => ({
                label: t(`welcomeChat.fields.${target}`),
                keywords: EDIT_KEYWORDS[target],
                onClick: () => pickEdit(target),
              }))
            : step === "done"
              ? [
                  {
                    label: t("welcomeChat.goHome"),
                    primary: true,
                    keywords: CHOICE_KEYWORDS.home,
                    onClick: () => navigate("/app", { replace: true }),
                  },
                ]
              : offerLogin
                ? [
                    {
                      label: t("welcomeChat.loginInstead"),
                      keywords: CHOICE_KEYWORDS.login,
                      onClick: () => goToLogin(t("welcomeChat.loginInstead")),
                    },
                  ]
                : [];

  useEffect(() => {
    chipsRef.current = chips;
  });

  // Typed steps fill the box; option steps pick a chip by voice. Never dictate a password.
  const micTarget: Field | "choice" | null = busy
    ? null
    : fieldStep
      ? fieldStep === "password"
        ? null
        : fieldStep
      : choiceStep
        ? "choice"
        : null;
  const stopMic = mic.stop;
  const micLabelKey = mic.listening
    ? "welcomeChat.voice.micStop"
    : fieldStep === "password"
      ? "welcomeChat.voice.passwordNoMic"
      : micTarget === "choice"
        ? "welcomeChat.voice.micChoose"
        : "welcomeChat.voice.micStart";

  useEffect(() => {
    if (micTarget) return;
    micTargetRef.current = null;
    stopMic();
  }, [micTarget, stopMic]);

  const toggleMic = () => {
    if (mic.listening) {
      if (micTargetRef.current === "choice") setInput("");
      micTargetRef.current = null;
      mic.stop();
      return;
    }
    if (!micTarget) return;
    micTargetRef.current = micTarget;
    stopSpeaking(); // otherwise the mic hears Munshi talking
    mic.start(micTarget === "phone" || micTarget === "email" ? "en-IN" : recognitionLang(currentLanguage()));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <img
          src="/splash-munshi.webp"
          alt=""
          className="h-10 w-10 shrink-0 rounded-full border border-border object-cover object-[center_12%]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight text-text">{t("brand.assistantName")}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {t("welcomeChat.online")}
          </p>
        </div>
        {voiceOutputSupported ? (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={voiceEnabled}
            aria-label={t(voiceEnabled ? "welcomeChat.voice.speakerOff" : "welcomeChat.voice.speakerOn")}
            title={t(voiceEnabled ? "welcomeChat.voice.speakerOff" : "welcomeChat.voice.speakerOn")}
            className={clsx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              voiceEnabled
                ? "bg-primary-container text-primary"
                : "text-text-muted hover:bg-surface-muted hover:text-text"
            )}
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("welcomeChat.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        ) : null}
      </header>

      <div ref={scrollRef} role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-on-primary shadow-elevation-1">
                {message.text}
              </p>
            </div>
          ) : (
            <div key={message.id} className="flex items-end gap-2">
              <img
                src="/splash-munshi.webp"
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover object-[center_12%]"
              />
              {"preview" in message ? (
                <AccountPreview draft={message.preview} />
              ) : (
                <p
                  className={clsx(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm shadow-elevation-1",
                    message.tone === "success"
                      ? "border-success/30 bg-success-container text-text"
                      : "border-border bg-surface text-text"
                  )}
                >
                  {message.tone === "success" ? (
                    <PartyPopper size={16} className="mb-1 text-success" aria-hidden="true" />
                  ) : null}
                  {"text" in message ? message.text : t(message.key, message.params)}
                </p>
              )}
              {voiceOutputSupported ? (
                <button
                  type="button"
                  onClick={() => replay(message)}
                  aria-label={t(speakingId === String(message.id) ? "welcomeChat.voice.stop" : "welcomeChat.voice.replay")}
                  title={t(speakingId === String(message.id) ? "welcomeChat.voice.stop" : "welcomeChat.voice.replay")}
                  className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {speakingId === String(message.id) ? (
                    <Square size={11} fill="currentColor" className="text-primary" />
                  ) : (
                    <Volume2 size={15} />
                  )}
                </button>
              ) : null}
            </div>
          )
        )}

        {typing ? (
          <div className="flex items-end gap-2">
            <img src="/splash-munshi.webp" alt="" className="h-7 w-7 shrink-0 rounded-full object-cover object-[center_12%]" />
            <span
              className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-surface px-3.5 py-3 shadow-elevation-1"
              role="status"
            >
              <span className="sr-only">{t("welcomeChat.typing")}</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-text-muted"
                  style={{ animation: `munshi-typing 1000ms ease-in-out ${i * 150}ms infinite` }}
                />
              ))}
            </span>
          </div>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="flex shrink-0 flex-wrap gap-2 px-4 pb-3">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onClick}
              className={clsx(
                "rounded-full border px-3.5 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                chip.primary
                  ? "border-primary bg-primary text-on-primary hover:bg-primary-hover"
                  : "border-border bg-surface text-text hover:border-primary/40 hover:text-primary"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitField();
        }}
        className="flex shrink-0 items-center gap-2 border-t border-border bg-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
      >
        <input
          ref={inputRef}
          key={fieldStep ?? "idle"}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy || (!fieldStep && !choiceStep)}
          type={inputConfig?.type ?? "text"}
          autoComplete={inputConfig?.autoComplete ?? "off"}
          inputMode={inputConfig?.inputMode}
          maxLength={inputConfig?.maxLength}
          placeholder={
            mic.listening
              ? t("welcomeChat.voice.listening")
              : fieldStep
                ? t(`welcomeChat.placeholders.${fieldStep}`)
                : t("welcomeChat.chooseAbove")
          }
          aria-label={fieldStep ? t(`welcomeChat.fields.${fieldStep}`) : t("welcomeChat.chooseAbove")}
          className="min-w-0 flex-1 rounded-full border border-transparent bg-surface-variant px-4 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/80 focus:border-primary disabled:opacity-60"
        />
        {speechRecognitionSupported ? (
          <button
            type="button"
            onClick={toggleMic}
            disabled={!micTarget && !mic.listening}
            aria-pressed={mic.listening}
            aria-label={t(micLabelKey)}
            title={t(micLabelKey)}
            className={clsx(
              "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40",
              mic.listening ? "bg-danger text-white" : "bg-surface-variant text-text-muted hover:text-primary"
            )}
          >
            {mic.listening ? (
              <>
                <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" aria-hidden="true" />
                <Square size={13} fill="currentColor" className="relative" />
              </>
            ) : (
              <Mic size={18} />
            )}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy || (!fieldStep && !choiceStep) || !input.trim()}
          aria-label={t("welcomeChat.send")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </form>

      <style>{`
        @keyframes munshi-typing {
          0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

function AccountPreview({ draft }: { draft: Draft }) {
  const { t } = useTranslation();
  const languageLabel = supportedLanguages.find((lang) => lang.code === draft.language)?.label ?? draft.language;

  const rows: { label: string; value: string }[] = [
    { label: t("welcomeChat.fields.name"), value: draft.name },
    { label: t("welcomeChat.fields.business"), value: draft.business },
    { label: t("welcomeChat.fields.phone"), value: formatPhone(draft.phone) },
    { label: t("welcomeChat.fields.email"), value: draft.email },
    { label: t("welcomeChat.fields.password"), value: "••••••••" },
    { label: t("welcomeChat.fields.language"), value: languageLabel },
  ];

  return (
    <div className="w-full max-w-[85%] overflow-hidden rounded-2xl rounded-bl-md border border-primary/25 bg-surface shadow-elevation-2">
      <div className="flex items-center gap-2 border-b border-border bg-primary-container px-4 py-2.5">
        <img src="/logo.svg" alt="" className="h-5 w-5" />
        <p className="text-sm font-bold text-on-primary-container">{t("welcomeChat.previewTitle")}</p>
      </div>
      <dl className="divide-y divide-border px-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="shrink-0 text-xs text-text-muted">{row.label}</dt>
            <dd className="min-w-0 truncate text-right text-sm font-semibold text-text">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border bg-surface-muted px-4 py-2 text-[11px] leading-snug text-text-muted">
        {t("welcomeChat.termsNote")}
      </p>
    </div>
  );
}
