import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import clsx from "clsx";
import { ArrowUp, PartyPopper, X } from "lucide-react";
import i18n, { currentLanguage, supportedLanguages, type SupportedLanguageCode } from "../../lib/i18n";
import { register as registerTenant } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { useAuthStore } from "../../lib/auth-store";
import { useSplashStore } from "../../lib/splash-store";

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
  | { id: number; role: "user"; text: string };

type NewMessage =
  | { role: "bot"; key: string; params?: Record<string, string>; tone?: "success" }
  | { role: "bot"; preview: Draft }
  | { role: "user"; text: string };

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

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const push = useCallback((message: NewMessage) => {
    idRef.current += 1;
    const id = idRef.current;
    setMessages((current) => [...current, { ...message, id } as ChatMessage]);
  }, []);

  const say = useCallback(
    async (key: string, params?: Record<string, string>, tone?: "success") => {
      setTyping(true);
      await wait(650);
      if (!aliveRef.current) return;
      setTyping(false);
      push({ role: "bot", key, params, tone });
    },
    [push]
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

  const submitField = async () => {
    if (!isField(step) || busy) return;
    const field = step;
    const raw = input;
    const value = field === "phone" ? normalizePhone(raw) : field === "password" ? raw : raw.trim();
    if (!value) return;

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
  const inputConfig = fieldStep ? fieldInput[fieldStep] : null;

  const chips: { label: string; primary?: boolean; onClick: () => void }[] = busy
    ? []
    : step === "choose"
      ? [
          { label: t("welcomeChat.choiceRegister"), primary: true, onClick: chooseRegister },
          { label: t("welcomeChat.choiceLogin"), onClick: () => goToLogin(t("welcomeChat.choiceLogin")) },
        ]
      : step === "language"
        ? supportedLanguages.map((lang) => ({
            label: lang.label,
            primary: lang.code === currentLanguage(),
            onClick: () => chooseLanguage(lang.code, lang.label),
          }))
        : step === "preview"
          ? [
              { label: t("welcomeChat.confirm"), primary: true, onClick: createAccount },
              { label: t("welcomeChat.edit"), onClick: startEdit },
            ]
          : step === "editPick"
            ? (["name", "business", "phone", "email", "password", "language"] as const).map((target) => ({
                label: t(`welcomeChat.fields.${target}`),
                onClick: () => pickEdit(target),
              }))
            : step === "done"
              ? [{ label: t("welcomeChat.goHome"), primary: true, onClick: () => navigate("/app", { replace: true }) }]
              : offerLogin
                ? [{ label: t("welcomeChat.loginInstead"), onClick: () => goToLogin(t("welcomeChat.loginInstead")) }]
                : [];

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
                  {t(message.key, message.params)}
                </p>
              )}
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
          disabled={!fieldStep || busy}
          type={inputConfig?.type ?? "text"}
          autoComplete={inputConfig?.autoComplete ?? "off"}
          inputMode={inputConfig?.inputMode}
          maxLength={inputConfig?.maxLength}
          placeholder={fieldStep ? t(`welcomeChat.placeholders.${fieldStep}`) : t("welcomeChat.chooseAbove")}
          aria-label={fieldStep ? t(`welcomeChat.fields.${fieldStep}`) : t("welcomeChat.chooseAbove")}
          className="min-w-0 flex-1 rounded-full border border-transparent bg-surface-variant px-4 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/80 focus:border-primary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!fieldStep || busy || !input.trim()}
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
